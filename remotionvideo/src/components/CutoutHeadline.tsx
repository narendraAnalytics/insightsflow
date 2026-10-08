import React from 'react';
import {interpolate, spring, useVideoConfig} from 'remotion';
import {anton, C, fraunces} from '../theme';
import {PaperStrip, useTwos} from './Paper';

export type Word = {text: string; bg: string; color?: string; italic?: boolean; rot?: number};

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/**
 * Wavy felt-tip underline, wiped on left to right. (A dash-offset draw breaks with
 * non-scaling strokes, so the reveal is a clip instead.)
 */
const Underline: React.FC<{progress: number}> = ({progress}) => (
  <svg
    viewBox="0 0 300 30"
    preserveAspectRatio="none"
    style={{
      position: 'absolute',
      left: '4%',
      bottom: -26,
      width: '92%',
      height: 30,
      overflow: 'visible',
      clipPath: `inset(-40px ${(1 - progress) * 100}% -40px -20px)`,
    }}
  >
    <path d="M4 18 C 50 6, 90 28, 140 16 S 230 6, 296 14" fill="none" stroke={C.marker} strokeWidth={9} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
  </svg>
);

/** Words pop in one by one like paper letters slapped onto a board (animated on twos). */
export const CutoutHeadline: React.FC<{
  words: Word[];
  fontSize?: number;
  delay?: number;
  seed: string;
  align?: 'flex-start' | 'center';
}> = ({words, fontSize = 118, delay = 0, seed, align = 'flex-start'}) => {
  const frame = useTwos();
  const {fps} = useVideoConfig();
  const last = words.length - 1;
  return (
    <div style={{display: 'flex', flexWrap: 'wrap', gap: '6px 14px', justifyContent: align}}>
      {words.map((w, i) => {
        const start = delay + i * 6;
        const s = spring({frame: frame - start, fps, config: {damping: 11, stiffness: 150, mass: 0.7}});
        // the italic "punchline" word gets underlined once every word has landed
        const underline = w.italic ? interpolate(frame, [delay + last * 6 + 16, delay + last * 6 + 30], [0, 1], clamp) : 0;
        return (
          <div
            key={i}
            style={{
              position: 'relative',
              opacity: s > 0.01 ? 1 : 0,
              transform: `translateY(${(1 - s) * 90}px) scale(${0.55 + 0.45 * s}) rotate(${(w.rot ?? 0) * s}deg)`,
              fontFamily: w.italic ? fraunces : anton,
              fontStyle: w.italic ? 'italic' : 'normal',
              fontWeight: w.italic ? 700 : 400,
              fontSize: w.italic ? fontSize * 0.86 : fontSize,
              textTransform: w.italic ? 'none' : 'uppercase',
              lineHeight: 1,
            }}
          >
            <PaperStrip bg={w.bg} color={w.color} seed={`${seed}-${i}`}>
              {w.text}
            </PaperStrip>
            {w.italic ? <Underline progress={underline} /> : null}
          </div>
        );
      })}
    </div>
  );
};
