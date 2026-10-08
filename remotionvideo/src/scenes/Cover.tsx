import React from 'react';
import {AbsoluteFill} from 'remotion';
import {anton, C, fraunces} from '../theme';
import {HookCard} from './Hook';

/** Custom LinkedIn thumbnail: the hook card at full strength, plus the brand. */
export const Cover: React.FC = () => (
  <AbsoluteFill>
    <HookCard frozenAt={30} ripAway={false} showAnswer={false} />
    <div style={{position: 'absolute', left: 80, bottom: 70, display: 'flex', alignItems: 'baseline', gap: 22}}>
      <div style={{fontFamily: anton, fontSize: 56, color: C.cream, letterSpacing: 1}}>
        Insight<span style={{color: C.amber}}>Flow</span>
      </div>
      <div style={{fontFamily: fraunces, fontStyle: 'italic', fontWeight: 700, fontSize: 34, color: C.cream, opacity: 0.85}}>
        the AI analyst for your business data
      </div>
    </div>
  </AbsoluteFill>
);
