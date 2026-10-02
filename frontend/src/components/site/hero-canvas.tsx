"use client";

import { useEffect, useRef } from "react";
import type { MotionValue } from "framer-motion";

export const FRAME_COUNT = 240;
const STILL_FRAME = FRAME_COUNT - 1;
const frameSrc = (i: number) => `/hero-frames/f${String(i + 1).padStart(4, "0")}.webp`;

/** Coarse-to-fine load order: first, last, then every 48th, 16th, 8th ... so a
 *  fast scroll always finds a nearby frame instead of a gap. */
function loadOrder(): number[] {
  const seen = new Set<number>([0, FRAME_COUNT - 1]);
  const order = [0, FRAME_COUNT - 1];
  for (const step of [48, 16, 8, 4, 2, 1]) {
    for (let i = 0; i < FRAME_COUNT; i += step) {
      if (!seen.has(i)) {
        seen.add(i);
        order.push(i);
      }
    }
  }
  return order;
}

/**
 * Draws one frame of a pre-rendered image sequence onto a canvas for the
 * current scroll progress (0..1). Frames stream in coarse-to-fine; until the
 * exact frame has arrived the nearest loaded one is shown. With `progress`
 * omitted it paints a single still (reduced-motion fallback).
 */
export function HeroCanvas({ progress, className }: { progress?: MotionValue<number>; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const frames: (HTMLImageElement | undefined)[] = [];
    let want = progress ? Math.round(progress.get() * (FRAME_COUNT - 1)) : STILL_FRAME;
    let zoom = progress ? progress.get() : 1;
    let queued = false;
    let disposed = false;

    const draw = () => {
      queued = false;
      let idx = -1;
      for (let d = 0; d < FRAME_COUNT; d++) {
        if (frames[want - d]) {
          idx = want - d;
          break;
        }
        if (frames[want + d]) {
          idx = want + d;
          break;
        }
      }
      const img = idx >= 0 ? frames[idx] : undefined;
      if (!img || !canvas.width) return;

      const cw = canvas.width;
      const ch = canvas.height;
      const push = 1 + 0.06 * zoom; // slow push-in across the whole scroll
      const portrait = cw < ch * 0.9;
      // landscape: cover the stage. portrait: fit the picture into the upper part so
      // the text below never sits on the subject.
      const base = portrait ? (ch * 0.58) / img.naturalHeight : Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
      const scale = base * push;
      const w = img.naturalWidth * scale;
      const h = img.naturalHeight * scale;
      const dx = (cw - w) * (portrait ? 0.55 : 0.5);
      const dy = portrait ? ch * 0.1 - (h - ch * 0.58) / 2 : (ch - h) / 2;
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(img, dx, dy, w, h);
    };
    const schedule = () => {
      if (queued || disposed) return;
      queued = true;
      requestAnimationFrame(draw);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.min(Math.round(rect.width * dpr), 1920);
      canvas.height = Math.round(canvas.width * (rect.height / Math.max(rect.width, 1)));
      schedule();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    const order = progress ? loadOrder() : [STILL_FRAME];
    let next = 0;
    const worker = async () => {
      while (!disposed && next < order.length) {
        const i = order[next++];
        await new Promise<void>((resolve) => {
          const img = new Image();
          img.decoding = "async";
          img.onload = () => {
            frames[i] = img;
            schedule();
            resolve();
          };
          img.onerror = () => resolve();
          img.src = frameSrc(i);
        });
      }
    };
    // first frames get the whole pipe; the rest follows in parallel workers
    for (let w = 0; w < 5; w++) void worker();

    const stop = progress?.on("change", (v) => {
      want = Math.round(v * (FRAME_COUNT - 1));
      zoom = v;
      schedule();
    });

    return () => {
      disposed = true;
      observer.disconnect();
      stop?.();
    };
  }, [progress]);

  return <canvas ref={canvasRef} aria-hidden="true" className={className} />;
}
