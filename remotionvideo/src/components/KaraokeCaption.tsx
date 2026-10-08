import React from 'react';
import {interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {bricolage, C} from '../theme';
import {tornPolygon, useWobble} from './Paper';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/**
 * Burned-in caption that follows the narration word by word (about 80% of LinkedIn video is
 * watched muted). We have no word timestamps from the TTS, so each word's start is estimated
 * from its share of the line's characters, with a little extra weight after punctuation for the
 * pause. Close, not exact.
 */
export const KaraokeCaption: React.FC<{text: string; seconds: number; lead: number; seed: string; style?: React.CSSProperties}> = ({
  text,
  seconds,
  lead,
  seed,
  style,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const wob = useWobble(seed, 0.8);
  const words = text.split(' ');
  const weights = words.map((w) => w.length + 1 + (/[.,?!]$/.test(w) ? 4 : 0));
  const total = weights.reduce((a, b) => a + b, 0);
  const spoken = seconds * fps * 0.94; // TTS files end with a short silence
  let acc = 0;
  const starts = weights.map((w) => {
    const s = lead + (acc / total) * spoken;
    acc += w;
    return s;
  });
  let current = -1;
  starts.forEach((s, i) => {
    if (frame >= s) current = i;
  });
  const reveal = interpolate(frame, [2, 10], [0, 100], clamp);

  return (
    <div style={{position: 'absolute', transform: `rotate(${0.8 + wob}deg)`, filter: 'drop-shadow(0 7px 0 rgba(42,18,23,0.22))', ...style}}>
      <div style={{clipPath: `inset(0 ${100 - reveal}% 0 0)`}}>
        <div
          style={{
            clipPath: tornPolygon(seed, 18, 2.4),
            background: C.cream,
            padding: '24px 32px 28px',
            fontFamily: bricolage,
            fontWeight: 600,
            fontSize: 44,
            lineHeight: 1.22,
            color: C.ink,
          }}
        >
          {words.map((w, i) => (
            <span
              key={i}
              style={{
                display: 'inline-block',
                marginRight: '0.26em',
                padding: '0 0.08em',
                borderRadius: 6,
                opacity: i <= current ? 1 : 0.32,
                background: i === current ? C.amber : 'transparent',
                transform: i === current ? 'rotate(-1.5deg) scale(1.04)' : 'none',
              }}
            >
              {w}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
