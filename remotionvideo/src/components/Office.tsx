import React from 'react';
import {AbsoluteFill, random, useCurrentFrame} from 'remotion';
import {C, W, H} from '../theme';

// A modern office drawn as layered paper cut-outs. The wall takes the scene colour, so every
// scene keeps its identity while sharing one room: window + skyline, pendant lamps, a desk.

const WIN = {x: 40, y: 30, w: 1000, h: 470};

const Skyline: React.FC<{seed: string; base: number; minH: number; maxH: number; fill: string; frame: number}> = ({
  seed,
  base,
  minH,
  maxH,
  fill,
  frame,
}) => {
  const out: React.ReactNode[] = [];
  let x = WIN.x - 10;
  let i = 0;
  while (x < WIN.x + WIN.w) {
    const w = 60 + random(`${seed}w${i}`) * 70;
    const h = minH + random(`${seed}h${i}`) * (maxH - minH);
    out.push(<rect key={`b${i}`} x={x} y={base - h} width={w} height={h} fill={fill} />);
    // lit windows twinkle slowly
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 3; c++) {
        const on = random(`${seed}l${i}${r}${c}${Math.floor(frame / 45)}`) > 0.72;
        if (on) out.push(<rect key={`l${i}${r}${c}`} x={x + 10 + c * 18} y={base - h + 14 + r * 22} width={8} height={10} fill={C.cream} opacity={0.75} />);
      }
    }
    x += w + 4;
    i++;
  }
  return <>{out}</>;
};

const Lamp: React.FC<{x: number; len: number; frame: number; phase: number}> = ({x, len, frame, phase}) => {
  const sway = Math.sin((Math.floor(frame / 3) * 3) / 40 + phase) * 1.4;
  return (
    <g transform={`rotate(${sway} ${x} 0)`}>
      <circle cx={x} cy={len + 40} r={150} fill="url(#glow)" />
      <line x1={x} y1={0} x2={x} y2={len} stroke={C.ink} strokeWidth={4} opacity={0.8} />
      <path d={`M${x - 52} ${len + 46} Q${x} ${len - 24} ${x + 52} ${len + 46} Z`} fill={C.ink} opacity={0.88} />
      <ellipse cx={x} cy={len + 46} rx={52} ry={7} fill={C.amber} />
    </g>
  );
};

export const Office: React.FC<{color: string; seed?: string}> = ({color, seed = 'o'}) => {
  const frame = useCurrentFrame();
  const sway = Math.sin(Math.floor(frame / 3) / 9) * 2.5;
  const cloud = ((frame * 0.5) % (WIN.w + 300)) - 150;
  return (
    <AbsoluteFill>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute'}}>
        <defs>
          <radialGradient id="glow">
            <stop offset="0%" stopColor="#FFE9A8" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#FFE9A8" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.2" />
          </linearGradient>
          <clipPath id="win">
            <rect x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h} />
          </clipPath>
        </defs>

        <rect width={W} height={H} fill={color} />

        {/* slatted wall panels below the window */}
        {Array.from({length: 24}).map((_, i) => (
          <rect key={i} x={i * 46 + 12} y={WIN.y + WIN.h} width={18} height={H} fill={C.ink} opacity={0.05} />
        ))}

        {/* window: glass, sun, cloud, two skyline layers, mullions */}
        <g clipPath="url(#win)">
          <rect x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h} fill="url(#sky)" />
          <circle cx={820} cy={150} r={64} fill={C.cream} opacity={0.85} />
          <ellipse cx={WIN.x + cloud} cy={170} rx={96} ry={26} fill={C.white} opacity={0.8} />
          <ellipse cx={WIN.x + cloud + 60} cy={156} rx={64} ry={24} fill={C.white} opacity={0.8} />
          <Skyline seed={`${seed}far`} base={WIN.y + WIN.h} minH={150} maxH={260} fill="rgba(42,18,23,0.1)" frame={0} />
          <Skyline seed={`${seed}near`} base={WIN.y + WIN.h} minH={70} maxH={180} fill="rgba(42,18,23,0.2)" frame={frame} />
        </g>
        <rect x={WIN.x} y={WIN.y} width={WIN.w} height={WIN.h} fill="none" stroke={C.ink} strokeWidth={14} opacity={0.82} />
        <rect x={WIN.x + WIN.w / 3 - 5} y={WIN.y} width={10} height={WIN.h} fill={C.ink} opacity={0.82} />
        <rect x={WIN.x + (WIN.w * 2) / 3 - 5} y={WIN.y} width={10} height={WIN.h} fill={C.ink} opacity={0.82} />
        <rect x={WIN.x} y={WIN.y + 250} width={WIN.w} height={10} fill={C.ink} opacity={0.82} />
        <rect x={WIN.x - 14} y={WIN.y + WIN.h} width={WIN.w + 28} height={22} fill={C.ink} opacity={0.3} />

        {/* pendant lamps */}
        <Lamp x={150} len={110} frame={frame} phase={0} />
        <Lamp x={660} len={70} frame={frame} phase={1.6} />
        <Lamp x={950} len={130} frame={frame} phase={3.1} />

        {/* desk band + things on it */}
        <rect x={0} y={1236} width={W} height={H - 1236} fill={C.ink} opacity={0.9} />
        <rect x={0} y={1236} width={W} height={8} fill={C.cream} opacity={0.28} />
        {/* laptop */}
        <g transform="translate(300 1146)">
          <rect x={0} y={0} width={150} height={92} rx={6} fill={C.ink} opacity={0.95} />
          <rect x={10} y={10} width={130} height={72} rx={3} fill={C.mint} opacity={0.85} />
          <rect x={-14} y={92} width={178} height={9} rx={4} fill={C.white} opacity={0.9} />
        </g>
        {/* mug */}
        <g transform="translate(520 1176)">
          <rect x={0} y={0} width={46} height={60} rx={6} fill={C.cream} />
          <path d="M46 14 q22 4 0 30" fill="none" stroke={C.cream} strokeWidth={7} />
          <rect x={0} y={0} width={46} height={10} rx={5} fill={C.pink} />
        </g>
        {/* plant */}
        <g transform={`translate(660 1236)`}>
          <rect x={-34} y={-54} width={68} height={54} rx={6} fill={C.amber} />
          <g transform={`rotate(${sway} 0 -54)`}>
            <ellipse cx={-30} cy={-110} rx={16} ry={50} transform="rotate(-28 -30 -110)" fill="#3E8E6B" />
            <ellipse cx={0} cy={-128} rx={16} ry={62} fill="#5CB88F" />
            <ellipse cx={32} cy={-108} rx={16} ry={50} transform="rotate(28 32 -108)" fill="#3E8E6B" />
          </g>
        </g>
      </svg>
    </AbsoluteFill>
  );
};
