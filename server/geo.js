// Aeroportlar koordinatalari (IATA kodi bo'yicha) — globusda yo'nalishni chizish uchun.
import fs from 'node:fs';
import path from 'node:path';

// { "IST": [kenglik, uzunlik, "TR"] }
const AIRPORTS = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'airports.json'), 'utf8'));

// Asosiy jadvalda yo'q aeroportlar (koordinatalar taxminiy — shahar bo'yicha).
const EXTRA = {
  FRU: [43.0613, 74.4776, 'KG'], // Bishkek, Manas
  IYO: [38.41, 67.95, 'UZ'], // Sariosiyo
  RBZ: [39.07, 66.76, 'UZ'], // Shahrisabz
};

export const HOME_CODE = 'TAS';

export function airportGeo(code) {
  const key = String(code || '').toUpperCase();
  const a = AIRPORTS[key] || EXTRA[key];
  return a ? { lat: a[0], lng: a[1], country: a[2] } : null;
}

/** Reyslar ro'yxatidagi barcha aeroportlar uchun { KOD: { lat, lng, country } }. */
export function geoForFlights(flights) {
  const out = {};
  for (const f of flights) {
    if (f.code in out) continue;
    const g = airportGeo(f.code);
    if (g) out[f.code] = g;
  }
  return out;
}
