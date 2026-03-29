"use client";

import { useRef, useEffect } from "react";

const POINTS_PER_ROW = 200;
const CAPTURE_INTERVAL_MS = 100;
const LIFETIME_MS = 5000;
const SPAWN_Y_FRAC = 0.85;
const TRAVEL_FRAC = 0.8;
const AMPLITUDE = 24;
const MAX_OPACITY = 0.5;
const GAUSSIAN_SIGMA = 0.22;

// Precomputed Gaussian envelope
const ENVELOPE = new Float32Array(POINTS_PER_ROW);
for (let i = 0; i < POINTS_PER_ROW; i++) {
  const x = i / (POINTS_PER_ROW - 1) - 0.5;
  ENVELOPE[i] = Math.exp(-(x * x) / (2 * GAUSSIAN_SIGMA * GAUSSIAN_SIGMA));
}

// Precomputed opacity strings (256 levels, avoids per-frame toFixed + template literal allocation)
const OPACITY_LUT: string[] = [];
for (let i = 0; i < 256; i++) {
  OPACITY_LUT[i] = `rgba(255,255,255,${(i / 255).toFixed(3)})`;
}

function opacityStr(val: number): string {
  return OPACITY_LUT[Math.min(255, Math.max(0, (val * 255) | 0))];
}

interface Row {
  points: Float32Array;
  birth: number;
}

const FADE_DURATION_MS = 1500;

interface OscilloscopeProps {
  analyserNode: AnalyserNode | null;
  isPlaying: boolean;
  progress?: number;
  generation?: number;
  /** When false, stops capturing new rows but keeps rendering existing ones. */
  active?: boolean;
}

export function Oscilloscope({ analyserNode, isPlaying, progress, generation, active = true }: OscilloscopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const analyserRef = useRef(analyserNode);
  const isPlayingRef = useRef(isPlaying);
  const progressRef = useRef(progress);
  const timeBuf = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const rows = useRef<Row[]>([]);
  const rowHead = useRef(0);
  const lastCapture = useRef(0);
  const livePoints = useRef(new Float32Array(POINTS_PER_ROW));

  // Fade state: 0 = faded out, 1 = fully visible
  const fadeRef = useRef(1);
  const fadeTarget = useRef(1);
  const lastGen = useRef(generation);

  // Cached dimensions (updated via ResizeObserver, not per-frame)
  const dimsRef = useRef({ w: 0, h: 0, dpr: 1 });

  // Cached gradient (reused when prog hasn't changed enough)
  const gradCache = useRef<{ prog: number; w: number; grad: CanvasGradient | null }>({
    prog: -1, w: 0, grad: null,
  });

  const activeGateRef = useRef(active);
  analyserRef.current = analyserNode;
  isPlayingRef.current = isPlaying;
  progressRef.current = progress;
  activeGateRef.current = active;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Cache dimensions via ResizeObserver instead of per-frame getBoundingClientRect
    const updateDims = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      dimsRef.current = { w: rect.width, h: rect.height, dpr };
    };
    updateDims();

    const ro = new ResizeObserver(updateDims);
    ro.observe(canvas);

    let lastFrameTime = performance.now();

    const draw = () => {
      const analyser = analyserRef.current;
      const playing = isPlayingRef.current;
      const prog = progressRef.current ?? 0;
      const now = performance.now();
      const dt = now - lastFrameTime;
      lastFrameTime = now;

      const { w, h, dpr } = dimsRef.current;
      if (w === 0 || h === 0) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      // Handle generation changes: fade out → clear → fade in
      if (lastGen.current !== undefined && lastGen.current !== generation) {
        lastGen.current = generation;
        fadeTarget.current = 0; // start fading out
      }

      // Animate fade toward target
      const fadeSpeed = dt / FADE_DURATION_MS;
      if (fadeRef.current < fadeTarget.current) {
        fadeRef.current = Math.min(1, fadeRef.current + fadeSpeed);
      } else if (fadeRef.current > fadeTarget.current) {
        fadeRef.current = Math.max(0, fadeRef.current - fadeSpeed);
        // When fully faded out, clear rows and start fading back in
        if (fadeRef.current <= 0) {
          rows.current = [];
          rowHead.current = 0;
          fadeTarget.current = 1;
        }
      }

      const pw = Math.round(w * dpr);
      const ph = Math.round(h * dpr);
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
        gradCache.current.prog = -1; // invalidate gradient cache on resize
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const spawnY = h * SPAWN_Y_FRAC;
      const sliceW = w / (POINTS_PER_ROW - 1);
      let hasLive = false;

      // Sample analyser for the live line (every frame)
      if (analyser && playing) {
        const bufLen = analyser.fftSize;
        if (!timeBuf.current || timeBuf.current.length !== bufLen) {
          timeBuf.current = new Uint8Array(bufLen);
        }
        analyser.getByteTimeDomainData(timeBuf.current);
        const buf = timeBuf.current;

        // Zero-crossing trigger
        let triggerIndex = 0;
        const searchLimit = bufLen >> 1;
        for (let i = 1; i < searchLimit; i++) {
          if (buf[i - 1] < 128 && buf[i] >= 128) {
            triggerIndex = i;
            break;
          }
        }
        if (triggerIndex === 0) triggerIndex = bufLen >> 2;

        const available = Math.min(bufLen - triggerIndex, bufLen >> 1);
        const step = available / POINTS_PER_ROW;
        const live = livePoints.current;
        for (let i = 0; i < POINTS_PER_ROW; i++) {
          live[i] = (buf[triggerIndex + ((i * step) | 0)] - 128) / 128;
        }
        hasLive = true;

        // Capture row snapshots only when active (not paused by drawer expand)
        if (activeGateRef.current && now - lastCapture.current >= CAPTURE_INTERVAL_MS) {
          lastCapture.current = now;
          rows.current.push({ points: new Float32Array(live), birth: now });
        }
      }

      // Prune expired rows (advance head index instead of shift)
      const cutoff = now - LIFETIME_MS;
      const allRows = rows.current;
      const head = rowHead.current;
      let newHead = head;
      while (newHead < allRows.length && allRows[newHead].birth < cutoff) {
        newHead++;
      }
      // Compact periodically to avoid unbounded growth
      if (newHead > 100) {
        allRows.splice(0, newHead);
        newHead = 0;
      }
      rowHead.current = newHead;

      // Determine if we need a progress gradient
      const needsGrad = prog > 0 && prog < 1;

      // Cache/reuse the base gradient shape (only depends on prog and w)
      if (needsGrad) {
        const gc = gradCache.current;
        if (Math.abs(gc.prog - prog) > 0.003 || gc.w !== w) {
          const grad = ctx.createLinearGradient(0, 0, w, 0);
          const stopProg = Math.max(0, prog - 0.002);
          // Use alpha=1 as base — we'll scale per-row via globalAlpha
          grad.addColorStop(0, "rgba(255,255,255,1)");
          grad.addColorStop(stopProg, "rgba(255,255,255,1)");
          grad.addColorStop(prog, "rgba(255,255,255,0.25)");
          grad.addColorStop(1, "rgba(255,255,255,0.25)");
          gc.grad = grad;
          gc.prog = prog;
          gc.w = w;
        }
      }

      // Draw drifting rows (back-to-front: oldest first, newest last)
      const travel = h * TRAVEL_FRAC;
      const len = allRows.length;
      ctx.fillStyle = "rgb(0,0,0)";

      for (let r = newHead; r < len; r++) {
        const { points, birth } = allRows[r];
        const age = (now - birth) / LIFETIME_MS;
        const opacity = MAX_OPACITY * (1 - age);

        // Skip rows that have faded below visible threshold
        if (opacity < 0.01) continue;

        const y = spawnY - age * travel;

        // Fill closed path to occlude older rows
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let i = 0; i < POINTS_PER_ROW; i++) {
          ctx.lineTo(i * sliceW, y - points[i] * ENVELOPE[i] * AMPLITUDE);
        }
        ctx.lineTo((POINTS_PER_ROW - 1) * sliceW, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.globalAlpha = fadeRef.current;
        ctx.fill();

        // Stroke waveform curve only (no closing edges)
        ctx.beginPath();
        for (let i = 0; i < POINTS_PER_ROW; i++) {
          const px = i * sliceW;
          const py = y - points[i] * ENVELOPE[i] * AMPLITUDE;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }

        if (needsGrad) {
          ctx.globalAlpha = opacity * fadeRef.current;
          ctx.strokeStyle = gradCache.current.grad!;
        } else {
          ctx.globalAlpha = fadeRef.current;
          ctx.strokeStyle = opacityStr(opacity);
        }

        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      // Draw live line at spawn point
      if (hasLive) {
        const live = livePoints.current;
        // Fill closed path to occlude rows behind live line
        ctx.beginPath();
        ctx.moveTo(0, spawnY);
        for (let i = 0; i < POINTS_PER_ROW; i++) {
          ctx.lineTo(i * sliceW, spawnY - live[i] * ENVELOPE[i] * AMPLITUDE);
        }
        ctx.lineTo((POINTS_PER_ROW - 1) * sliceW, h);
        ctx.lineTo(0, h);
        ctx.closePath();
        ctx.globalAlpha = fadeRef.current;
        ctx.fill();

        // Stroke live waveform curve only
        ctx.beginPath();
        for (let i = 0; i < POINTS_PER_ROW; i++) {
          const px = i * sliceW;
          const py = spawnY - live[i] * ENVELOPE[i] * AMPLITUDE;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }

        if (needsGrad) {
          ctx.globalAlpha = MAX_OPACITY * fadeRef.current;
          ctx.strokeStyle = gradCache.current.grad!;
        } else {
          ctx.globalAlpha = fadeRef.current;
          ctx.strokeStyle = opacityStr(MAX_OPACITY);
        }
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        ctx.globalAlpha = fadeRef.current;
        ctx.beginPath();
        ctx.moveTo(0, spawnY);
        ctx.lineTo(w, spawnY);
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: "block" }}
    />
  );
}
