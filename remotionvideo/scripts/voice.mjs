// Generates one narration mp3 per scene with Microsoft Edge's neural TTS (free, no key),
// then writes src/voice.json with each clip's length (scenes size to fit) and its on-screen
// caption text. `say` is what the voice reads (spelled out where TTS mispronounces); `text` is
// what the burned-in caption and the SRT show.
import {MsEdgeTTS, OUTPUT_FORMAT} from 'msedge-tts';
import {execFileSync} from 'node:child_process';
import {mkdirSync, renameSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

const VOICE = process.env.VOICE || 'en-IN-NeerjaNeural';
const LINES = [
  {id: 'intro', text: 'Your sheets already know the answers.'},
  {id: 's1', text: 'Meet InsightFlow. An AI analyst that reads your sheets and documents.', say: 'Meet InsightFlow. An A I analyst that reads your sheets and documents.'},
  {id: 's2', text: 'Connect a Google Sheet in seconds. Gmail, Slack and Notion join in one click.'},
  {id: 's3', text: 'Ask in plain words. Every number is calculated by code, then spelled out for you.'},
  {id: 's4', text: 'It drafts the email, Slack post, or Notion page. Nothing goes out until you approve.'},
  {id: 's5', text: 'Even PDFs and invoices turn into rows you can question.', say: 'Even P D Fs and invoices turn into rows you can question.'},
  {id: 'outro', text: 'Ask your first question today. insightsflow.vercel.app', say: 'Ask your first question today. insights flow dot vercel dot app.'},
];

const ffprobe = join('node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffprobe.exe');
const outDir = 'public/voice';
mkdirSync(outDir, {recursive: true});
const tts = new MsEdgeTTS();
await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

const result = {};
for (const {id, text, say} of LINES) {
  const {audioFilePath} = await tts.toFile(outDir, say ?? text, {rate: 0.95});
  const dest = join(outDir, `${id}.mp3`);
  renameSync(audioFilePath, dest);
  const seconds = parseFloat(execFileSync(ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', dest]).toString().trim().replace(',', '.'));
  result[id] = {file: `voice/${id}.mp3`, seconds, text};
  console.log(id, seconds.toFixed(2) + 's');
}
writeFileSync('src/voice.json', JSON.stringify(result, null, 2));
