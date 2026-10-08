import React from 'react';
import {AbsoluteFill, interpolate, spring, useVideoConfig} from 'remotion';
import {Star} from '@remotion/shapes';
import {anton, bricolage, caveat, C} from '../theme';
import {Office} from '../components/Office';
import {Grain, PaperStrip, useTwos} from '../components/Paper';
import {CutoutHeadline} from '../components/CutoutHeadline';

const CHIPS = ['Google Sheets', 'Gmail', 'Slack', 'Notion'];
const clamp = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** LinkedIn ranks posts with outbound links lower, so the link goes in the first comment. */
const CommentsBadge: React.FC<{frame: number}> = ({frame}) => {
  const {fps} = useVideoConfig();
  const pop = spring({frame: frame - 60, fps, config: {damping: 8, stiffness: 140}});
  const pulse = 1 + Math.sin(frame / 4) * 0.04;
  const spin = Math.floor(frame / 3) * 6;
  const arrow = interpolate(frame, [70, 86], [1, 0], clamp);
  return (
    <>
      <div style={{position: 'absolute', right: 40, top: 560, width: 210, height: 210, transform: `scale(${pop * pulse}) rotate(8deg)`}}>
        <div style={{position: 'absolute', inset: 0, transform: `rotate(${spin}deg)`}}>
          <Star points={14} innerRadius={84} outerRadius={105} fill={C.amber} stroke={C.ink} strokeWidth={6} cornerRadius={4} />
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            fontFamily: anton,
            fontSize: 34,
            lineHeight: 1,
            color: C.ink,
            textTransform: 'uppercase',
          }}
        >
          Link in
          <br />
          comments
        </div>
      </div>
      <svg width={1080} height={1350} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: pop > 0.05 ? 1 : 0}}>
        <path d="M930 780 C 940 840, 900 860, 860 846" fill="none" stroke={C.cream} strokeWidth={8} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={arrow} />
        <path d="M878 826 L856 846 L882 862" fill="none" stroke={C.cream} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" opacity={arrow < 0.2 ? 1 : 0} />
      </svg>
    </>
  );
};

export const Outro: React.FC = () => {
  const frame = useTwos();
  const {fps} = useVideoConfig();
  const cta = spring({frame: frame - 44, fps, config: {damping: 8, stiffness: 130}});
  const pulse = 1 + Math.sin(frame / 5) * 0.025;
  return (
    <AbsoluteFill>
      <Office color={C.pink} seed="oo" />

      <div style={{position: 'absolute', left: 60, top: 150, width: 960}}>
        <CutoutHeadline
          seed="outro"
          fontSize={128}
          words={[
            {text: 'Ask', bg: C.cream, rot: -2},
            {text: 'your', bg: C.amber, rot: 2},
            {text: 'first', bg: C.mint, rot: -1.5},
            {text: 'question', bg: C.cream, rot: 1.5},
            {text: 'today.', bg: C.ink, color: C.cream, italic: true, rot: -2},
          ]}
        />
      </div>

      <div style={{position: 'absolute', left: 60, top: 700, display: 'flex', flexWrap: 'wrap', gap: 14, width: 960}}>
        {CHIPS.map((c, i) => {
          const s = spring({frame: frame - 28 - i * 5, fps, config: {damping: 12}});
          return (
            <div key={c} style={{opacity: s > 0.01 ? 1 : 0, transform: `scale(${s}) rotate(${i % 2 ? 2 : -2}deg)`}}>
              <PaperStrip bg={C.white} seed={`chip${i}`} style={{fontFamily: bricolage, fontWeight: 600, fontSize: 40}}>
                {c}
              </PaperStrip>
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: 'absolute',
          left: 60,
          top: 820,
          width: 960,
          transform: `scale(${cta * pulse}) rotate(-1.5deg)`,
          transformOrigin: '0 50%',
          opacity: cta > 0.01 ? 1 : 0,
        }}
      >
        <PaperStrip bg={C.amber} seed="cta" style={{fontFamily: anton, fontSize: 78, letterSpacing: 1}}>
          insightsflow.vercel.app
        </PaperStrip>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 70,
          top: 962,
          fontFamily: caveat,
          fontWeight: 700,
          fontSize: 64,
          color: C.cream,
          opacity: interpolate(frame, [70, 90], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
          transform: 'rotate(-3deg)',
        }}
      >
        it drafts. you approve. then it sends.
      </div>
      <CommentsBadge frame={frame} />
      <div style={{position: 'absolute', left: 60, bottom: 24, fontFamily: anton, fontSize: 52, color: C.cream}}>
        Insight<span style={{color: C.amber}}>Flow</span>
      </div>
      <Grain />
    </AbsoluteFill>
  );
};
