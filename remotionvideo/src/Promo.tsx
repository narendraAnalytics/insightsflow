import React from 'react';
import {Audio, Sequence, staticFile} from 'remotion';
import {linearTiming, springTiming, TransitionSeries} from '@remotion/transitions';
import {slide} from '@remotion/transitions/slide';
import {flip} from '@remotion/transitions/flip';
import {clockWipe} from '@remotion/transitions/clock-wipe';
import {C, FPS, H, W} from './theme';
import voice from './voice.json';
import {Intro} from './scenes/Intro';
import {Outro} from './scenes/Outro';
import {ClipScene, ClipSceneProps} from './scenes/ClipScene';
import {HOOK_FRAMES} from './scenes/Hook';
import {paperTear} from './transitions/paperTear';

export const T = 20; // transition length in frames

// Scene length follows its narration: a lead-in, the spoken line, then a 20 frame tail that
// doubles as the overlap with the next transition. The intro's voice waits for the hook card.
export type VoiceId = keyof typeof voice;
export const LEAD: Record<VoiceId, number> = {intro: HOOK_FRAMES + 6, s1: 10, s2: 10, s3: 10, s4: 10, s5: 10, outro: 10};
export const dur = (id: VoiceId) => LEAD[id] + Math.ceil(voice[id].seconds * FPS) + 20;
export const IDS: VoiceId[] = ['intro', 's1', 's2', 's3', 's4', 's5', 'outro'];
export const PROMO_FRAMES = IDS.reduce((n, id) => n + dur(id), 0) - (IDS.length - 1) * T;

const Voiced: React.FC<{id: VoiceId; children: React.ReactNode}> = ({id, children}) => (
  <>
    <Sequence from={LEAD[id]} layout="none">
      <Audio src={staticFile(voice[id].file)} />
    </Sequence>
    {children}
  </>
);

const common = {total: 5, zoom: [1, 1] as [number, number], focus: [50, 50] as [number, number]};

// startSec/rate pick the moment of each clip. Callout targets are source-video pixels, and each
// callout's from/to window was chosen from half-second frame grids so its target holds still.
export const SCENES: ClipSceneProps[] = [
  {
    ...common,
    index: 1,
    bg: C.amber,
    accent: C.pink,
    kicker: 'Meet InsightFlow',
    words: [
      {text: 'Ask', bg: C.ink, color: C.cream, rot: -2},
      {text: 'your', bg: C.cream, rot: 2},
      {text: 'sheets.', bg: C.pink, color: C.cream, italic: true, rot: -1.5},
    ],
    note: 'real numbers, not guesses',
    src: 'video1.mp4',
    startSec: 18,
    rate: 1.6,
    // hero paragraph "...computes every number with real code" (hero holds t=19-24 s)
    callout: {srcSize: [1366, 602], target: [300, 432], from: 56, to: 108, lens: [770, 690], zoom: 1.5, ring: [150, 46], label: 'every number from real code'},
  },
  {
    ...common,
    index: 2,
    bg: C.mint,
    accent: C.amber,
    kicker: 'Connect',
    words: [
      {text: 'Connect', bg: C.ink, color: C.cream, rot: 2},
      {text: 'in', bg: C.cream, rot: -2},
      {text: 'seconds.', bg: C.amber, italic: true, rot: 1.5},
    ],
    note: 'you stay in control',
    src: 'video3.mp4',
    startSec: 52,
    rate: 1.0, // real time, so the Picker moment (t=54-57.5 s) is long enough to call out
    // Google Picker: the chosen file and the Select button
    callout: {srcSize: [1366, 604], target: [350, 470], from: 66, to: 160, lens: [770, 690], zoom: 1.7, ring: [120, 80], label: 'only the files you pick'},
  },
  {
    ...common,
    index: 3,
    bg: C.pink,
    accent: C.mint,
    kicker: 'Ask',
    words: [
      {text: 'Just', bg: C.cream, rot: -2},
      {text: 'ask', bg: C.amber, rot: 2},
      {text: 'in plain words.', bg: C.ink, color: C.cream, italic: true, rot: -1.5},
    ],
    note: 'no formulas needed',
    src: 'video4.mp4',
    startSec: 56,
    rate: 1.5,
    // "Six lakh fourteen thousand eight hundred" line under the answer (holds t=60-64 s)
    callout: {srcSize: [1364, 606], target: [785, 420], from: 84, to: 166, lens: [270, 620], zoom: 1.45, ring: [160, 34], label: 'spelled out in lakh & crore', labelAt: 'top'},
  },
  {
    ...common,
    index: 4,
    bg: C.lilac,
    accent: C.amber,
    kicker: 'Approve',
    words: [
      {text: 'You', bg: C.cream, rot: 2},
      {text: 'approve.', bg: C.ink, color: C.cream, rot: -2},
      {text: 'Then it sends.', bg: C.amber, italic: true, rot: 1.5},
    ],
    note: 'human in the loop',
    src: 'video5.mp4',
    startSec: 58,
    rate: 1.5,
    // "Save to Notion" button on the draft card (holds t=60.5-64 s, clicked ~63.5 s)
    callout: {srcSize: [1364, 610], target: [720, 478], from: 58, to: 120, lens: [260, 660], zoom: 2.0, ring: [90, 32], label: 'nothing is saved until you click', labelAt: 'top'},
  },
  {
    ...common,
    index: 5,
    bg: C.orange,
    accent: C.mint,
    kicker: 'Documents',
    words: [
      {text: 'Upload', bg: C.ink, color: C.cream, rot: -2},
      {text: 'a', bg: C.cream, rot: 2},
      {text: 'PDF.', bg: C.mint, italic: true, rot: -1.5},
    ],
    note: 'PDFs count too',
    src: 'video2.mp4',
    startSec: 104,
    rate: 1.5,
    // the drop zone (page holds t=109-112 s)
    callout: {srcSize: [1354, 608], target: [492, 432], from: 100, to: 158, lens: [800, 650], zoom: 1.6, ring: [200, 48], label: 'PDF, PNG or JPG'},
  },
];

const narration = (id: VoiceId) => ({text: voice[id].text, seconds: voice[id].seconds, lead: LEAD[id]});

export const Promo: React.FC = () => {
  const spr = springTiming({config: {damping: 200}, durationInFrames: T});
  const lin = linearTiming({durationInFrames: T});
  const tr = (presentation: any, timing = spr) => <TransitionSeries.Transition presentation={presentation} timing={timing} />;
  const [s1, s2, s3, s4, s5] = SCENES;
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={dur('intro')}>
        <Voiced id="intro"><Intro /></Voiced>
      </TransitionSeries.Sequence>
      {tr(paperTear({direction: 'up', color: C.pink, seed: 'a'}))}
      <TransitionSeries.Sequence durationInFrames={dur('s1')}>
        <Voiced id="s1"><ClipScene {...s1} narration={narration('s1')} /></Voiced>
      </TransitionSeries.Sequence>
      {tr(paperTear({direction: 'right', color: C.ink, seed: 'b'}))}
      <TransitionSeries.Sequence durationInFrames={dur('s2')}>
        <Voiced id="s2"><ClipScene {...s2} narration={narration('s2')} /></Voiced>
      </TransitionSeries.Sequence>
      {tr(slide({direction: 'from-bottom'}))}
      <TransitionSeries.Sequence durationInFrames={dur('s3')}>
        <Voiced id="s3"><ClipScene {...s3} narration={narration('s3')} /></Voiced>
      </TransitionSeries.Sequence>
      {tr(clockWipe({width: W, height: H}), lin)}
      <TransitionSeries.Sequence durationInFrames={dur('s4')}>
        <Voiced id="s4"><ClipScene {...s4} narration={narration('s4')} /></Voiced>
      </TransitionSeries.Sequence>
      {tr(paperTear({direction: 'up', color: C.amber, seed: 'c'}))}
      <TransitionSeries.Sequence durationInFrames={dur('s5')}>
        <Voiced id="s5"><ClipScene {...s5} narration={narration('s5')} /></Voiced>
      </TransitionSeries.Sequence>
      {tr(flip())}
      <TransitionSeries.Sequence durationInFrames={dur('outro')}>
        <Voiced id="outro"><Outro /></Voiced>
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};
