// Matnni ovozga aylantirish — Gemini TTS (til matndan avtomatik aniqlanadi, o'zbek tili qo'llanadi).
import crypto from 'node:crypto';
import { getSettings } from './db.js';
import { interact, AiError } from './ai.js';

const cache = new Map(); // kalit -> Buffer (oxirgi 60 ta javob)
const CACHE_MAX = 60;

function wavFromPcm(pcm, sampleRate = 24000) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

/** O'qib berishga xalaqit beradigan belgilarni olib tashlaydi. */
export function speakable(text) {
  return String(text || '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_#`>|~]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200);
}

export async function synthesize(rawText) {
  const s = getSettings();
  const text = speakable(rawText);
  if (!text) throw new AiError('Boʻsh matn', 400);
  if (s.tts_provider !== 'gemini') throw new AiError('Server TTS oʻchirilgan', 409);

  const key = crypto.createHash('sha1').update(`${s.tts_model}|${s.tts_voice}|${s.tts_style}|${text}`).digest('hex');
  if (cache.has(key)) return cache.get(key);

  const part = { type: 'text', text };
  if (s.tts_style) part.annotations = [{ type: 'speech_metadata', style: s.tts_style }];
  const resp = await interact(
    {
      model: s.tts_model,
      store: false,
      input: [{ type: 'user_input', content: [part] }],
      response_format: { type: 'audio' },
      generation_config: { speech_config: [{ voice: s.tts_voice || 'Kore' }] },
    },
    { revision: false },
  );

  let data = null;
  for (const step of resp?.steps || []) {
    if (step.type !== 'model_output') continue;
    for (const c of step.content || []) if (c.type === 'audio' && c.data) data = c.data;
  }
  if (!data) throw new AiError('TTS audio qaytarmadi');
  let buf = Buffer.from(data, 'base64');
  if (buf.subarray(0, 4).toString('latin1') !== 'RIFF') buf = wavFromPcm(buf);

  cache.set(key, buf);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return buf;
}
