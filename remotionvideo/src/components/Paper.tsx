import React from 'react';
import {AbsoluteFill, random, useCurrentFrame} from 'remotion';
import {C, W, H} from '../theme';

/** Torn-edge polygon (percent coordinates), deterministic per seed. */
export const tornPolygon = (seed: string, steps = 14, amp = 3.2) => {
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * 100;
    top.push(`${x}% ${random(`${seed}t${i}`) * amp}%`);
    bottom.push(`${100 - x}% ${100 - random(`${seed}b${i}`) * amp}%`);
  }
  return `polygon(${[...top, ...bottom].join(',')})`;
};

/**
 * The current frame "on twos": graphics update every second frame (15 fps inside the 30 fps
 * video), the stuttered look Vox uses for its collage graphics. Screen recordings stay smooth.
 */
export const useTwos = (offset = 0) => Math.floor(useCurrentFrame() / 2) * 2 - offset;

/** Stop-motion wobble: jitter that only updates every few frames. */
export const useWobble = (seed: string, amount = 1.2, every = 4) => {
  const frame = useCurrentFrame();
  const step = Math.floor(frame / every);
  return (random(`${seed}${step}`) - 0.5) * 2 * amount;
};

/** A word or line on a torn paper strip with a hard drop shadow. */
export const PaperStrip: React.FC<{
  children: React.ReactNode;
  bg: string;
  color?: string;
  seed: string;
  style?: React.CSSProperties;
  wobble?: number;
}> = ({children, bg, color = C.ink, seed, style, wobble = 1}) => {
  const w = useWobble(seed, wobble);
  return (
    <div style={{filter: 'drop-shadow(0 7px 0 rgba(42,18,23,0.22))', transform: `rotate(${w}deg)`, ...style}}>
      <div style={{background: bg, color, clipPath: tornPolygon(seed), padding: '0.12em 0.34em 0.18em'}}>
        {children}
      </div>
    </div>
  );
};

/** Warm paper grain + vignette over everything. */
export const Grain: React.FC = () => (
  <AbsoluteFill style={{pointerEvents: 'none', mixBlendMode: 'multiply', opacity: 0.5}}>
    <svg width={W} height={H}>
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
        <feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.28  0 0 0 0 0.2  0 0 0 0.55 0" />
      </filter>
      <rect width={W} height={H} filter="url(#grain)" />
    </svg>
  </AbsoluteFill>
);

/** Halftone dot field, fades out along one direction. */
export const Halftone: React.FC<{color: string; style?: React.CSSProperties}> = ({color, style}) => (
  <div
    style={{
      position: 'absolute',
      backgroundImage: `radial-gradient(${color} 32%, transparent 34%)`,
      backgroundSize: '22px 22px',
      WebkitMaskImage: 'linear-gradient(135deg, black 0%, transparent 70%)',
      maskImage: 'linear-gradient(135deg, black 0%, transparent 70%)',
      ...style,
    }}
  />
);

export const Tape: React.FC<{style?: React.CSSProperties}> = ({style}) => (
  <div
    style={{
      position: 'absolute',
      width: 150,
      height: 46,
      background: 'rgba(255, 235, 170, 0.78)',
      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
      clipPath: tornPolygon(`tape${style?.left ?? ''}${style?.right ?? ''}`, 6, 10),
      ...style,
    }}
  />
);
