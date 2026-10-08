import React from 'react';
import {interpolate, OffthreadVideo, spring, staticFile, useVideoConfig} from 'remotion';
import {bricolage, C} from '../theme';
import {PaperStrip, useTwos} from './Paper';
import {CARD} from './ScreenCard';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export type CalloutSpec = {
  /** source video size in pixels */
  srcSize: [number, number];
  /** point of interest, in source-video pixels */
  target: [number, number];
  /** scene frames the callout is on screen (pick a window where the target holds still) */
  from: number;
  to: number;
  /** centre of the magnifier card, in canvas pixels */
  lens: [number, number];
  /** magnification relative to the clip as drawn on the card */
  zoom: number;
  /** marker ellipse radii around the target, in canvas pixels */
  ring: [number, number];
  label: string;
  /** label on the lens's bottom edge (default, clears the star sticker) or top edge */
  labelAt?: 'top' | 'bottom';
};

const LENS_W = 420;
const LENS_H = 250;

/** Where a source pixel lands on the canvas, matching ScreenCard's cover-fit and tilt. */
const project = (srcW: number, srcH: number, [sx, sy]: [number, number]) => {
  const innerW = CARD.width - CARD.pad * 2;
  const innerH = CARD.height - CARD.pad * 2;
  const s = Math.max(innerW / srcW, innerH / srcH);
  const ox = CARD.left + CARD.pad + (innerW - srcW * s) / 2;
  const oy = CARD.top + CARD.pad + (innerH - srcH * s) / 2;
  const x = ox + sx * s;
  const y = oy + sy * s;
  // rotate about the card centre by the card's resting tilt
  const cx = CARD.left + CARD.width / 2;
  const cy = CARD.top + CARD.height / 2;
  const a = (CARD.tilt * Math.PI) / 180;
  return {
    scale: s,
    x: cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a),
    y: cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a),
  };
};

/** A hand-drawn loop, slightly overshooting like a real marker circle. */
const ringPath = (cx: number, cy: number, rx: number, ry: number) => {
  const pts: string[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = -0.35 + (i / 48) * (Math.PI * 2 + 0.7);
    const wob = 1 + Math.sin(i * 1.7) * 0.03 + (i / 48) * 0.08;
    pts.push(`${(cx + Math.cos(t) * rx * wob).toFixed(1)} ${(cy + Math.sin(t) * ry * wob).toFixed(1)}`);
  }
  return `M${pts.join(' L')}`;
};

/**
 * Vox-style callout: a red marker ring on the target, a connector that draws on, then a
 * magnifier card showing the same clip zoomed in, with a paper label. The clip stays uncropped
 * on the card; the zoom is added on top.
 */
export const Callout: React.FC<{spec: CalloutSpec; src: string; startSec: number; rate: number}> = ({spec, src, startSec, rate}) => {
  const frame = useTwos();
  const {fps} = useVideoConfig();
  const {srcSize, target, from, to, lens, zoom, ring, label} = spec;
  if (frame < from - 16 || frame > to + 12) return null;

  const p = project(srcSize[0], srcSize[1], target);
  const ringIn = interpolate(frame, [from - 16, from - 4], [0, 1], clamp);
  const lineIn = interpolate(frame, [from - 6, from + 2], [0, 1], clamp);
  const pop = spring({frame: frame - from, fps, config: {damping: 10, stiffness: 160, mass: 0.7}});
  const out = interpolate(frame, [to, to + 10], [1, 0], clamp);
  const lensScale = pop * out;

  // connector: from the ring's edge toward the lens, ending at the lens edge
  const dx = lens[0] - p.x;
  const dy = lens[1] - p.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const x1 = p.x + ux * ring[0] * 0.9;
  const y1 = p.y + uy * ring[1] * 0.9;
  const edge = Math.min(LENS_W / 2 / Math.abs(ux || 1e-6), LENS_H / 2 / Math.abs(uy || 1e-6));
  const x2 = lens[0] - ux * (edge + 6);
  const y2 = lens[1] - uy * (edge + 6);
  const bend = 40;
  const path = `M${x1} ${y1} Q${(x1 + x2) / 2 - uy * bend} ${(y1 + y2) / 2 + ux * bend} ${x2} ${y2}`;

  // zoomed copy of the clip, positioned so the target sits in the lens centre
  const z = p.scale * zoom;
  const vw = srcSize[0] * z;
  const vh = srcSize[1] * z;

  return (
    <>
      <svg width={1080} height={1350} style={{position: 'absolute', left: 0, top: 0, opacity: out, overflow: 'visible'}}>
        <path
          d={ringPath(p.x, p.y, ring[0], ring[1])}
          fill="none"
          stroke={C.marker}
          strokeWidth={8}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - ringIn}
        />
        <path
          d={path}
          fill="none"
          stroke={C.marker}
          strokeWidth={6}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - lineIn}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: lens[0] - LENS_W / 2,
          top: lens[1] - LENS_H / 2,
          width: LENS_W,
          height: LENS_H,
          transform: `scale(${lensScale}) rotate(${1.5 * lensScale}deg)`,
          opacity: lensScale > 0.02 ? 1 : 0,
          filter: 'drop-shadow(0 14px 0 rgba(42,18,23,0.3))',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: 34,
            border: `10px solid ${C.white}`,
            outline: `5px solid ${C.marker}`,
            overflow: 'hidden',
            position: 'relative',
            background: C.cream,
            boxSizing: 'border-box',
          }}
        >
          <OffthreadVideo
            src={staticFile(src)}
            muted
            trimBefore={Math.round(startSec * fps)}
            playbackRate={rate}
            style={{
              position: 'absolute',
              width: vw,
              height: vh,
              maxWidth: 'none',
              left: LENS_W / 2 - 10 - target[0] * z,
              top: LENS_H / 2 - 10 - target[1] * z,
            }}
          />
        </div>
        <div style={{position: 'absolute', left: 18, top: spec.labelAt === 'top' ? -46 : LENS_H - 18, transform: 'rotate(-3deg)'}}>
          <PaperStrip bg={C.amber} seed={`lbl${label}`} style={{fontFamily: bricolage, fontWeight: 600, fontSize: 30, whiteSpace: 'nowrap'}}>
            {label}
          </PaperStrip>
        </div>
      </div>
    </>
  );
};
