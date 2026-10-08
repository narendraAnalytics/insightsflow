import React from 'react';
import {AbsoluteFill, interpolate, random} from 'remotion';
import {anton, caveat, C, fraunces, bricolage} from '../theme';
import {Grain, Halftone, PaperStrip, useTwos} from '../components/Paper';

const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** Frames the hook stays fully on screen before it rips away. */
export const HOOK_FRAMES = 44;

const ROWS: {text: string; bg: string; color: string; rot: number; italic?: boolean}[] = [
  {text: 'Still', bg: C.cream, color: C.ink, rot: -2},
  {text: 'building', bg: C.amber, color: C.ink, rot: 1.5},
  {text: 'reports', bg: C.pink, color: C.cream, rot: -1.5},
  {text: 'by hand?', bg: C.mint, color: C.ink, rot: 2, italic: true},
];

/** Jagged bottom edge so the page reads as torn paper while it rips upward. */
const tornBottom = () => {
  const pts = ['0% 0%', '100% 0%'];
  for (let i = 0; i <= 20; i++) pts.push(`${100 - i * 5}% ${100 - random(`hk${i}`) * 3.5}%`);
  return `polygon(${pts.join(',')})`;
};

/**
 * The scroll-stopper: complete on frame 0 (so it is also LinkedIn's auto thumbnail), then a red
 * strike through "by hand?", a handwritten answer, and the whole page rips up and away.
 * `frozenAt` renders a fixed moment, used for the cover still.
 */
export const HookCard: React.FC<{frozenAt?: number; ripAway?: boolean; showAnswer?: boolean}> = ({frozenAt, ripAway = true, showAnswer = true}) => {
  const live = useTwos();
  const frame = frozenAt ?? live;
  const strike = interpolate(frame, [10, 20], [0, 1], clamp);
  const answer = showAnswer ? interpolate(frame, [18, 26], [0, 1], clamp) : 0;
  const rip = ripAway ? interpolate(frame, [32, HOOK_FRAMES], [0, 1], {...clamp, easing: (t) => t * t}) : 0;
  return (
    <AbsoluteFill
      style={{
        transform: `translateY(${-rip * 1500}px) rotate(${-rip * 7}deg)`,
        transformOrigin: '30% 100%',
        clipPath: ripAway ? tornBottom() : undefined,
      }}
    >
      <AbsoluteFill style={{background: C.ink}} />
      <Halftone color="rgba(255,200,87,0.28)" style={{right: -40, top: -40, width: 640, height: 560}} />
      <Halftone color="rgba(224,69,123,0.3)" style={{left: -50, bottom: -30, width: 560, height: 480, transform: 'scale(-1,-1)'}} />

      <div style={{position: 'absolute', left: 70, top: 96}}>
        <PaperStrip bg={C.marker} color={C.cream} seed="hk-top" style={{fontFamily: bricolage, fontWeight: 600, fontSize: 34, letterSpacing: 4, textTransform: 'uppercase'}}>
          Run a business?
        </PaperStrip>
      </div>

      <div style={{position: 'absolute', left: 70, top: 210, display: 'flex', flexDirection: 'column', gap: 22, alignItems: 'flex-start'}}>
        {ROWS.map((r, i) => (
          <div key={r.text} style={{position: 'relative', transform: `rotate(${r.rot}deg)`}}>
            <PaperStrip
              bg={r.bg}
              color={r.color}
              seed={`hk${i}`}
              style={{
                fontFamily: r.italic ? fraunces : anton,
                fontStyle: r.italic ? 'italic' : 'normal',
                fontWeight: r.italic ? 700 : 400,
                fontSize: r.italic ? 150 : 172,
                textTransform: r.italic ? 'none' : 'uppercase',
                lineHeight: 1,
              }}
            >
              {r.text}
            </PaperStrip>
            {r.italic ? (
              <svg
                viewBox="0 0 100 20"
                preserveAspectRatio="none"
                style={{
                  position: 'absolute',
                  left: '-4%',
                  top: '38%',
                  width: '108%',
                  height: 60,
                  overflow: 'visible',
                  clipPath: `inset(-40px ${(1 - strike) * 100}% -40px -20px)`,
                }}
              >
                <path d="M2 14 C 30 6, 60 16, 98 4" fill="none" stroke={C.marker} strokeWidth={14} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </svg>
            ) : null}
          </div>
        ))}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 80,
          top: 1170,
          fontFamily: caveat,
          fontWeight: 700,
          fontSize: 76,
          color: C.amber,
          opacity: answer,
          transform: `rotate(-4deg) translateY(${(1 - answer) * 20}px)`,
        }}
      >
        there's a faster way ↓
      </div>
      <Grain />
    </AbsoluteFill>
  );
};
