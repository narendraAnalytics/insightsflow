"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { motion, useReducedMotion } from "framer-motion";
import { X } from "@phosphor-icons/react";
import { EASE_OUT } from "@/lib/motion";

const DEMO_VIDEO =
  "https://res.cloudinary.com/dkqbzwicr/video/upload/v1791442938/insightflowvideo_hxuxmb.webm";

/**
 * "See how it works" video. A portrait (4:5) walkthrough in a dialog: it plays with sound as soon
 * as it opens (the click that opened it counts as the user gesture), and closing unmounts the
 * <video>, so it stops playing and stops downloading. Esc, the backdrop and the X all close it.
 * base-ui's Dialog supplies the focus trap, scroll lock and focus return to the trigger.
 */
export function DemoVideoModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const reduce = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  // Each opening starts from a fresh loading state and the first frame.
  useEffect(() => {
    if (open) setReady(false);
  }, [open]);

  // Start playback explicitly: if the browser refuses sound-on autoplay, the visible controls
  // let the visitor press play themselves.
  useEffect(() => {
    if (!open) return;
    const video = videoRef.current;
    if (!video) return;
    video.play().catch(() => {
      /* autoplay with sound was blocked: controls stay available */
    });
  }, [open]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          data-lenis-prevent
          className="fixed inset-0 z-[110] duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
          style={{
            backgroundImage:
              "radial-gradient(60% 50% at 25% 15%, color-mix(in oklab, var(--flow-pink) 45%, transparent), transparent 70%)," +
              "radial-gradient(55% 50% at 80% 85%, color-mix(in oklab, var(--flow-amber) 40%, transparent), transparent 70%)," +
              "color-mix(in oklab, var(--flow-ink) 78%, transparent)",
            backdropFilter: "blur(10px)",
          }}
        />
        <DialogPrimitive.Popup
          data-lenis-prevent
          initialFocus={videoRef}
          aria-label="InsightFlow in 48 seconds"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          className="fixed top-1/2 left-1/2 z-[110] -translate-x-1/2 -translate-y-1/2 outline-none data-closed:animate-out data-closed:fade-out-0 data-closed:duration-150"
          // 4:5 card that always fits the screen: as wide as 90% of the height allows, never wider than the viewport.
          style={{ width: "min(calc(100vw - 2rem), calc(90svh * 0.8), 560px)" }}
        >
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 36, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            className="relative aspect-[4/5] w-full overflow-hidden rounded-[28px] bg-flow-ink"
            style={{
              boxShadow:
                "0 0 0 4px color-mix(in oklab, var(--flow-cream) 85%, transparent), 0 40px 90px -20px color-mix(in oklab, var(--flow-magenta) 60%, transparent)",
            }}
          >
            {open && (
              <video
                ref={videoRef}
                className="absolute inset-0 h-full w-full object-contain"
                src={DEMO_VIDEO}
                controls
                autoPlay
                playsInline
                preload="auto"
                controlsList="nodownload noplaybackrate"
                disablePictureInPicture
                onLoadedData={() => setReady(true)}
                onPlaying={() => setReady(true)}
              />
            )}

            {/* Loading shimmer until the first frame arrives. */}
            {!ready && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, color-mix(in oklab, var(--flow-pink) 40%, var(--flow-ink)), color-mix(in oklab, var(--flow-amber) 35%, var(--flow-ink)))",
                }}
              >
                <span className="size-12 animate-spin rounded-full border-4 border-(--flow-cream)/30 border-t-(--flow-cream)" />
              </div>
            )}

            <DialogPrimitive.Close
              aria-label="Close video"
              className="absolute top-3 right-3 z-10 flex size-11 items-center justify-center rounded-full bg-(--flow-cream) text-(--flow-ink) shadow-[0_6px_24px_-6px_color-mix(in_oklab,var(--flow-ink)_60%,transparent)] transition-[transform,background-color] duration-200 hover:scale-105 hover:bg-(--flow-peach) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--flow-cream) active:scale-95"
            >
              <X weight="bold" className="size-5" />
            </DialogPrimitive.Close>
          </motion.div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
