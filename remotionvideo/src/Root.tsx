import React from 'react';
import {Composition, Still} from 'remotion';
import {Promo, PROMO_FRAMES} from './Promo';
import {Cover} from './scenes/Cover';
import {FPS, H, W} from './theme';

export const Root: React.FC = () => (
  <>
    <Composition id="InsightFlowPromo" component={Promo} durationInFrames={PROMO_FRAMES} fps={FPS} width={W} height={H} />
    <Still id="Cover" component={Cover} width={W} height={H} />
  </>
);
