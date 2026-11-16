// Reyslar tablosi: https://bot.uzairports.com/fids sahifasidagi jadvalni o'qiydi va xotirada saqlaydi.
import * as cheerio from 'cheerio';
import { getSettings } from './db.js';
import { TZ_OFFSET } from './config.js';

const BASE = 'https://bot.uzairports.com/fids/schedule';
const REFRESH_MS = 60_000;
const TYPES = ['DEPARTURE', 'ARRIVAL'];
const MONTHS = {
  JANUARY: 1, FEBRUARY: 2, MARCH: 3, APRIL: 4, MAY: 5, JUNE: 6,
  JULY: 7, AUGUST: 8, SEPTEMBER: 9, OCTOBER: 10, NOVEMBER: 11, DECEMBER: 12,
};

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

function parseDateHeader(text) {
  const m = clean(text).match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!m) return null;
  const month = MONTHS[m[2].toUpperCase()];
  if (!month) return null;
  return `${m[3]}-${String(month).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function statusKind(text) {
  const t = text.toLowerCase();
  if (/cancel/.test(t)) return 'cancelled';
  if (/delay|expected/.test(t)) return 'delayed';
  if (/depart/.test(t)) return 'departed';
  if (/arriv|landed/.test(t)) return 'arrived';
  if (/check-?in/.test(t)) return 'checkin';
  if (/board/.test(t)) return 'boarding';
  if (/gate|closed/.test(t)) return 'closed';
  return 'scheduled';
}

/** FIDS jadval HTML ini reyslar ro'yxatiga aylantiradi. */
export function parseSchedule(html, airport, type) {
  const $ = cheerio.load(html);
  const flights = [];
  let date = null;
  $('table.flights-table tbody tr').each((_, tr) => {
    const $tr = $(tr);
    if ($tr.hasClass('date-row')) {
      date = parseDateHeader($tr.text()) || date;
      return;
    }
    const time = clean($tr.find('.flight-time').text());
    const flight = clean($tr.find('.flight-number').text());
    if (!date || !/^\d{2}:\d{2}$/.test(time) || !flight) return;
    const status = clean($tr.find('.flight-status').text());
    const extra = clean($tr.find('.flight-gate').text()).replace(/^[—–-]$/, '');
    flights.push({
      airport,
      type,
      date,
      time,
      ts: Date.parse(`${date}T${time}:00${TZ_OFFSET}`),
      airline: clean($tr.find('.airline-logo img').attr('alt')) || flight.split(' ')[0],
      flight,
      city: clean($tr.find('.flight-destination .city').text()),
      code: clean($tr.find('.flight-destination .code').text()).replace(/[()]/g, ''),
      status,
      statusKind: statusKind(status),
      // Uchishda — ro'yxatdan o'tish peshtaxtalari, qo'nishda — bagaj lentasi
      desk: extra,
    });
  });
  return flights;
}

const boards = new Map(); // "TAS2:DEPARTURE" -> { flights, fetchedAt, error }

async function fetchBoard(airport, type) {
  const url = `${BASE}?airport=${encodeURIComponent(airport)}&flight_type=${type}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'ACCESS-Kiosk/1.0 (Tashkent airport information kiosk)' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`FIDS HTTP ${res.status}`);
  return parseSchedule(await res.text(), airport, type);
}

export async function refreshFlights() {
  const airports = getSettings().airports.map((a) => a.code);
  for (const airport of airports) {
    for (const type of TYPES) {
      const key = `${airport}:${type}`;
      const prev = boards.get(key);
      try {
        const flights = await fetchBoard(airport, type);
        boards.set(key, { flights, fetchedAt: Date.now(), error: '' });
      } catch (err) {
        // Xato bo'lsa oxirgi muvaffaqiyatli ma'lumot saqlanib qoladi
        boards.set(key, { flights: prev?.flights || [], fetchedAt: prev?.fetchedAt || 0, error: String(err.message || err) });
      }
    }
  }
}

let timer = null;
export function startFlightSync() {
  if (timer) return;
  refreshFlights().catch(() => {});
  timer = setInterval(() => refreshFlights().catch(() => {}), REFRESH_MS);
}

export function fidsStatus() {
  return [...boards.entries()].map(([key, b]) => ({
    board: key, count: b.flights.length, fetchedAt: b.fetchedAt, error: b.error,
  }));
}

export function getFlights({ airport, type } = {}) {
  let list = [];
  let fetchedAt = 0;
  let error = '';
  for (const [key, b] of boards) {
    const [a, t] = key.split(':');
    if (airport && a !== airport) continue;
    if (type && t !== type) continue;
    list = list.concat(b.flights);
    fetchedAt = fetchedAt ? Math.min(fetchedAt, b.fetchedAt) : b.fetchedAt;
    if (b.error) error = b.error;
  }
  list.sort((a, b) => a.ts - b.ts);
  return { flights: list, fetchedAt, stale: !fetchedAt || Date.now() - fetchedAt > 5 * REFRESH_MS, error };
}

// Umumiy savolda ("qanday reyslar bor?") ko'rsatiladigan vaqt oynasi: hozirdan 1 soat oldin — 4 soat keyin.
// Kioskdagi tablo ham shu qiymatlardan foydalanadi (public/js/app.js: WINDOW_BEFORE_MS / WINDOW_AFTER_MS).
export const WINDOW_BEFORE_MS = 1 * 3600_000;
export const WINDOW_AFTER_MS = 4 * 3600_000;

const hhmm = (ts) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ts);

/**
 * AI uchun qidiruv. query — shahar nomi (inglizcha), IATA kodi, reys raqami yoki aviakompaniya kodi.
 * - sana berilsa — o'sha kunning reyslari;
 * - aks holda — faqat [hozir − 1 soat, hozir + 4 soat] oralig'idagi reyslar (yo'nalish so'ralganda ham);
 *   yo'nalish bo'yicha bu oraliqda reys bo'lmasa — keyingi eng yaqin 3 tasi (outside_window: true).
 */
export function searchFlights({ direction, query, date, limit = 15 } = {}, source = null, now = Date.now()) {
  const type = direction === 'arrival' ? 'ARRIVAL' : direction === 'departure' ? 'DEPARTURE' : null;
  const all = source || getFlights({ type }).flights;
  let list = type ? all.filter((f) => f.type === type) : all;
  const q = norm(query);
  if (q) {
    list = list.filter(
      (f) => norm(f.city).includes(q) || norm(f.code) === q || norm(f.flight).includes(q) || norm(f.airline) === q,
    );
  }
  let timeWindow = null;
  let outside = false;
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    list = list.filter((f) => f.date === date);
  } else {
    const from = now - WINDOW_BEFORE_MS;
    const to = now + WINDOW_AFTER_MS;
    timeWindow = { from: hhmm(from), to: hhmm(to) };
    const inWindow = list.filter((f) => f.ts >= from && f.ts <= to);
    if (inWindow.length || !q) {
      list = inWindow;
    } else {
      // so'ralgan yo'nalishga yaqin soatlarda reys yo'q — keyingi eng yaqinlari
      list = list.filter((f) => f.ts > to).slice(0, 3);
      outside = list.length > 0;
    }
  }
  const matches = list.slice(0, Math.max(1, Math.min(limit, 25))).map((f) => ({
    direction: f.type === 'ARRIVAL' ? 'arrival' : 'departure',
    terminal: f.airport,
    date: f.date,
    time: f.time,
    flight: f.flight,
    city: f.city,
    iata: f.code,
    status: f.status,
    ...(f.type === 'ARRIVAL' ? { baggage_belt: f.desk || null } : { checkin_desks: f.desk || null }),
  }));
  const out = {
    total_found: list.length,
    ...(timeWindow ? { time_window: timeWindow } : {}),
    ...(outside ? { outside_window: true } : {}),
    flights: matches,
  };
  if (!matches.length && q) {
    // Model shahar nomini to'g'rilab qayta qidira olishi uchun mavjud yo'nalishlar
    const pool = type ? all.filter((f) => f.type === type) : all;
    out.available_cities = [...new Set(pool.map((f) => `${f.city} (${f.code})`))].sort().slice(0, 150);
  }
  return out;
}
