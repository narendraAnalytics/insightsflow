"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const SHOW_DELAY = 140;
const GAP = 10;
const EDGE = 8;

type Tip = { text: string; rect: DOMRect };
type Pos = { left: number; top: number; arrow: number; below: boolean };

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), Math.max(lo, hi));

/**
 * Replaces the browser's native black/white `title` bubble everywhere in the dashboard with one
 * themed tooltip. On hover or keyboard focus the `title` is lifted off the element (so the native
 * bubble never shows) and put back when the pointer leaves, so assistive tech still sees it.
 * Short labels use the handwriting face like the sidebar; sentences use the readable body face.
 */
export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let current: HTMLElement | null = null;
    // Every titled element from the hovered one up to the root. All of them are lifted, not just
    // the nearest: a titled parent would otherwise show its native bubble the moment the child's
    // title is gone, and two tooltips would stack.
    let stashed: [HTMLElement, string][] = [];

    const restore = () => {
      for (const [el, text] of stashed) if (!el.hasAttribute("title")) el.setAttribute("title", text);
      stashed = [];
      current = null;
    };
    const hide = () => {
      clearTimeout(timer);
      restore();
      setTip(null);
      setPos(null);
    };
    const enter = (el: HTMLElement) => {
      if (el === current) return;
      hide();
      const text = el.getAttribute("title");
      if (!text || !text.trim()) return;
      current = el;
      for (let node: HTMLElement | null = el; node; node = node.parentElement) {
        const t = node.getAttribute("title");
        if (t === null) continue;
        stashed.push([node, t]);
        node.removeAttribute("title");
      }
      timer = setTimeout(() => setTip({ text, rect: el.getBoundingClientRect() }), SHOW_DELAY);
    };
    const target = (e: Event) => {
      const el = (e.target as Element | null)?.closest?.("[title]");
      return el instanceof HTMLElement ? el : null;
    };

    const onOver = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const el = target(e);
      if (el) enter(el);
    };
    const onOut = (e: PointerEvent) => {
      const rel = e.relatedTarget as Node | null;
      if (current && rel && current.contains(rel)) return;
      hide();
    };
    const onFocusIn = (e: FocusEvent) => {
      const el = target(e);
      if (el) enter(el);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };

    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", hide);
    document.addEventListener("pointerdown", hide);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("blur", hide);
    return () => {
      clearTimeout(timer);
      restore();
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("pointerdown", hide);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("blur", hide);
    };
  }, []);

  // Measure after the first paint of the hidden bubble, then place it above (or below if no room).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!tip || !el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const r = tip.rect;
    const center = r.left + r.width / 2;
    const left = clamp(center - w / 2, EDGE, window.innerWidth - w - EDGE);
    const below = r.top - h - GAP < EDGE;
    setPos({
      left,
      top: below ? r.bottom + GAP : r.top - h - GAP,
      arrow: clamp(center - left, 16, w - 16),
      below,
    });
  }, [tip]);

  if (!tip) return null;
  const short = tip.text.length <= 26;

  return (
    <div
      ref={ref}
      role="tooltip"
      className={`pointer-events-none fixed z-[300] rounded-2xl text-(--flow-cream) ${
        short
          ? "px-3.5 py-1.5 font-(family-name:--font-zeyada) text-[22px] leading-none whitespace-nowrap"
          : "max-w-[260px] px-3.5 py-2 text-[13px] leading-snug font-medium tracking-[0.005em]"
      }`}
      style={{
        left: pos?.left ?? 0,
        top: pos?.top ?? 0,
        opacity: pos ? 1 : 0,
        transform: pos ? "translateY(0) scale(1)" : `translateY(${pos ? 0 : 4}px) scale(0.96)`,
        transformOrigin: pos?.below ? "top center" : "bottom center",
        transition: "opacity 160ms ease, transform 200ms cubic-bezier(0.16, 1, 0.3, 1)",
        backgroundImage:
          "linear-gradient(120deg, var(--flow-magenta), color-mix(in oklab, var(--flow-magenta) 55%, var(--flow-pink)))",
        boxShadow:
          "0 14px 30px -12px color-mix(in oklab, var(--flow-magenta) 70%, transparent), inset 0 1px 0 rgb(255 255 255 / 0.22)",
      }}
    >
      {tip.text}
      <span
        aria-hidden
        className="absolute size-2.5 rotate-45 rounded-[3px]"
        style={{
          left: (pos?.arrow ?? 16) - 5,
          [pos?.below ? "top" : "bottom"]: -4,
          background: "color-mix(in oklab, var(--flow-magenta) 78%, var(--flow-pink))",
        }}
      />
    </div>
  );
}
