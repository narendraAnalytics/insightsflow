import React from 'react';
import {AbsoluteFill, random, useVideoConfig} from 'remotion';
import type {TransitionPresentation, TransitionPresentationComponentProps} from '@remotion/transitions';

export type TearProps = {direction: 'up' | 'right'; color: string; seed: string};

const STEPS = 22;
const MARGIN = 260; // jag + strip, so the torn edge fully leaves the frame at progress 0 and 1

const Tear: React.FC<TransitionPresentationComponentProps<TearProps>> = ({
  children,
  presentationDirection,
  presentationProgress,
  passedProps,
}) => {
  const {width, height} = useVideoConfig();
  const {direction, color, seed} = passedProps;
  if (presentationDirection === 'exiting') return <AbsoluteFill style={{isolation: 'isolate'}}>{children}</AbsoluteFill>;

  const up = direction === 'up';
  const span = up ? height : width;
  const cross = up ? width : height;
  // "up": the new scene rises from the bottom, so its top edge travels H+M -> -M.
  // "right": the new scene wipes in from the left, so its right edge travels -M -> W+M.
  const edge = up ? (1 - presentationProgress) * (span + MARGIN) - MARGIN / 2 : presentationProgress * (span + MARGIN) - MARGIN / 2;
  const jag = (i: number, k: string, amp: number) => random(`${seed}${k}${i}`) * amp;

  const line = (k: string, amp: number, offset: number) =>
    Array.from({length: STEPS + 1}, (_, i) => {
      const c = (i / STEPS) * cross;
      const a = edge + offset + jag(i, k, amp);
      return up ? [c, a] : [a, c];
    });

  const main = line('m', 46, 0);
  const strip = line('s', 40, up ? -80 : 80);
  const toPoly = (pts: number[][]) => `polygon(${pts.map(([x, y]) => `${x}px ${y}px`).join(',')})`;

  // revealed region: below the edge for "up", left of the edge for "right"
  const revealed = up
    ? [...main, [width + 50, height + 400], [-50, height + 400]]
    : [...main, [-400, height + 50], [-400, -50]];
  // coloured paper strip riding just ahead of the edge, over the outgoing scene
  const stripPts = [...main, ...strip.slice().reverse()];

  return (
    <AbsoluteFill>
      <AbsoluteFill style={{clipPath: toPoly(stripPts), background: color}} />
      <AbsoluteFill style={{clipPath: toPoly(revealed)}}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

export const paperTear = (props: TearProps): TransitionPresentation<TearProps> => ({component: Tear, props});
