"use client";

import { useRef, useEffect, useCallback } from "react";

const SMOOTHING = 0.85;
const DECAY = 0.92;
const BIN_COUNT = 1024;

export function useAudioReactivity(analyserNode: AnalyserNode | null) {
  const targetRef = useRef<HTMLDivElement>(null);
  const bufferRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const smoothed = useRef({ energy: 0, peak: 0 });
  const rafRef = useRef<number | null>(null);

  const tick = useCallback(() => {
    const el = targetRef.current;
    if (!el) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    const s = smoothed.current;

    if (!analyserNode) {
      s.energy *= DECAY;
      s.peak *= DECAY;

      if (s.energy > 0.001) {
        writeProps(el, s);
        rafRef.current = requestAnimationFrame(tick);
      } else {
        el.style.cssText = "--rv-energy:0;--rv-peak:0;";
        rafRef.current = null;
      }
      return;
    }

    if (!bufferRef.current) {
      bufferRef.current = new Uint8Array(BIN_COUNT);
    }

    const buf = bufferRef.current;
    analyserNode.getByteFrequencyData(buf);

    let sqSum = 0;
    let maxVal = 0;
    for (let i = 0; i < BIN_COUNT; i++) {
      const v = buf[i] / 255;
      sqSum += v * v;
      if (v > maxVal) maxVal = v;
    }

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

function writeProps(
  el: HTMLDivElement,
  s: { energy: number; peak: number },
) {
  el.style.cssText = `--rv-energy:${s.energy.toFixed(3)};--rv-peak:${s.peak.toFixed(3)};`;
}
