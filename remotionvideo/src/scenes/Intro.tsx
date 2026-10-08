import React from 'react';
import {AbsoluteFill, interpolate, spring, useVideoConfig} from 'remotion';
import {anton, bricolage, fraunces, C} from '../theme';
import {Office} from '../components/Office';
import {Grain, PaperStrip, useTwos} from '../components/Paper';
import {HookCard, HOOK_FRAMES} from './Hook';

const ROWS = [
  {text: 'Ask', bg: C.pink, color: C.cream, rot: -3},
  {text: 'Approve', bg: C.amber, color: C.ink, rot: 2.5},
  {text: 'Alert', bg: C.mint, color: C.ink, rot: -2},
];

export const Intro: React.FC = () => {
  // everything below starts as the hook card rips away
  const frame = useTwos(HOOK_FRAMES - 10);
  const {fps} = useVideoConfig();
  const tag = interpolate(frame, [58, 76], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const top = spring({frame, fps, config: {damping: 14}});
  return (
    <AbsoluteFill>
      <Office color={C.cream} seed="oi" />

      <div style={{position: 'absolute', left: 70, top: 110, transform: `translateY(${(1 - top) * -60}px)`, opacity: top}}>
        <PaperStrip
          bg={C.ink}
          color={C.cream}
          seed="intro-top"
          style={{fontFamily: bricolage, fontWeight: 600, fontSize: 36, letterSpacing: 4, textTransform: 'uppercase'}}
        >
          Your sheets already know
        </PaperStrip>
      </div>
      <div style={{position: 'absolute', left: 70, top: 250, display: 'flex', flexDirection: 'column', gap: 26, alignItems: 'flex-start'}}>
        {ROWS.map((r, i) => {
          const s = spring({frame: frame - 12 - i * 14, fps, config: {damping: 10, stiffness: 160, mass: 0.8}});
          return (
            <div key={r.text} style={{opacity: s > 0.01 ? 1 : 0, transform: `translateX(${(1 - s) * -900}px) rotate(${r.rot}deg)`}}>
              <PaperStrip
                bg={r.bg}
                color={r.color}
                seed={`intro${i}`}
                style={{fontFamily: anton, fontSize: 190, textTransform: 'uppercase', lineHeight: 1}}
              >
                {r.text}.
              </PaperStrip>
            </div>
          );
        })}
      </div>
      <div style={{position: 'absolute', left: 60, right: 60, bottom: 22, opacity: tag, transform: `translateY(${(1 - tag) * 30}px)`}}>
        <div style={{fontFamily: anton, fontSize: 54, color: C.cream, letterSpacing: 1, lineHeight: 1.05}}>
          Insight<span style={{color: C.amber}}>Flow</span>
        </div>
        <div style={{fontFamily: fraunces, fontStyle: 'italic', fontWeight: 700, fontSize: 32, color: C.cream, marginTop: 2}}>
          the AI analyst for your business data.
        </div>
      </div>
      <Grain />
      <HookCard />
    </AbsoluteFill>
  );
};
