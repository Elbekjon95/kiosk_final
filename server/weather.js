// Uchib ketadigan reyslar shaharlari ob-havosi (OpenWeather). Toshkent ob-havosi alohida — index.js da (Open-Meteo).
import { env } from './config.js';
import { getFlights } from './fids.js';
import { airportGeo } from './geo.js';

const API = 'https://api.openweathermap.org/data/2.5/weather';
const TTL_MS = 20 * 60_000; // bir shahar ob-havosi 20 daqiqa keshda turadi
const RETRY_MS = 2 * 60_000; // xato bo'lsa 2 daqiqadan keyin qayta urinish
export const MAX_BATCH = 8; // bir so'rovda nechta shahar (kiosk 6 tadan so'raydi)

const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export const weatherReady = () => Boolean(env.OPENWEATHER_API_KEY);

/**
 * Tablodagi hali uchib ketmagan reyslar shaharlari — eng yaqin reys bo'yicha tartiblangan.
 * Bir shaharning ikki aeroporti (IST va SAW) bitta shahar bo'lib chiqadi.
 */
export function destinationCities({ now = Date.now(), flights = getFlights({ type: 'DEPARTURE' }).flights } = {}) {
  const byCity = new Map();
  for (const f of flights) {
    if (f.statusKind === 'departed' || f.statusKind === 'cancelled') continue;
    if (f.ts < now - 6 * 3600_000) continue; // kechikkanlar ham kirsin, lekin juda eskilar emas
    const key = norm(f.city) || norm(f.code);
    if (!key || byCity.has(key)) continue;
    const geo = airportGeo(f.code);
    byCity.set(key, {
      code: f.code, city: f.city, country: geo?.country || '', lat: geo?.lat ?? null, lng: geo?.lng ?? null,
      next: { date: f.date, time: f.time, flight: f.flight },
    });
  }
  return [...byCity.values()];
}

const cache = new Map(); // code -> { at, data, pending }

async function fetchCity(c) {
  const params = new URLSearchParams({ units: 'metric', appid: env.OPENWEATHER_API_KEY });
  if (c.lat !== null && c.lng !== null) {
    params.set('lat', c.lat);
    params.set('lon', c.lng);
  } else {
    params.set('q', c.city);
  }
  const res = await fetch(`${API}?${params}`, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`OpenWeather HTTP ${res.status}`);
  const j = await res.json();
  const w = j.weather?.[0] || {};
  return {
    temp: Math.round(j.main?.temp),
    humidity: j.main?.humidity ?? null,
    id: w.id ?? null, // holat kodi — kiosk uni o'zi tarjima qiladi
    day: !String(w.icon || '').endsWith('n'),
    description: w.description || '',
  };
}

/** Bitta shahar ob-havosi keshdan yoki OpenWeather'dan; bir vaqtda kelgan bir xil so'rovlar birlashtiriladi. */
function cityWeather(c) {
  const hit = cache.get(c.code);
  if (hit?.pending) return hit.pending;
  if (hit && Date.now() - hit.at < (hit.data ? TTL_MS : RETRY_MS)) return Promise.resolve(hit.data);
  const pending = fetchCity(c)
    .then((data) => {
      cache.set(c.code, { at: Date.now(), data });
      return data;
    })
    .catch(() => {
      // eski ma'lumot bo'lsa o'shani beramiz
      cache.set(c.code, { at: Date.now(), data: hit?.data || null });
      return hit?.data || null;
    });
  cache.set(c.code, { ...hit, pending });
  return pending;
}

/** codes — destinationCities() dagi kodlar; ro'yxatda yo'q kodlar e'tiborsiz qoladi (begona so'rovlar API ni sarflamasin). */
export async function weatherFor(codes) {
  const list = destinationCities();
  const known = new Map(list.map((c) => [c.code, c]));
  const wanted = [...new Set(codes)].filter((code) => known.has(code)).slice(0, MAX_BATCH);
  const results = await Promise.all(wanted.map((code) => cityWeather(known.get(code))));
  return Object.fromEntries(wanted.map((code, i) => [code, results[i]]));
}
