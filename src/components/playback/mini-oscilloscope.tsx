"use client";

import { useRef, useEffect } from "react";

const POINTS = 64;

interface MiniOscilloscopeProps {
  analyserNode: AnalyserNode | null;
  isPlaying: boolean;
}

/**
 * Lightweight live waveform for the mini-player.
 * Single line, no Gaussian envelope, no ridge history.
 */
export function MiniOscilloscope({ analyserNode, isPlaying }: MiniOscilloscopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const analyserRef = useRef(analyserNode);
  const playingRef = useRef(isPlaying);

  analyserRef.current = analyserNode;
  playingRef.current = isPlaying;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dimsRef = { w: 0, h: 0, dpr: 1 };
    const updateDims = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      dimsRef.w = rect.width;
      dimsRef.h = rect.height;
      dimsRef.dpr = dpr;
    };
    updateDims();
    const ro = new ResizeObserver(updateDims);
    ro.observe(canvas);

    let timeBuf: Uint8Array<ArrayBuffer> | null = null;

    const draw = () => {
      const analyser = analyserRef.current;
      const playing = playingRef.current;
      const { w, h, dpr } = dimsRef;

      if (w === 0 || h === 0) { rafRef.current = requestAnimationFrame(draw); return; }

      const pw = Math.round(w * dpr);
      const ph = Math.round(h * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const midY = h / 2;

      if (analyser && playing) {
        const bufLen = analyser.fftSize;
        if (!timeBuf || timeBuf.length !== bufLen) timeBuf = new Uint8Array(bufLen);
        analyser.getByteTimeDomainData(timeBuf);

        // Zero-crossing trigger
        let trigger = 0;
        const limit = bufLen >> 1;
        for (let i = 1; i < limit; i++) {
          if (timeBuf[i - 1] < 128 && timeBuf[i] >= 128) { trigger = i; break; }
        }
        if (trigger === 0) trigger = bufLen >> 2;

        const available = Math.min(bufLen - trigger, bufLen >> 1);
        const step = available / POINTS;
        const sliceW = w / (POINTS - 1);
        const amp = h * 0.35;

        ctx.beginPath();
        for (let i = 0; i < POINTS; i++) {
          const val = (timeBuf[trigger + ((i * step) | 0)] - 128) / 128;
          const px = i * sliceW;
          const py = midY - val * amp;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        // Flat line when paused
        ctx.beginPath();
        ctx.moveTo(0, midY);
        ctx.lineTo(w, midY);
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" style={{ display: "block" }} />;
}
