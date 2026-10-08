import React from 'react';
import {interpolate, OffthreadVideo, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {C} from '../theme';
import {Tape} from './Paper';

/** Card geometry, shared with Callout so its zoom lines up with the card's pixels. */
export const CARD = {left: 40, top: 470, width: 1000, height: 462, pad: 12, tilt: -1.2};

/** A screen recording mounted on a taped, tilted paper card with a slow push-in. */
export const ScreenCard: React.FC<{
  src: string;
  startSec: number;
  rate: number;
  focus: [number, number]; // objectPosition x%, y%
  zoom: [number, number];
  delay?: number;
  tilt?: number;
  width?: number;
  height?: number;
}> = ({src, startSec, rate, focus, zoom, delay = 10, tilt = CARD.tilt, width = CARD.width, height = CARD.height}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();
  const enter = spring({frame: frame - delay, fps, config: {damping: 14, stiffness: 110}});
  const scale = interpolate(frame, [0, durationInFrames], zoom);
  return (
    <div
      style={{
        position: 'absolute',
        left: (1080 - width) / 2,
        top: CARD.top,
        width,
        height,
        opacity: enter > 0.01 ? 1 : 0,
        transform: `translateY(${(1 - enter) * 260}px) rotate(${tilt + (1 - enter) * 7}deg)`,
        filter: 'drop-shadow(0 16px 0 rgba(42,18,23,0.25))',
      }}
    >
      <div style={{width, height, background: C.white, padding: CARD.pad, borderRadius: 6, boxSizing: 'border-box'}}>
        <div style={{width: '100%', height: '100%', overflow: 'hidden', background: C.cream}}>
          <OffthreadVideo
            src={staticFile(src)}
            muted
            trimBefore={Math.round(startSec * fps)}
            playbackRate={rate}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: `${focus[0]}% ${focus[1]}%`,
              transform: `scale(${scale})`,
              transformOrigin: `${focus[0]}% ${focus[1]}%`,
            }}
          />
        </div>
      </div>
      <Tape style={{left: -44, top: -14, transform: 'rotate(-34deg)'}} />
      <Tape style={{right: -44, top: -14, transform: 'rotate(34deg)'}} />
    </div>
  );
};
