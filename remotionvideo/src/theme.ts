import {loadFont as loadAnton} from '@remotion/google-fonts/Anton';
import {loadFont as loadFraunces} from '@remotion/google-fonts/Fraunces';
import {loadFont as loadCaveat} from '@remotion/google-fonts/Caveat';
import {loadFont as loadBricolage} from '@remotion/google-fonts/BricolageGrotesque';

export const W = 1080;
export const H = 1350;
export const FPS = 30;

export const anton = loadAnton().fontFamily;
export const fraunces = loadFraunces('italic', {weights: ['700'], subsets: ['latin']}).fontFamily;
export const caveat = loadCaveat('normal', {weights: ['700'], subsets: ['latin']}).fontFamily;
export const bricolage = loadBricolage('normal', {weights: ['600'], subsets: ['latin']}).fontFamily;

export const C = {
  ink: '#2A1217',
  cream: '#F6EEDD',
  pink: '#E0457B',
  amber: '#FFC857',
  mint: '#7ADFBF',
  lilac: '#B9A6FF',
  orange: '#FF9B54',
  white: '#FFFDF7',
  marker: '#FF3B30', // red felt-tip for circles, strikes and underlines
};
