import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DATA_DIR } from './config.js';

export const db = new DatabaseSync(path.join(DATA_DIR, 'access.db'));

db.exec(`
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kb (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS floors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  image TEXT,
  width INTEGER NOT NULL DEFAULT 0,
  height INTEGER NOT NULL DEFAULT 0,
  sort INTEGER NOT NULL DEFAULT 0,
  obstacles TEXT NOT NULL DEFAULT '[]',
  meters_per_px REAL
);

CREATE TABLE IF NOT EXISTS places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  floor_id INTEGER NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  x REAL NOT NULL,
  y REAL NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  name_uz TEXT NOT NULL,
  name_ru TEXT NOT NULL DEFAULT '',
  name_en TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  link_code TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  contact TEXT NOT NULL DEFAULT '',
  lang TEXT NOT NULL DEFAULT '',
  kiosk_id INTEGER,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS chat_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  kiosk_id INTEGER,
  input_type TEXT NOT NULL,
  lang TEXT NOT NULL DEFAULT '',
  question TEXT NOT NULL DEFAULT '',
  answer TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  ms INTEGER NOT NULL DEFAULT 0,
  error TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
`);

export const DEFAULT_SETTINGS = {
  chat_model: 'gemini-3.8-flash',
  tts_provider: 'gemini', // gemini | browser | off
  tts_model: 'gemini-3.8-flash-lite-tts',
  tts_voice: 'Kore',
  tts_style: 'warm, clear and friendly airport information assistant, natural pace',
  default_lang: 'uz',
  welcome: {
    uz: 'Xush kelibsiz! Menga savol berishingiz mumkin.',
    ru: 'Добро пожаловать! Задайте мне свой вопрос.',
    en: 'Welcome! Ask me anything about the airport.',
  },
  status_text: {
    uz: 'Tizim test rejimida ishlamoqda',
    ru: 'Система работает в тестовом режиме',
    en: 'System is running in test mode',
  },
  operator: {
    phone: '',
    note: {
      uz: 'Yordam kerak boʻlsa, axborot peshtaxtasiga murojaat qiling.',
      ru: 'Если нужна помощь, обратитесь на стойку информации.',
      en: 'If you need help, please visit the information desk.',
    },
  },
  idle_timeout_sec: 75,
  lang_rotate_sec: 30, // bo'sh turganda ekran yozuvlari tili uz → ru → en almashinadi; 0 — o'chiq
  airports: [
    { code: 'TAS2', name: { uz: 'Xalqaro terminal', ru: 'Международный терминал', en: 'International terminal' } },
    { code: 'TAS3', name: { uz: 'Mahalliy terminal', ru: 'Терминал местных линий', en: 'Domestic terminal' } },
  ],
  extra_instructions: '',
  weather: { enabled: true, lat: 41.2579, lon: 69.2812 },
};

const selAll = db.prepare('SELECT key, value FROM settings');
const upsert = db.prepare(
  'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
);

let settingsCache = null;

export function getSettings() {
  if (settingsCache) return settingsCache;
  const out = structuredClone(DEFAULT_SETTINGS);
  for (const row of selAll.all()) {
    if (!(row.key in DEFAULT_SETTINGS)) continue;
    try {
      out[row.key] = JSON.parse(row.value);
    } catch { /* buzilgan qiymat — standart qoladi */ }
  }
  settingsCache = out;
  return out;
}

export function saveSettings(patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    if (typeof value !== typeof DEFAULT_SETTINGS[key]) continue;
    upsert.run(key, JSON.stringify(value));
  }
  settingsCache = null;
  return getSettings();
}

export function parseFloor(row) {
  if (!row) return null;
  let obstacles = [];
  try { obstacles = JSON.parse(row.obstacles); } catch { /* bo'sh */ }
  return { ...row, obstacles };
}

export function listFloors() {
  return db.prepare('SELECT * FROM floors ORDER BY sort, id').all().map(parseFloor);
}

export function listPlaces({ onlyActive = false } = {}) {
  const sql = `SELECT * FROM places ${onlyActive ? 'WHERE active = 1' : ''} ORDER BY category, name_uz`;
  return db.prepare(sql).all();
}

// Birinchi ishga tushishda bitta namunaviy bilim yozuvi (admin tekshirib tahrirlashi kerak).
if (db.prepare('SELECT COUNT(*) AS n FROM kb').get().n === 0) {
  db.prepare('INSERT INTO kb (title, content, category) VALUES (?, ?, ?)').run(
    'Terminallar',
    'Toshkent xalqaro aeroportida ikkita yoʻlovchi terminali bor: Toshkent-2 (TAS2) — xalqaro reyslar terminali, ' +
      'Toshkent-3 (TAS3) — mahalliy reyslar terminali. Reys tablosida ham reyslar shu ikki terminal boʻyicha koʻrsatiladi.',
    'umumiy',
  );
}
