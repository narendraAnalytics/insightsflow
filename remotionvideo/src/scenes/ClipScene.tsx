import React from 'react';
import {AbsoluteFill, spring, useVideoConfig} from 'remotion';
import {Star} from '@remotion/shapes';
import {anton, bricolage, C} from '../theme';
import {Office} from '../components/Office';
import {Grain, PaperStrip, useTwos} from '../components/Paper';
import {CutoutHeadline, Word} from '../components/CutoutHeadline';
import {ScreenCard} from '../components/ScreenCard';
import {Note} from '../components/Note';
import {Callout, CalloutSpec} from '../components/Callout';
import {KaraokeCaption} from '../components/KaraokeCaption';

export type ClipSceneProps = {
  index: number;
  total: number;
  bg: string;
  accent: string;
  kicker: string;
  words: Word[];
  note: string;
  src: string;
  startSec: number;
  rate: number;
  focus: [number, number];
  zoom: [number, number];
  callout: CalloutSpec;
};

export type Narration = {text: string; seconds: number; lead: number};

export const ClipScene: React.FC<ClipSceneProps & {narration: Narration}> = (p) => {
  const frame = useTwos();
  const {fps} = useVideoConfig();
  const sticker = spring({frame: frame - 22, fps, config: {damping: 9, stiffness: 120}});
  const spin = Math.floor(frame / 3) * 9; // stop-motion rotation
  const num = String(p.index).padStart(2, '0');
  return (
    <AbsoluteFill>
      <Office color={p.bg} seed={`o${p.index}`} />

      {/* kicker + counter */}
      <div style={{position: 'absolute', left: 60, top: 64, display: 'flex', gap: 16, alignItems: 'center'}}>
        <PaperStrip bg={C.ink} color={C.cream} seed={`k${p.index}`} style={{fontFamily: anton, fontSize: 34, letterSpacing: 3}}>
          {num} / {String(p.total).padStart(2, '0')}
        </PaperStrip>
        <div style={{fontFamily: bricolage, fontWeight: 600, fontSize: 30, letterSpacing: 4, textTransform: 'uppercase', color: C.ink}}>
          {p.kicker}
        </div>
      </div>

      <div style={{position: 'absolute', left: 60, top: 140, width: 960}}>
        <CutoutHeadline words={p.words} seed={`h${p.index}`} delay={4} />
      </div>

      <ScreenCard src={p.src} startSec={p.startSec} rate={p.rate} focus={p.focus} zoom={p.zoom} />

      {/* spinning star sticker */}
      <div style={{position: 'absolute', right: 30, top: 410, transform: `scale(${sticker}) rotate(${spin}deg)`}}>
        <Star points={12} innerRadius={64} outerRadius={84} fill={p.accent} stroke={C.ink} strokeWidth={5} cornerRadius={4} />
      </div>
      <div
        style={{
          position: 'absolute',
          right: 30,
          top: 410,
          width: 168,
          height: 168,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: anton,
          fontSize: 56,
          color: C.ink,
          transform: `scale(${sticker})`,
        }}
      >
        {num}
      </div>

      <Callout spec={p.callout} src={p.src} startSec={p.startSec} rate={p.rate} />

      <KaraokeCaption
        text={p.narration.text}
        seconds={p.narration.seconds}
        lead={p.narration.lead}
        seed={`cap${p.index}`}
        style={{left: 60, top: 1000, width: 960}}
      />

      <Note text={p.note} delay={46} style={{right: 60, top: 936}} />

      {/* progress pills */}
      <div style={{position: 'absolute', left: 60, bottom: 40, display: 'flex', gap: 10, alignItems: 'center'}}>
        {Array.from({length: p.total}).map((_, i) => (
          <div
            key={i}
            style={{
              width: i + 1 === p.index ? 64 : 22,
              height: 14,
              borderRadius: 8,
              background: i + 1 <= p.index ? C.cream : 'rgba(246,238,221,0.3)',
            }}
          />
        ))}
      </div>
      <div style={{position: 'absolute', right: 60, bottom: 30, fontFamily: anton, fontSize: 38, letterSpacing: 1, color: C.cream}}>
        Insight<span style={{color: C.amber}}>Flow</span>
      </div>
      <Grain />
    </AbsoluteFill>
  );
};
