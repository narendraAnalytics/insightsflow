import React from 'react';
import {interpolate} from 'remotion';
import {useTwos} from './Paper';
import {caveat, C} from '../theme';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** Handwritten note with a hand-drawn arrow that draws itself on. */
export const Note: React.FC<{text: string; delay: number; style?: React.CSSProperties}> = ({text, delay, style}) => {
  const frame = useTwos();
  const t = interpolate(frame, [delay, delay + 16], [0, 1], clamp);
  const draw = interpolate(frame, [delay + 8, delay + 28], [1, 0], clamp);
  const head = interpolate(frame, [delay + 24, delay + 32], [1, 0], clamp);
  return (
    <div
      style={{
        position: 'absolute',
        opacity: t,
        fontFamily: caveat,
        fontSize: 54,
        fontWeight: 700,
        color: C.ink,
        lineHeight: 1,
        transform: 'rotate(-5deg)',
        ...style,
      }}
    >
      {text}
      <svg width="130" height="90" viewBox="0 0 130 90" style={{position: 'absolute', left: -110, top: -62, overflow: 'visible'}}>
        <path
          d="M118 78 C 70 80, 30 62, 20 14"
          fill="none"
          stroke={C.ink}
          strokeWidth="5"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={draw}
        />
        <path
          d="M4 30 L20 10 L38 26"
          fill="none"
          stroke={C.ink}
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={head}
        />
      </svg>
    </div>
  );
};
