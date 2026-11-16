import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { env, ROOT, PUBLIC_DIR, UPLOAD_DIR } from './config.js';
import { db, getSettings, saveSettings, listFloors, listPlaces } from './db.js';
import { startFlightSync, refreshFlights, getFlights, fidsStatus } from './fids.js';
import { airportGeo, geoForFlights, HOME_CODE } from './geo.js';
import { chat, transcribe, listModels, AiError } from './ai.js';
import { synthesize } from './tts.js';
import { weatherReady, destinationCities, weatherFor, MAX_BATCH } from './weather.js';
import { checkPassword, createSession, destroySession, isAdmin, requireAdmin, rateLimit } from './auth.js';

const app = express();
app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: blob: https://app.uzairports.com; style-src 'self' 'unsafe-inline'; " +
      "media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  );
  next();
});
app.use(express.json({ limit: '8mb' }));

// ---------- yordamchilar ----------
const str = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function readAudio(body) {
  const data = typeof body?.audio === 'string' ? body.audio : '';
  if (!data) return null;
  if (data.length > 7_000_000 || !/^[A-Za-z0-9+/]+=*$/.test(data)) throw new AiError('Audio notoʻgʻri', 400);
  return { data, mime: 'audio/wav' };
}

const PUBLIC_SETTINGS = ['default_lang', 'welcome', 'status_text', 'operator', 'idle_timeout_sec', 'airports', 'tts_provider'];

// ---------- kiosk API ----------
app.get('/api/config', (req, res) => {
  const s = getSettings();
  const places = listPlaces({ onlyActive: true });
  const kioskId = num(req.query.kiosk);
  const kiosk = places.find((p) => p.category === 'kiosk' && p.id === kioskId) || places.find((p) => p.category === 'kiosk') || null;
  res.json({
    settings: Object.fromEntries(PUBLIC_SETTINGS.map((k) => [k, s[k]])),
    floors: listFloors().filter((f) => f.image),
    places,
    kioskId: kiosk?.id ?? null,
    aiReady: Boolean(env.GEMINI_API_KEY),
  });
});

app.get('/api/flights', (req, res) => {
  const type = req.query.type === 'ARRIVAL' ? 'ARRIVAL' : 'DEPARTURE';
  const airport = str(req.query.airport, 8) || undefined;
  const board = getFlights({ airport, type });
  // geo — globusda yo'nalish chizish uchun aeroportlar koordinatalari
  res.json({ ...board, home: { code: HOME_CODE, ...airportGeo(HOME_CODE) }, geo: geoForFlights(board.flights) });
});

let weatherCache = { at: 0, data: null };
app.get('/api/weather', wrap(async (req, res) => {
  const w = getSettings().weather;
  if (!w.enabled) return res.json({ temp: null });
  if (Date.now() - weatherCache.at > 15 * 60_000) {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${w.lat}&longitude=${w.lon}&current=temperature_2m,weather_code,is_day`;
      const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      const j = await r.json();
      weatherCache = {
        at: Date.now(),
        data: { temp: Math.round(j.current.temperature_2m), code: j.current.weather_code, isDay: j.current.is_day === 1 },
      };
    } catch {
      weatherCache.at = Date.now() - 13 * 60_000; // 2 daqiqadan keyin qayta urinish
    }
  }
  res.json(weatherCache.data || { temp: null });
}));

// Uchib ketadigan reyslar shaharlari: avval ro'yxat (tez), keyin ob-havo 6 tadan — kiosk qotib qolmasligi uchun.
app.get('/api/weather/destinations', (req, res) => {
  if (!weatherReady()) return res.json({ enabled: false, cities: [] });
  const cities = destinationCities().map(({ code, city, country, next }) => ({ code, city, country, next }));
  res.json({ enabled: true, cities });
});

app.get('/api/weather/cities', rateLimit({ max: 40, windowMs: 60_000 }), wrap(async (req, res) => {
  if (!weatherReady()) return res.json({ weather: {} });
  const codes = str(req.query.codes, 100).toUpperCase().split(',').map((c) => c.trim()).filter((c) => /^[A-Z0-9]{3,4}$/.test(c));
  res.json({ weather: await weatherFor(codes.slice(0, MAX_BATCH)) });
}));

const logChat = db.prepare(
  'INSERT INTO chat_logs (kiosk_id, input_type, lang, question, answer, action, ms, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
);

app.post('/api/chat', rateLimit({ max: 20, windowMs: 60_000 }), wrap(async (req, res) => {
  const audio = readAudio(req.body);
  const text = str(req.body?.text, 1000);
  if (!audio && !text) return res.status(400).json({ error: 'Savol boʻsh' });
  const history = Array.isArray(req.body?.history)
    ? req.body.history.slice(-4).map((h) => ({ q: str(h?.q, 400), a: str(h?.a, 600) }))
    : [];
  const kioskId = num(req.body?.kiosk);
  const started = Date.now();
  try {
    const out = await chat({ text, audio, history, kioskId });
    const ms = Date.now() - started;
    logChat.run(kioskId, audio ? 'voice' : 'text', out.lang, out.heard || text, out.answer, JSON.stringify(out.action), ms, '');
    res.json({ ...out, ms });
  } catch (err) {
    logChat.run(kioskId, audio ? 'voice' : 'text', '', text, '', '', Date.now() - started, str(err.message, 500));
    throw err;
  }
}));

app.post('/api/tts', rateLimit({ max: 30, windowMs: 60_000 }), wrap(async (req, res) => {
  const buf = await synthesize(str(req.body?.text, 1500));
  res.setHeader('Content-Type', 'audio/wav');
  res.setHeader('Cache-Control', 'no-store');
  res.end(buf);
}));

app.post('/api/transcribe', rateLimit({ max: 10, windowMs: 60_000 }), wrap(async (req, res) => {
  const audio = readAudio(req.body);
  if (!audio) return res.status(400).json({ error: 'Audio yoʻq' });
  res.json({ text: await transcribe(audio) });
}));

const FEEDBACK_TYPES = ['complaint', 'suggestion', 'thanks'];
app.post('/api/feedback', rateLimit({ max: 6, windowMs: 60_000 }), (req, res) => {
  const type = FEEDBACK_TYPES.includes(req.body?.type) ? req.body.type : 'suggestion';
  const message = str(req.body?.message, 3000);
  if (message.length < 3) return res.status(400).json({ error: 'Matn juda qisqa' });
  db.prepare('INSERT INTO feedback (type, message, contact, lang, kiosk_id) VALUES (?, ?, ?, ?, ?)').run(
    type, message, str(req.body?.contact, 120), str(req.body?.lang, 8), num(req.body?.kiosk),
  );
  res.json({ ok: true });
});

// ---------- admin: kirish ----------
app.post('/api/admin/login', rateLimit({ max: 8, windowMs: 60_000 }), (req, res) => {
  if (!checkPassword(req.body?.password)) return res.status(401).json({ error: 'Parol notoʻgʻri' });
  createSession(res);
  res.json({ ok: true });
});
app.post('/api/admin/logout', (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});
app.get('/api/admin/me', (req, res) => res.json({ admin: isAdmin(req) }));

const admin = express.Router();
admin.use(requireAdmin);
app.use('/api/admin', admin);

admin.get('/overview', (req, res) => {
  const one = (sql) => db.prepare(sql).get().n;
  res.json({
    aiReady: Boolean(env.GEMINI_API_KEY),
    chatsToday: one("SELECT COUNT(*) AS n FROM chat_logs WHERE created_at >= datetime('now', '-1 day')"),
    chatsTotal: one('SELECT COUNT(*) AS n FROM chat_logs'),
    errorsToday: one("SELECT COUNT(*) AS n FROM chat_logs WHERE error != '' AND created_at >= datetime('now', '-1 day')"),
    feedbackNew: one("SELECT COUNT(*) AS n FROM feedback WHERE status = 'new'"),
    kbCount: one('SELECT COUNT(*) AS n FROM kb WHERE active = 1'),
    placeCount: one("SELECT COUNT(*) AS n FROM places WHERE category != 'kiosk'"),
    kioskCount: one("SELECT COUNT(*) AS n FROM places WHERE category = 'kiosk'"),
    fids: fidsStatus(),
  });
});

// --- bilimlar bazasi ---
admin.get('/kb', (req, res) => res.json(db.prepare('SELECT * FROM kb ORDER BY category, id').all()));
admin.post('/kb', (req, res) => {
  const title = str(req.body?.title, 200);
  const content = str(req.body?.content, 20000);
  if (!title || !content) return res.status(400).json({ error: 'Sarlavha va matn kerak' });
  const r = db.prepare('INSERT INTO kb (title, content, category, active) VALUES (?, ?, ?, ?)').run(
    title, content, str(req.body?.category, 60), req.body?.active === false ? 0 : 1,
  );
  res.json({ id: Number(r.lastInsertRowid) });
});
admin.put('/kb/:id', (req, res) => {
  const title = str(req.body?.title, 200);
  const content = str(req.body?.content, 20000);
  if (!title || !content) return res.status(400).json({ error: 'Sarlavha va matn kerak' });
  db.prepare("UPDATE kb SET title = ?, content = ?, category = ?, active = ?, updated_at = datetime('now') WHERE id = ?").run(
    title, content, str(req.body?.category, 60), req.body?.active === false ? 0 : 1, num(req.params.id),
  );
  res.json({ ok: true });
});
admin.delete('/kb/:id', (req, res) => {
  db.prepare('DELETE FROM kb WHERE id = ?').run(num(req.params.id));
  res.json({ ok: true });
});

// --- qavatlar (xarita) ---
function cleanObstacles(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 2000).map((o) => {
    const points = (Array.isArray(o?.points) ? o.points : []).slice(0, 400)
      .map((p) => [num(p?.[0]), num(p?.[1])]).filter((p) => p[0] !== null && p[1] !== null);
    if (o?.type === 'wall') return points.length >= 2 ? { type: 'wall', points, width: Math.max(1, num(o.width) || 8) } : null;
    return points.length >= 3 ? { type: 'poly', points } : null;
  }).filter(Boolean);
}

admin.get('/floors', (req, res) => res.json(listFloors()));
admin.post('/floors', (req, res) => {
  const name = str(req.body?.name, 80) || 'Yangi qavat';
  const r = db.prepare('INSERT INTO floors (name, sort) VALUES (?, ?)').run(name, num(req.body?.sort) || 0);
  res.json({ id: Number(r.lastInsertRowid) });
});
admin.put('/floors/:id', (req, res) => {
  const id = num(req.params.id);
  const floor = db.prepare('SELECT * FROM floors WHERE id = ?').get(id);
  if (!floor) return res.status(404).json({ error: 'Qavat topilmadi' });
  const b = req.body || {};
  db.prepare('UPDATE floors SET name = ?, sort = ?, obstacles = ?, meters_per_px = ? WHERE id = ?').run(
    'name' in b ? str(b.name, 80) || floor.name : floor.name,
    'sort' in b ? num(b.sort) || 0 : floor.sort,
    'obstacles' in b ? JSON.stringify(cleanObstacles(b.obstacles)) : floor.obstacles,
    'meters_per_px' in b ? (num(b.meters_per_px) > 0 ? num(b.meters_per_px) : null) : floor.meters_per_px,
    id,
  );
  res.json({ ok: true });
});

const IMAGE_TYPES = [
  { ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: 'webp', test: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
];
admin.put('/floors/:id/image', express.raw({ type: () => true, limit: '30mb' }), (req, res) => {
  const id = num(req.params.id);
  const floor = db.prepare('SELECT * FROM floors WHERE id = ?').get(id);
  if (!floor) return res.status(404).json({ error: 'Qavat topilmadi' });
  const body = req.body;
  const kind = Buffer.isBuffer(body) && body.length > 12 ? IMAGE_TYPES.find((t) => t.test(body)) : null;
  const w = num(req.query.w);
  const h = num(req.query.h);
  if (!kind || !(w > 0) || !(h > 0)) return res.status(400).json({ error: 'Faqat JPG, PNG yoki WEBP rasm yuklang' });
  const file = `floor-${id}-${Date.now()}.${kind.ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, file), body);
  if (floor.image) fs.rm(path.join(UPLOAD_DIR, path.basename(floor.image)), { force: true }, () => {});
  db.prepare('UPDATE floors SET image = ?, width = ?, height = ? WHERE id = ?').run(file, Math.round(w), Math.round(h), id);
  res.json({ image: file, width: Math.round(w), height: Math.round(h) });
});
admin.delete('/floors/:id', (req, res) => {
  const floor = db.prepare('SELECT * FROM floors WHERE id = ?').get(num(req.params.id));
  if (floor?.image) fs.rm(path.join(UPLOAD_DIR, path.basename(floor.image)), { force: true }, () => {});
  db.prepare('DELETE FROM floors WHERE id = ?').run(num(req.params.id));
  res.json({ ok: true });
});

// --- nuqtalar ---
function placeFields(b) {
  return [
    num(b?.floor_id), num(b?.x), num(b?.y), str(b?.category, 30) || 'other',
    str(b?.name_uz, 120), str(b?.name_ru, 120), str(b?.name_en, 120),
    str(b?.description, 600), str(b?.link_code, 30), b?.active === false ? 0 : 1,
  ];
}
function validPlace(f) {
  return f[0] !== null && f[1] !== null && f[2] !== null && f[4] && db.prepare('SELECT 1 FROM floors WHERE id = ?').get(f[0]);
}
admin.get('/places', (req, res) => res.json(listPlaces()));
admin.post('/places', (req, res) => {
  const f = placeFields(req.body);
  if (!validPlace(f)) return res.status(400).json({ error: 'Nom (oʻzbekcha), qavat va joylashuv kerak' });
  const r = db.prepare(
    'INSERT INTO places (floor_id, x, y, category, name_uz, name_ru, name_en, description, link_code, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(...f);
  res.json({ id: Number(r.lastInsertRowid) });
});
admin.put('/places/:id', (req, res) => {
  const f = placeFields(req.body);
  if (!validPlace(f)) return res.status(400).json({ error: 'Nom (oʻzbekcha), qavat va joylashuv kerak' });
  db.prepare(
    'UPDATE places SET floor_id = ?, x = ?, y = ?, category = ?, name_uz = ?, name_ru = ?, name_en = ?, description = ?, link_code = ?, active = ? WHERE id = ?',
  ).run(...f, num(req.params.id));
  res.json({ ok: true });
});
admin.delete('/places/:id', (req, res) => {
  db.prepare('DELETE FROM places WHERE id = ?').run(num(req.params.id));
  res.json({ ok: true });
});

// --- murojaatlar ---
admin.get('/feedback', (req, res) => res.json(db.prepare('SELECT * FROM feedback ORDER BY id DESC LIMIT 500').all()));
admin.put('/feedback/:id', (req, res) => {
  const status = ['new', 'seen', 'done'].includes(req.body?.status) ? req.body.status : 'seen';
  db.prepare('UPDATE feedback SET status = ? WHERE id = ?').run(status, num(req.params.id));
  res.json({ ok: true });
});
admin.delete('/feedback/:id', (req, res) => {
  db.prepare('DELETE FROM feedback WHERE id = ?').run(num(req.params.id));
  res.json({ ok: true });
});

// --- suhbatlar jurnali ---
admin.get('/logs', (req, res) => {
  const limit = Math.min(Math.max(num(req.query.limit) || 200, 1), 1000);
  res.json(db.prepare('SELECT * FROM chat_logs ORDER BY id DESC LIMIT ?').all(limit));
});
admin.delete('/logs', (req, res) => {
  db.exec('DELETE FROM chat_logs');
  res.json({ ok: true });
});

// --- sozlamalar ---
admin.get('/settings', (req, res) => res.json(getSettings()));
admin.put('/settings', (req, res) => res.json(saveSettings(req.body || {})));
admin.get('/models', wrap(async (req, res) => res.json(await listModels())));
admin.post('/test-ai', wrap(async (req, res) => {
  const text = str(req.body?.text, 1000);
  if (!text) return res.status(400).json({ error: 'Savol boʻsh' });
  const started = Date.now();
  const out = await chat({ text, kioskId: num(req.body?.kiosk) });
  res.json({ ...out, ms: Date.now() - started });
}));
admin.post('/test-tts', wrap(async (req, res) => {
  const buf = await synthesize(str(req.body?.text, 600));
  res.setHeader('Content-Type', 'audio/wav');
  res.end(buf);
}));
admin.post('/fids/refresh', wrap(async (req, res) => {
  await refreshFlights();
  res.json(fidsStatus());
}));

// ---------- statik fayllar ----------
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d', immutable: true }));
app.use('/fonts/manrope', express.static(path.join(ROOT, 'node_modules/@fontsource-variable/manrope/files'), { maxAge: '30d' }));
app.use('/fonts/orbitron', express.static(path.join(ROOT, 'node_modules/@fontsource/orbitron/files'), { maxAge: '30d' }));
app.get('/vendor/globe.gl.min.js', (req, res) => {
  res.sendFile(path.join(ROOT, 'node_modules/globe.gl/dist/globe.gl.min.js'), { maxAge: '30d' });
});
// "O'ylayapman" holatidagi nuqtali yer shari (cobe, ES modul)
app.get('/vendor/cobe.js', (req, res) => {
  res.sendFile(path.join(ROOT, 'node_modules/cobe/dist/index.esm.js'), { maxAge: '30d' });
});
app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

app.use('/api', (req, res) => res.status(404).json({ error: 'Topilmadi' }));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  const status = err instanceof AiError ? err.status : err.status || err.statusCode || 500;
  if (status >= 500) console.error(`[xato] ${req.method} ${req.path}:`, err.message);
  res.status(status).json({ error: err.message || 'Server xatosi' });
});

startFlightSync();
app.listen(env.PORT, env.HOST, () => {
  const host = env.HOST === '0.0.0.0' ? 'localhost' : env.HOST;
  console.log(`ACCESS kiosk:  http://${host}:${env.PORT}`);
  console.log(`Admin panel:   http://${host}:${env.PORT}/admin`);
  if (env.generatedPassword) console.log(`Admin paroli yaratildi (.env faylida): ${env.generatedPassword}`);
  if (!env.ADMIN_PASSWORD) console.warn('DIQQAT: ADMIN_PASSWORD boʻsh — admin panelga kirib boʻlmaydi (.env ni toʻldiring).');
  if (!env.GEMINI_API_KEY) console.warn('DIQQAT: GEMINI_API_KEY boʻsh — AI javoblari ishlamaydi (.env ni toʻldiring).');
});
