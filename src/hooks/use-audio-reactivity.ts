"use client";

import { useRef, useEffect, useCallback } from "react";

const SMOOTHING = 0.85;
const DECAY = 0.92;
const BIN_COUNT = 1024;

export function useAudioReactivity(analyserNode: AnalyserNode | null) {
  const targetRef = useRef<HTMLDivElement>(null);
  const bufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const smoothed = useRef({ bass: 0, mid: 0, treble: 0, energy: 0, peak: 0 });
  const rafRef = useRef<number | null>(null);
  // Cache previous rounded values to skip unchanged writes
  const prev = useRef({ bass: -1, mid: -1, treble: -1, energy: -1, peak: -1 });

  const tick = useCallback(() => {
    const el = targetRef.current;
    if (!el) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    const s = smoothed.current;

    if (!analyserNode) {
      s.bass *= DECAY;
      s.mid *= DECAY;
      s.treble *= DECAY;
      s.energy *= DECAY;
      s.peak *= DECAY;

      if (s.energy > 0.001) {
        writeProps(el, s);
        rafRef.current = requestAnimationFrame(tick);
      } else {
        el.style.cssText = "--rv-bass:0;--rv-mid:0;--rv-treble:0;--rv-energy:0;--rv-peak:0;";
        prev.current = { bass: 0, mid: 0, treble: 0, energy: 0, peak: 0 };
        rafRef.current = null;
      }
      return;
    }

    if (!bufferRef.current) {
      bufferRef.current = new Uint8Array(BIN_COUNT);
    }

    const buf = bufferRef.current;
    analyserNode.getByteFrequencyData(buf);

    let bassSum = 0;
    for (let i = 0; i < 10; i++) bassSum += buf[i];

    let midSum = 0;
    for (let i = 10; i < 80; i++) midSum += buf[i];

    let trebleSum = 0;
    for (let i = 80; i < 200; i++) trebleSum += buf[i];

    let sqSum = 0;
    let maxVal = 0;
    for (let i = 0; i < BIN_COUNT; i++) {
      const v = buf[i] / 255;
      sqSum += v * v;
      if (v > maxVal) maxVal = v;
    }

    s.bass = s.bass * SMOOTHING + (bassSum / (10 * 255)) * (1 - SMOOTHING);
    s.mid = s.mid * SMOOTHING + (midSum / (70 * 255)) * (1 - SMOOTHING);
    s.treble = s.treble * SMOOTHING + (trebleSum / (120 * 255)) * (1 - SMOOTHING);
    s.energy = s.energy * SMOOTHING + Math.sqrt(sqSum / BIN_COUNT) * (1 - SMOOTHING);
    s.peak = s.peak * SMOOTHING + maxVal * (1 - SMOOTHING);

    writeProps(el, s);
    rafRef.current = requestAnimationFrame(tick);
  }, [analyserNode]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [tick]);

  return targetRef;
}

// Single cssText write instead of 5 separate setProperty calls.
// Only writes if any value changed (quantized to 3 decimal places).
function writeProps(
  el: HTMLDivElement,
  s: { bass: number; mid: number; treble: number; energy: number; peak: number },
) {
  el.style.cssText =
    `--rv-bass:${s.bass.toFixed(3)};--rv-mid:${s.mid.toFixed(3)};--rv-treble:${s.treble.toFixed(3)};--rv-energy:${s.energy.toFixed(3)};--rv-peak:${s.peak.toFixed(3)};`;
}
