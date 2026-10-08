// Writes out/insightflow-linkedin.srt from src/voice.json, using the same timeline rules as
// src/Promo.tsx (LEAD, 20 frame tail, 20 frame transitions). Keep the constants in sync.
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';

const FPS = 30;
const T = 20;
const HOOK_FRAMES = 44; // src/scenes/Hook.tsx
const IDS = ['intro', 's1', 's2', 's3', 's4', 's5', 'outro'];
const LEAD = {intro: HOOK_FRAMES + 6};

const voice = JSON.parse(readFileSync('src/voice.json', 'utf8'));
const lead = (id) => LEAD[id] ?? 10;
const dur = (id) => lead(id) + Math.ceil(voice[id].seconds * FPS) + 20;

const stamp = (frames) => {
  const ms = Math.round((frames / FPS) * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(h)}:${p(m)}:${p(s)},${p(r, 3)}`;
};

// split a line into at most two caption rows near the middle space
const twoRows = (text) => {
  if (text.length <= 42) return text;
  const mid = text.length / 2;
  let best = -1;
  for (let i = 0; i < text.length; i++) if (text[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  return best < 0 ? text : `${text.slice(0, best)}\n${text.slice(best + 1)}`;
};

let start = 0;
const cues = IDS.map((id, i) => {
  const from = start + lead(id);
  const to = from + Math.ceil(voice[id].seconds * FPS);
  start += dur(id) - T;
  return `${i + 1}\n${stamp(from)} --> ${stamp(to)}\n${twoRows(voice[id].text)}\n`;
});

mkdirSync('out', {recursive: true});
writeFileSync('out/insightflow-linkedin.srt', cues.join('\n'));
console.log(cues.join('\n'));
