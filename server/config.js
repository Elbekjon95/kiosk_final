import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const DATA_DIR = path.join(ROOT, 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
export const PUBLIC_DIR = path.join(ROOT, 'public');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const envPath = path.join(ROOT, '.env');
let generatedPassword = null;

// Birinchi ishga tushishda .env yo'q bo'lsa, tasodifiy admin paroli bilan yaratamiz.
if (!fs.existsSync(envPath)) {
  generatedPassword = crypto.randomBytes(9).toString('base64url');
  const template = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  fs.writeFileSync(envPath, template.replace(/^ADMIN_PASSWORD=.*$/m, `ADMIN_PASSWORD=${generatedPassword}`));
}
process.loadEnvFile(envPath);

export const env = {
  HOST: process.env.HOST || '127.0.0.1',
  PORT: Number(process.env.PORT) || 3100,
  GEMINI_API_KEY: (process.env.GEMINI_API_KEY || '').trim(),
  GEMINI_API_BASE: (process.env.GEMINI_API_BASE || 'https://generativelanguage.googleapis.com/v1beta').trim().replace(/\/+$/, ''),
  OPENWEATHER_API_KEY: (process.env.OPENWEATHER_API_KEY || '').trim(),
  ADMIN_PASSWORD: (process.env.ADMIN_PASSWORD || '').trim(),
  generatedPassword,
};

export const TZ = 'Asia/Tashkent';
export const TZ_OFFSET = '+05:00';

/** Toshkent vaqti bo'yicha { date: 'YYYY-MM-DD', time: 'HH:MM', weekday } */
export function tashkentNow(d = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'long',
    }).formatToParts(d).map((p) => [p.type, p.value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, weekday: parts.weekday };
}
