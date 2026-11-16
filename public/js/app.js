// ACCESS kiosk — asosiy boshqaruv: ovozli/matnli savol, javob, panellar, bo'sh turganda qayta tiklash.
import { ParticleField } from './particles.js';
import { Recorder, Speaker, getAudioContext } from './voice.js';
import { MapView } from './mapview.js';
import { GlobeView, greatCircle } from './globeview.js';
import { ThinkingGlobe } from './thinkglobe.js';
import { initKeyboard, setKeyboardLayout, hide as hideKeyboard } from './keyboard.js';
import { h, uiIcon, s } from './categories.js';
import { LANGS, t, pick, setLang, getLang, flightStatus, countryName, weatherText } from './i18n.js';

const $ = (id) => document.getElementById(id);
const TZ = 'Asia/Tashkent';
const kioskParam = Number(new URLSearchParams(location.search).get('kiosk')) || null;

const app = {
  config: null,
  mode: 'idle',
  turn: 0, // har bir yangi savol/bekor qilishda oshadi — eskirgan javoblar e'tiborsiz qoladi
  abort: null,
  history: [],
  panel: null,
  lastActivity: Date.now(),
  // window: true — faqat [hozir − 1 soat, hozir + 4 soat] oralig'idagi reyslar (umumiy savolga javob)
  flights: { type: 'DEPARTURE', airport: '', q: '', window: false, data: null, timer: 0 },
  globe: null, // { type, codes, query, data, shown }
  weather: null, // { cities, data, shown, loading, enabled, error }
  feedback: { type: 'complaint' },
};

// Maxfiy kod: ekran klaviaturasida terilsa admin panel ochiladi
const ADMIN_CODE = 'tasffxh';
// Butun ekranni egallaydigan panellar (sarlavha va pastki tugmalar yashiriladi)
const FULL_PANELS = ['map', 'flights', 'globe'];

const particles = new ParticleField($('fx'));
const recorder = new Recorder();
const speaker = new Speaker();
const mapView = new MapView($('panelBody'));
const globeView = new GlobeView();
const thinkGlobe = new ThinkingGlobe($('thinkGlobe'));

/** Zarrachalar shaklini sahna maydoniga moslaydi (sarlavha va pastki tugmalar orasiga). */
function layoutFx() {
  if (document.body.classList.contains('panel-full')) return; // to'liq ekranli panel ostida sahna o'lchami vaqtincha boshqa
  const r = document.querySelector('.stage').getBoundingClientRect();
  if (!r.height) return;
  const cy = r.top + r.height * 0.42;
  const radius = Math.min(r.height * 0.46, r.width * 0.42);
  particles.setFocus(cy, radius);
  thinkGlobe.setFocus(cy, radius);
}

// ---------- holat ----------
function setMode(mode) {
  app.mode = mode;
  document.body.dataset.mode = mode;
  particles.setMode(mode);
  thinkGlobe.setActive(mode === 'thinking'); // o'ylayotganda — zarrachalar o'rniga aylanuvchi yer shari
  if (mode === 'idle' || mode === 'thinking') particles.setLevel(0);
  $('stateLabel').textContent = mode === 'idle' ? t('tapMic') : t(mode);
  $('pauseBtn').replaceChildren(uiIcon(speaker.paused ? 'play' : 'pause', 20));
}

function showHeard(text) {
  $('heard').hidden = !text;
  $('heard').textContent = text ? `${t('you')}: ${text}` : '';
}
function showAnswer(text) {
  $('answer').textContent = text;
  $('bubble').classList.toggle('empty', !text && $('heard').hidden);
  $('bubble').classList.toggle('long', text.length > 180);
}
const touch = () => { app.lastActivity = Date.now(); };

/** Joriy tinglash/so'rov/nutqni to'xtatadi. */
function cancelTurn() {
  app.turn++;
  app.abort?.abort();
  app.abort = null;
  recorder.stop(false);
  speaker.stop();
  setMode('idle');
}

// ---------- savol-javob ----------
async function ask({ text, audio }) {
  const turn = ++app.turn;
  app.abort?.abort();
  speaker.stop();
  if (!app.config?.aiReady) {
    showHeard(text || '');
    showAnswer(t('aiOff'));
    setMode('idle');
    return;
  }
  const abort = new AbortController();
  app.abort = abort;
  setMode('thinking');
  showHeard(text || '');
  showAnswer('…');
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, audio, history: app.history, kiosk: app.config.kioskId }),
      signal: abort.signal,
    });
    const data = await res.json();
    if (turn !== app.turn) return;
    if (!res.ok) throw new Error(data.error || res.statusText);

    if (LANGS.some((l) => l.code === data.lang) && data.lang !== getLang()) applyLang(data.lang, { keepBubble: true });
    const heard = data.heard || text || '';
    showHeard(heard);
    showAnswer(data.answer || t('notHeard'));
    if (heard && data.answer) app.history = [...app.history, { q: heard, a: data.answer }].slice(-4);
    runAction(data.action, turn);

    setMode('speaking');
    await speaker.speak(data.answer, data.lang || getLang(), app.config.settings.tts_provider, {
      onLevel: (v) => particles.setLevel(v), signal: abort.signal,
    });
  } catch (err) {
    if (turn !== app.turn || abort.signal.aborted) return;
    console.error(err);
    showAnswer(t('errorGeneric'));
  } finally {
    if (turn === app.turn) {
      setMode('idle');
      touch();
    }
  }
}

function runAction(action, turn) {
  if (!action || action.type === 'none') return;
  if (action.type === 'route') openPanel('map', { placeId: action.place_id });
  else if (action.type === 'flights') showFlights(action, turn);
  else if (action.type === 'feedback') openPanel('feedback');
  else if (action.type === 'operator') openPanel('operator');
}

/**
 * Reys haqidagi javob: savol bitta shahar yoki bitta reys haqida bo'lsa — globusda yo'nalish,
 * aks holda (aviakompaniya, umumiy ro'yxat) — reyslar tablosi.
 */
async function showFlights(action, turn) {
  const f = app.flights;
  f.type = action.direction === 'arrival' ? 'ARRIVAL' : 'DEPARTURE';
  f.q = action.query || '';
  f.airport = '';
  f.window = true; // savolga javobda — faqat yaqin soatlar (yo'nalish so'ralganda ham)
  const q = normQuery(f.q);
  if (q) {
    try {
      const data = await fetchBoard(f.type);
      if (turn !== app.turn) return;
      const matched = data.flights.filter((x) => matchesQuery(x, q));
      const upcoming = limitToWindow(matched);
      const codes = [...new Set((upcoming.length ? upcoming : matched).map((x) => x.code))];
      if (codes.length && codes.length <= 3 && codes.every((c) => data.geo?.[c])) {
        openPanel('globe', { type: f.type, codes, query: f.q, data });
        return;
      }
    } catch (err) {
      console.warn(err);
    }
    if (turn !== app.turn) return;
  }
  openPanel('flights');
}

async function onMic() {
  touch();
  getAudioContext();
  if (app.mode === 'listening') {
    recorder.stop(true);
    return;
  }
  cancelTurn();
  const turn = app.turn;
  hideKeyboard();
  setMode('listening');
  showHeard('');
  showAnswer('');
  try {
    const audio = await recorder.record({ onLevel: (v) => { particles.setLevel(v); if (v > 0.2) { touch(); lastInput = Date.now(); } } });
    if (turn !== app.turn) return;
    if (!audio) {
      showAnswer(t('notHeard'));
      setMode('idle');
      return;
    }
    await ask({ audio });
  } catch (err) {
    if (turn !== app.turn) return;
    console.warn(err);
    showAnswer(t('micDenied'));
    setMode('idle');
  }
}

// ---------- til ----------
// Til tanlash tugmasi yo'q: yo'lovchi qaysi tilda so'rasa, AI o'sha tilda javob beradi.
// Ekrandagi yozuvlar ham (tarjimasi bor bo'lsa) javob tiliga o'tadi, bo'sh turganda asosiy tilga qaytadi.
function applyLang(code, { keepBubble = false } = {}) {
  setLang(code);
  setKeyboardLayout(getLang());
  const st = app.config?.settings;
  const dock = [['btnMap', 'map', 'map'], ['btnOperator', 'phone', 'operator'], ['btnFlights', 'plane', 'flights'], ['btnFeedback', 'chat', 'feedback']];
  for (const [id, icon, key] of dock) $(id).replaceChildren(uiIcon(icon, 24), h('span', null, t(key)));
  $('askInput').placeholder = t('askPlaceholder');
  $('statusText').textContent = pick(st?.status_text);
  $('stateLabel').textContent = app.mode === 'idle' ? t('tapMic') : t(app.mode);
  if (!keepBubble) {
    showHeard('');
    showAnswer(pick(st?.welcome));
  }
  if (app.panel) renderPanel();
}

// ---------- panellar ----------
function openPanel(name, opts = {}) {
  app.panel = name;
  hideKeyboard();
  document.body.classList.add('panel-open');
  document.body.classList.toggle('panel-full', FULL_PANELS.includes(name));
  $('panel').hidden = false;
  $('panel').dataset.name = name;
  if (name === 'map') {
    if (opts.placeId) mapView.select(opts.placeId, opts.note);
  }
  clearInterval(app.flights.timer);
  if (name === 'flights') {
    loadFlights();
    app.flights.timer = setInterval(loadFlights, 60_000);
  }
  if (name === 'weather') {
    app.weather = { cities: null, data: {}, shown: 0, loading: false, enabled: true, error: false };
    loadDestinations();
  }
  if (name === 'globe') {
    app.globe = { type: opts.type, codes: opts.codes, query: opts.query || '', data: opts.data, shown: '' };
    app.flights.timer = setInterval(refreshGlobe, 60_000);
  } else {
    globeView.pause();
  }
  renderPanel();
}

function closePanel() {
  app.panel = null;
  clearInterval(app.flights.timer);
  globeView.pause();
  hideKeyboard();
  document.body.classList.remove('panel-open', 'panel-full');
  $('panel').hidden = true;
  $('panelBody').replaceChildren();
}

function renderPanel() {
  const titles = { map: 'mapTitle', flights: 'flights', globe: 'route', feedback: 'fbTitle', operator: 'opTitle', weather: 'weatherTitle' };
  $('panelTitle').textContent = t(titles[app.panel]);
  $('panelMic').title = t('askVoice');
  if (app.panel === 'map') mapView.render();
  else if (app.panel === 'flights') renderFlights();
  else if (app.panel === 'globe') renderGlobe();
  else if (app.panel === 'feedback') renderFeedback();
  else if (app.panel === 'operator') renderOperator();
  else if (app.panel === 'weather') renderWeatherPanel();
}

// --- reyslar ---
// Server bilan bir xil (server/fids.js): hozirdan 1 soat oldin — 4 soat keyin
const WINDOW_BEFORE_MS = 60 * 60_000;
const WINDOW_AFTER_MS = 4 * 60 * 60_000;
const RECENT_MS = WINDOW_BEFORE_MS; // yaqinda uchgan/qo'ngan reyslar ham ko'rinib turadi
const hhmm = (ts) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(ts);
const windowLabel = (now = Date.now()) => t('timeWindow', { from: hhmm(now - WINDOW_BEFORE_MS), to: hhmm(now + WINDOW_AFTER_MS) });
/** Faqat yaqin soatlardagi reyslar; bu oraliqda bittasi ham bo'lmasa — keyingi eng yaqin 3 tasi (serverdagi kabi). */
function limitToWindow(list, now = Date.now()) {
  const to = now + WINDOW_AFTER_MS;
  const inWindow = list.filter((x) => x.ts >= now - WINDOW_BEFORE_MS && x.ts <= to);
  return inWindow.length ? inWindow : list.filter((x) => x.ts > to).slice(0, 3);
}
const normQuery = (v) => String(v).toUpperCase().replace(/[^A-ZА-ЯЁ0-9]/g, '');
const matchesQuery = (x, q) => normQuery(x.city).includes(q) || normQuery(x.code) === q || normQuery(x.flight).includes(q);

async function fetchBoard(type) {
  const res = await fetch(`/api/flights?type=${type}`);
  if (!res.ok) throw new Error(`flights ${res.status}`);
  return res.json();
}

async function loadFlights() {
  const type = app.flights.type;
  try {
    const data = await fetchBoard(type);
    if (type !== app.flights.type) return;
    app.flights.data = data;
  } catch {
    app.flights.data = { ...(app.flights.data || { flights: [] }), stale: true };
  }
  if (app.panel === 'flights') renderFlightRows();
}

const dayKey = (ts) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(ts);
// Brauzerlarda o'zbekcha oy nomlari har doim ham bo'lmaydi — o'zimiz yozamiz
const MONTHS_UZ = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
function dayParts(date) {
  const [, month, day] = date.split('-').map(Number);
  const pretty = getLang() === 'uz'
    ? `${day}-${MONTHS_UZ[month - 1]}`
    : new Intl.DateTimeFormat(getLang(), { timeZone: 'UTC', day: 'numeric', month: 'long' }).format(new Date(`${date}T00:00:00Z`));
  const rel = date === dayKey(Date.now()) ? t('today') : date === dayKey(Date.now() + 86_400_000) ? t('tomorrow') : '';
  return { rel, pretty };
}
function dayLabel(date) {
  const { rel, pretty } = dayParts(date);
  return rel ? `${rel} · ${pretty}` : pretty;
}

function airlineLogo(code) {
  const logo = h('img', { src: `https://app.uzairports.com/storage/media/airlines/${encodeURIComponent(code)}.png`, alt: '', loading: 'lazy' });
  logo.addEventListener('error', () => logo.remove());
  return h('i', { class: 'logo-box' }, logo);
}

function renderFlights() {
  const f = app.flights;
  const airports = app.config.settings.airports;
  const tab = (type, key) =>
    h('button', {
      class: `chip big${f.type === type ? ' active' : ''}`,
      onclick: () => { f.type = type; f.data = null; renderFlights(); loadFlights(); },
    }, t(key));
  const term = (code, label) =>
    h('button', { class: `chip${f.airport === code ? ' active' : ''}`, onclick: () => { f.airport = code; renderFlights(); } }, label);

  $('panelBody').replaceChildren(
    h('div', { class: 'flights-bar' },
      h('div', { class: 'row' }, tab('DEPARTURE', 'departures'), tab('ARRIVAL', 'arrivals'),
        h('button', {
          class: `chip big${f.window ? ' active' : ''}`, id: 'windowChip',
          onclick: () => { f.window = !f.window; renderFlights(); },
        }, windowLabel())),
      h('div', { class: 'row' }, term('', t('allTerminals')), airports.map((a) => term(a.code, pick(a.name)))),
      h('input', {
        class: 'search', type: 'search', placeholder: t('searchFlight'), value: f.q,
        oninput: (e) => { f.q = e.target.value; renderFlightRows(); },
      })),
    h('div', { class: 'flights-head' },
      h('span', null, t('colTime')), h('span', null, t('colFlight')),
      h('span', null, t(f.type === 'ARRIVAL' ? 'colFrom' : 'colTo')), h('span', null, t('colStatus')),
      h('span', null, t(f.type === 'ARRIVAL' ? 'colBelt' : 'colDesks'))),
    h('div', { class: 'flights-list', id: 'flightsList' }),
    h('div', { class: 'flights-foot', id: 'flightsFoot' }),
  );
  renderFlightRows();
}

function renderFlightRows() {
  const list = $('flightsList');
  if (!list) return;
  const f = app.flights;
  if (!f.data) {
    list.replaceChildren(h('div', { class: 'empty' }, '…'));
    return;
  }
  const q = normQuery(f.q);
  const now = Date.now();
  const airports = terminalNames();
  let rows = f.data.flights.filter((x) => (!f.airport || x.airport === f.airport) && (!q || matchesQuery(x, q)));
  if (f.window) rows = limitToWindow(rows, now);
  else if (!q) rows = rows.filter((x) => x.ts >= now - RECENT_MS);
  // vaqt o'tgani sari oyna chegaralari ham yangilanib tursin
  if ($('windowChip')) $('windowChip').textContent = windowLabel(now);

  const nodes = [];
  let day = '';
  for (const x of rows.slice(0, 250)) {
    if (x.date !== day) {
      day = x.date;
      nodes.push(h('div', { class: 'flights-day' }, dayLabel(day)));
    }
    // Reys bosilsa: ro'yxatdan o'tish ochiq bo'lsa — xaritada peshtaxtalarga yo'l, aks holda — globusda yo'nalish
    const zone = checkinPlaceFor(x);
    const onTap = zone
      ? () => openCheckin(x, zone)
      : f.data.geo?.[x.code] && f.data.home
        ? () => openPanel('globe', { type: x.type, codes: [x.code], query: x.city, data: f.data })
        : null;
    nodes.push(h('div', { class: `flight ${x.statusKind}${onTap ? ' tappable' : ''}`, onclick: onTap },
      h('span', { class: 'f-time' }, x.time),
      h('span', { class: 'f-num' }, airlineLogo(x.airline), x.flight),
      h('span', { class: 'f-city' }, h('b', null, x.city), h('small', null, `${x.code} · ${airports[x.airport] || x.airport}`)),
      h('span', { class: 'f-status' }, h('em', null, flightStatus(x.status)), zone ? h('i', { class: 'to-map' }, uiIcon('map', 16)) : null),
      h('span', { class: 'f-desk' }, x.desk || '—')));
  }
  if (!nodes.length) nodes.push(h('div', { class: 'empty' }, t('noFlights')));
  list.replaceChildren(...nodes);

  const time = f.data.stale
    ? ''
    : new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(f.data.fetchedAt);
  $('flightsFoot').replaceChildren(
    h('span', null, t('tapFlight')),
    h('span', { class: f.data.stale ? 'warn' : '' }, f.data.stale ? t('flightsStale') : `${t('updatedAt')}: ${time}`));
}

const terminalNames = () => Object.fromEntries(app.config.settings.airports.map((a) => [a.code, pick(a.name)]));

// --- ro'yxatdan o'tish joyiga yo'l ---
/** Kiosk turgan terminal kodi (TAS2/TAS3): kiosk qavati nomida terminal nomi bo'lsa ("Xalqaro terminal — uchish zali"). */
function kioskTerminal() {
  const { places, floors, kioskId, settings } = app.config;
  const kiosk = places.find((p) => p.id === kioskId);
  const floorName = String(floors.find((f) => f.id === kiosk?.floor_id)?.name || '').toLowerCase();
  if (!floorName) return null;
  return settings.airports.find((a) => Object.values(a.name).some((n) => n && floorName.includes(String(n).toLowerCase())))?.code || null;
}

/**
 * Ro'yxatdan o'tish ochiq reys uchun xaritadagi zona. Admin zona izohiga peshtaxtalar oralig'ini yozsa ("1-24"),
 * peshtaxta raqami bo'yicha o'sha zona; aks holda kioskka eng yaqin zona. Xaritasi yo'q terminal reysi uchun — null.
 */
function checkinPlaceFor(x) {
  if (x.type !== 'DEPARTURE' || x.statusKind !== 'checkin') return null;
  const term = kioskTerminal();
  if (term && x.airport !== term) return null;
  const { places, kioskId } = app.config;
  const zones = places.filter((p) => p.category === 'checkin');
  if (!zones.length) return null;
  const desk = Number(String(x.desk).match(/\d+/)?.[0]);
  if (desk) {
    for (const z of zones) {
      for (const m of String(z.description || '').matchAll(/(\d+)\s*[-–—]\s*(\d+)/g)) {
        if (desk >= Number(m[1]) && desk <= Number(m[2])) return z;
      }
    }
  }
  const k = places.find((p) => p.id === kioskId);
  if (!k) return zones[0];
  const d = (p) => (p.floor_id === k.floor_id ? Math.hypot(p.x - k.x, p.y - k.y) : Infinity);
  return [...zones].sort((a, b) => d(a) - d(b))[0];
}

function openCheckin(x, zone) {
  touch();
  openPanel('map', { placeId: zone.id, note: `${x.flight} → ${titleCase(x.city)} · ${t('colDesks')}: ${x.desk || '—'}` });
}

// --- globus: yo'nalish ---
const titleCase = (text) => String(text).toLowerCase().replace(/(^|[\s\-(/])(\p{L})/gu, (m, sep, ch) => sep + ch.toUpperCase());

function renderGlobe() {
  const g = app.globe;
  const { data } = g;
  const arrival = g.type === 'ARRIVAL';
  const cityOf = (code) => titleCase(data.flights.find((x) => x.code === code)?.city || code);
  const mainCity = cityOf(g.codes[0]);
  const home = { ...data.home, label: t('homeCity') };
  // Bir shaharning ikkinchi aeroporti (masalan IST va SAW) faqat kodi bilan belgilanadi
  const dests = g.codes.map((code, i) => ({ code, ...data.geo[code], label: i === 0 || cityOf(code) !== mainCity ? cityOf(code) : '' }));
  const destCodes = g.codes.join(' · ');
  const km = Math.round(greatCircle(home, dests[0]).km / 10) * 10;
  const country = dests[0].country !== home.country ? countryName(dests[0].country) : '';

  $('panelBody').replaceChildren(
    globeView.host,
    h('div', { class: 'globe-route' },
      h('div', { class: 'globe-dir' }, uiIcon('plane', 18), t(arrival ? 'arrivals' : 'departures')),
      h('h3', null, arrival ? mainCity : home.label, h('i', null, '→'), arrival ? home.label : mainCity),
      h('div', { class: 'globe-codes' }, arrival ? `${destCodes} → ${home.code}` : `${home.code} → ${destCodes}`),
      h('div', { class: 'row' },
        country ? h('span', { class: 'badge' }, country) : null,
        h('span', { class: 'badge' }, `≈ ${km.toLocaleString('ru-RU')} km`))),
    h('aside', { class: 'globe-side', id: 'globeSide' },
      h('h4', null, t('upcomingFlights')),
      h('div', { class: 'globe-cards', id: 'globeCards' }),
      h('button', {
        class: 'dock-btn', type: 'button',
        onclick: () => {
          app.flights.type = g.type;
          app.flights.q = g.query;
          app.flights.airport = '';
          openPanel('flights');
        },
      }, uiIcon('plane', 22), h('span', null, t('allFlights')))),
  );
  renderGlobeCards();
  layoutGlobe();

  const key = `${getLang()}:${g.type}:${g.codes.join(',')}`;
  if (g.shown === key) return;
  g.shown = key;
  globeView.show({ home, dests, arrival }).catch((err) => {
    // WebGL yo'q yoki fayllar yuklanmadi — oddiy tabloni ko'rsatamiz
    console.warn(err);
    if (app.panel !== 'globe' || app.globe !== g) return;
    app.flights.type = g.type;
    app.flights.q = g.query;
    openPanel('flights');
  });
}

function renderGlobeCards() {
  const list = $('globeCards');
  if (!list) return;
  const g = app.globe;
  const airports = terminalNames();
  const rows = limitToWindow(g.data.flights.filter((x) => x.type === g.type && g.codes.includes(x.code))).slice(0, 12);
  const deskLabel = t(g.type === 'ARRIVAL' ? 'colBelt' : 'colDesks');
  const cards = rows.map((x) => {
    const { rel, pretty } = dayParts(x.date);
    const zone = checkinPlaceFor(x);
    return h('div', { class: `gcard ${x.statusKind}${zone ? ' tappable' : ''}`, onclick: zone ? () => openCheckin(x, zone) : null },
      h('div', { class: 'g-time' }, h('b', null, x.time), h('small', null, rel || pretty)),
      h('div', { class: 'g-main' },
        h('span', { class: 'g-num' }, airlineLogo(x.airline), x.flight),
        h('small', null, `${x.code} · ${airports[x.airport] || x.airport}`)),
      h('div', { class: 'g-state' },
        h('em', null, flightStatus(x.status), zone ? h('i', { class: 'to-map' }, uiIcon('map', 14)) : null),
        x.desk ? h('small', null, `${deskLabel}: ${x.desk}`) : null));
  });
  list.replaceChildren(...(cards.length ? cards : [h('div', { class: 'empty small' }, t('noFlights'))]));
}

/** Globusni reyslar ro'yxati yopmagan bo'sh joyning o'rtasiga suradi. */
function layoutGlobe() {
  const side = $('globeSide');
  if (app.panel !== 'globe' || !side) return;
  const body = $('panelBody').getBoundingClientRect();
  const r = side.getBoundingClientRect();
  if (!body.height) return;
  if (r.width > body.width * 0.7) {
    // ro'yxat pastda (tik ekran)
    globeView.setFrame(0, -(body.bottom - r.top) / 2, Math.min(body.width, r.top - body.top) / body.height);
  } else {
    // ro'yxat o'ngda
    globeView.setFrame(-(body.right - r.left) / 2, 0, Math.min(r.left - body.left, body.height) / body.height);
  }
}

async function refreshGlobe() {
  const g = app.globe;
  try {
    const data = await fetchBoard(g.type);
    if (app.globe !== g || app.panel !== 'globe') return;
    g.data = { ...data, geo: { ...g.data.geo, ...data.geo } };
    renderGlobeCards();
  } catch { /* eski ro'yxat qoladi */ }
}

// --- murojaat ---
function renderFeedback() {
  const fb = app.feedback;
  const types = [['complaint', 'fbComplaint'], ['suggestion', 'fbSuggestion'], ['thanks', 'fbThanks']];
  const message = h('textarea', { class: 'field', rows: 3, maxLength: 3000, placeholder: t('fbPlaceholder'), value: fb.message || '' });
  message.addEventListener('input', () => { fb.message = message.value; touch(); });
  const contact = h('input', { class: 'field', type: 'text', maxLength: 120, placeholder: t('fbContact'), value: fb.contact || '' });
  contact.addEventListener('input', () => { fb.contact = contact.value; });
  const note = h('div', { class: 'form-note' });

  const dictate = h('button', { class: 'dock-btn', type: 'button' }, uiIcon('mic', 22), h('span', null, t('fbDictate')));
  dictate.addEventListener('click', async () => {
    getAudioContext();
    if (recorder.active) return recorder.stop(true);
    cancelTurn();
    dictate.classList.add('recording');
    particles.setMode('listening');
    try {
      const audio = await recorder.record({ onLevel: (v) => particles.setLevel(v) });
      if (audio) {
        note.textContent = '…';
        const res = await fetch('/api/transcribe', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ audio }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        if (data.text) {
          fb.message = `${fb.message ? `${fb.message.trim()} ` : ''}${data.text}`;
          message.value = fb.message;
        }
        note.textContent = '';
      }
    } catch (err) {
      note.textContent = /mic/.test(err.message) ? t('micDenied') : t('errorGeneric');
    } finally {
      dictate.classList.remove('recording');
      particles.setMode(app.mode);
      touch();
    }
  });

  const form = h('form', { class: 'feedback-form' },
    h('div', { class: 'row' }, types.map(([type, key]) =>
      h('button', {
        type: 'button', class: `chip big${fb.type === type ? ' active' : ''}`,
        onclick: () => { fb.type = type; renderFeedback(); },
      }, t(key)))),
    message, note,
    h('div', { class: 'row send-row' }, contact, dictate,
      h('button', { class: 'dock-btn primary', type: 'submit' }, uiIcon('send', 22), h('span', null, t('send')))));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if ((fb.message || '').trim().length < 3) {
      note.textContent = t('fbShort');
      return;
    }
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: fb.type, message: fb.message, contact: fb.contact, lang: getLang(), kiosk: app.config.kioskId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      app.feedback = { type: 'complaint' };
      hideKeyboard();
      $('panelBody').replaceChildren(h('div', { class: 'done' }, h('div', { class: 'done-mark' }, '✓'), h('p', null, t('fbDone'))));
      setTimeout(() => app.panel === 'feedback' && closePanel(), 3500);
    } catch {
      note.textContent = t('errorGeneric');
    }
  });
  $('panelBody').replaceChildren(form);
}

// --- operator ---
function renderOperator() {
  const op = app.config.settings.operator || {};
  $('panelBody').replaceChildren(
    h('div', { class: 'operator' },
      h('div', { class: 'operator-icon' }, uiIcon('phone', 44)),
      op.phone ? h('div', { class: 'operator-phone' }, op.phone) : null,
      h('p', null, pick(op.note))),
  );
}

// --- manzil shaharlar ob-havosi ---
// Kiosk qotib qolmasligi uchun shaharlar ro'yxati bir yo'la, ob-havo esa 6 tadan yuklanadi.
const WEATHER_BATCH = 6;

// Rangli ikonkalar (48x48, statik matn)
const CLOUD = (fill, dx = 0, dy = 0) =>
  `<path transform="translate(${dx} ${dy})" d="M14 36a8 8 0 0 1-.6-16A11 11 0 0 1 34.5 17 8 8 0 0 1 35 36z" fill="${fill}"/>`;
const SUN = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ff7a45"/>`;
const MOON = (dx = 0, dy = 0, k = 1) =>
  `<path transform="translate(${dx} ${dy}) scale(${k})" d="M28 8a16 16 0 1 0 12 26A13 13 0 0 1 28 8z" fill="#ffd56b"/>`;
const WX_ICONS = {
  sun: `${SUN(24, 24, 10)}<path d="M24 5v4M24 39v4M5 24h4M39 24h4M10.6 10.6l2.8 2.8M34.6 34.6l2.8 2.8M10.6 37.4l2.8-2.8M34.6 13.4l2.8-2.8" stroke="#ffb347" stroke-width="2.6" stroke-linecap="round"/>`,
  moon: MOON(),
  partly: `${SUN(18, 16, 8)}${CLOUD('#eef3ff', 3, 4)}`,
  partlyNight: `${MOON(2, -2, 0.62)}${CLOUD('#eef3ff', 3, 4)}`,
  cloud: CLOUD('#eef3ff'),
  overcast: `${CLOUD('#9aa8bf', -5, -4)}${CLOUD('#dde4f0', 3, 3)}`,
  rain: `${CLOUD('#d4dceb', 0, -5)}<path d="M17 37l-2 5M25 37l-2 5M33 37l-2 5" stroke="#38d6ff" stroke-width="2.6" stroke-linecap="round"/>`,
  snow: `${CLOUD('#eef3ff', 0, -5)}<g fill="#bfeeff"><circle cx="16" cy="39" r="2"/><circle cx="24" cy="42" r="2"/><circle cx="32" cy="39" r="2"/></g>`,
  storm: `${CLOUD('#8f9bb3', 0, -5)}<path d="M25 30l-6 9h5l-3 7 8-10h-5l3-6z" fill="#fbbf24"/>`,
  fog: '<path d="M9 17h30M13 24h26M9 31h30M15 38h20" stroke="#cbd5e1" stroke-width="3" stroke-linecap="round"/>',
};
function wxKind(id, day) {
  if (id === null || id === undefined) return 'cloud';
  if (id < 300) return 'storm';
  if (id < 600) return 'rain';
  if (id < 700) return 'snow';
  if (id < 800) return 'fog';
  if (id === 800) return day ? 'sun' : 'moon';
  if (id <= 802) return day ? 'partly' : 'partlyNight';
  return id === 804 ? 'overcast' : 'cloud';
}
const wxIcon = (kind) => s('svg', { class: 'w-icon', viewBox: '0 0 48 48', width: 56, height: 56, 'aria-hidden': 'true', html: WX_ICONS[kind] });

async function loadDestinations() {
  const w = app.weather;
  try {
    const res = await fetch('/api/weather/destinations');
    if (!res.ok) throw new Error(`weather ${res.status}`);
    const data = await res.json();
    if (app.weather !== w) return;
    w.enabled = data.enabled;
    w.cities = data.cities || [];
  } catch (err) {
    if (app.weather !== w) return;
    console.warn(err);
    w.cities = [];
    w.error = true;
  }
  if (app.panel === 'weather') renderWeatherPanel();
  loadMoreWeather();
}

async function loadMoreWeather() {
  const w = app.weather;
  if (!w?.cities || w.loading || w.shown >= w.cities.length) return;
  touch();
  const batch = w.cities.slice(w.shown, w.shown + WEATHER_BATCH);
  const first = w.shown;
  w.shown += batch.length;
  w.loading = true;
  if (app.panel === 'weather') {
    renderWeatherPanel(); // yangi kartalar "yuklanmoqda" holatida darhol chiqadi
    if (first) $(`wcard-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  try {
    const res = await fetch(`/api/weather/cities?codes=${encodeURIComponent(batch.map((c) => c.code).join(','))}`);
    const data = await res.json();
    if (app.weather !== w) return;
    Object.assign(w.data, data.weather || {});
  } catch (err) {
    console.warn(err);
  }
  if (app.weather !== w) return;
  for (const c of batch) if (!(c.code in w.data)) w.data[c.code] = null; // javob kelmadi — "ma'lumot yo'q"
  w.loading = false;
  if (app.panel === 'weather') renderWeatherPanel();
}

function weatherCard(c, i) {
  const w = app.weather;
  const loaded = c.code in w.data;
  const d = w.data[c.code];
  const { rel, pretty } = dayParts(c.next.date);
  const day = c.next.date === dayKey(Date.now()) ? '' : `${rel || pretty} `; // bugungi reysda faqat vaqt
  return h('button', {
    class: `wcard${loaded ? '' : ' loading'}`, id: `wcard-${i}`, type: 'button',
    // shahar bosilsa — globusda yo'nalish va shu shaharga reyslar
    onclick: () => showFlights({ direction: 'departure', query: c.city }, app.turn),
  },
    h('b', { class: 'w-city' }, titleCase(c.city)),
    !loaded
      ? h('div', { class: 'w-skel' }, h('i'), h('i'), h('i'))
      : d && Number.isFinite(d.temp)
        ? [
          h('div', { class: 'w-temp' }, `${d.temp}°C`),
          wxIcon(wxKind(d.id, d.day)),
          h('div', { class: 'w-desc' }, weatherText(d.id, d.description)),
          d.humidity !== null ? h('div', { class: 'w-hum' }, `${t('humidity')}: ${d.humidity}%`) : null,
        ]
        : h('div', { class: 'w-none' }, t('noWeather')),
    h('div', { class: 'w-next' }, uiIcon('plane', 14), h('span', null, `${c.next.flight} · ${day}${c.next.time}`)));
}

function renderWeatherPanel() {
  const w = app.weather;
  if (!w) return;
  let content;
  if (!w.cities) content = h('div', { class: 'empty' }, '…');
  else if (!w.enabled) content = h('div', { class: 'empty' }, t('weatherOff'));
  else if (!w.cities.length) content = h('div', { class: 'empty' }, t(w.error ? 'errorGeneric' : 'noDestinations'));
  else {
    const left = w.cities.length - w.shown;
    content = [
      h('div', { class: 'wgrid' }, w.cities.slice(0, w.shown).map(weatherCard)),
      h('div', { class: 'wfoot' },
        h('span', { class: 'muted' }, t('weatherHint')),
        left > 0
          ? h('button', { class: 'dock-btn', type: 'button', disabled: w.loading, onclick: loadMoreWeather },
            h('span', { class: 'w-plus' }, '+'), h('span', null, t('loadMore', { n: left })))
          : null),
    ];
  }
  $('panelBody').replaceChildren(...[content].flat());
}

// ---------- yuqori panel ----------
function tickClock() {
  $('clock').textContent = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(Date.now());
}

const WEATHER_ICONS = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  moon: '<path d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.500z"/>',
  cloud: '<path d="M7 18a4 4 0 0 1 0-8 5.5 5.5 0 0 1 10.6 1.500A3.3 3.3 0 0 1 17 18H7z"/>',
  rain: '<path d="M7 15a4 4 0 0 1 0-8 5.5 5.5 0 0 1 10.6 1.500A3.3 3.3 0 0 1 17 15H7zM8 18v2M12 18v3M16 18v2"/>',
};
async function loadWeather() {
  try {
    const w = await (await fetch('/api/weather')).json();
    const el = $('weather');
    if (w.temp === null || w.temp === undefined) {
      el.hidden = true;
      return;
    }
    const kind = w.code >= 51 ? 'rain' : w.code >= 2 ? 'cloud' : w.isDay ? 'sun' : 'moon';
    el.hidden = false;
    el.replaceChildren(
      s('svg', { viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', html: WEATHER_ICONS[kind] }),
      h('span', null, `${w.temp}°C`),
      s('svg', { class: 'chev', viewBox: '0 0 24 24', width: 14, height: 14, fill: 'none', stroke: 'currentColor', 'stroke-width': 2.5, 'stroke-linecap': 'round', html: '<path d="M9 6l6 6-6 6"/>' }));
  } catch { /* ob-havo ixtiyoriy */ }
}

// ---------- sozlamalarni yuklash va bo'sh turish ----------
async function loadConfig() {
  const res = await fetch(`/api/config${kioskParam ? `?kiosk=${kioskParam}` : ''}`);
  if (!res.ok) throw new Error(`config ${res.status}`);
  app.config = await res.json();
  mapView.setData(app.config);
}

function resetSession() {
  cancelTurn();
  closePanel();
  app.history = [];
  app.feedback = { type: 'complaint' };
  app.flights = { ...app.flights, type: 'DEPARTURE', airport: '', q: '', window: false };
  app.globe = null;
  app.weather = null;
  mapView.reset();
  $('askInput').value = '';
  applyLang(app.config.settings.default_lang);
}

let idleDone = true; // sessiya toza holatda

// Ekranga 3 daqiqa hech kim tegmasa — sahifa to'liq qayta yuklanadi (ochiq qolgan oynalar, xotira, admin o'zgarishlari).
const RELOAD_AFTER_MS = 3 * 60_000;
const loadedAt = Date.now();
let lastInput = Date.now(); // faqat odamning harakati: bosish, klaviatura, mikrofonga gapirish
let reloading = false;
async function reloadIfIdle(busy) {
  if (reloading || busy) return;
  const now = Date.now();
  if (now - lastInput < RELOAD_AFTER_MS || now - loadedAt < RELOAD_AFTER_MS) return;
  reloading = true;
  try {
    // Server ishlamayotgan bo'lsa qayta yuklamaymiz — aks holda kioskda brauzer xato sahifasi qolib ketadi
    const res = await fetch('/api/config', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      location.reload();
      return;
    }
  } catch { /* keyingi safar */ }
  reloading = false;
  lastInput = Date.now() - RELOAD_AFTER_MS + 30_000; // 30 soniyadan keyin yana urinib ko'ramiz
}

// Bo'sh turganda ekran yozuvlari tili almashinib turadi (uz → ru → en → ...), chunki mehmonlarning hammasi
// o'zbekcha tushunmaydi. Yo'lovchi tegishi yoki gapirishi bilan to'xtaydi; sessiya tozalangach yana boshlanadi.
let langRotateAt = 0;
function cleanScreen() {
  return idleDone && app.mode === 'idle' && !app.panel && !recorder.active && $('kbd').hidden && !$('askInput').value;
}
function rotateLangTick() {
  const sec = Number(app.config.settings.lang_rotate_sec) || 0;
  const now = Date.now();
  // Sanoq ekran toza bo'lgan paytdan boshlanadi (sahifa ochilganda ham — boshlang'ich til to'liq vaqt tursin)
  if (!sec || !cleanScreen() || !langRotateAt) {
    langRotateAt = now + sec * 1000;
    return;
  }
  if (now < langRotateAt) return;
  langRotateAt = now + sec * 1000;
  const codes = LANGS.map((l) => l.code);
  const next = codes[(codes.indexOf(getLang()) + 1) % codes.length];
  // matnlar keskin sakramasin: so'nadi → til almashadi → paydo bo'ladi
  document.body.classList.add('lang-fade');
  setTimeout(() => {
    if (cleanScreen()) applyLang(next);
    document.body.classList.remove('lang-fade');
  }, 350);
}

function idleTick() {
  if (!app.config) return;
  // Pauzadagi javob "band" hisoblanmaydi: yo'lovchi pauzani bosib ketsa, ekran baribir tozalanadi
  const busy = recorder.active || (app.mode !== 'idle' && !speaker.paused);
  reloadIfIdle(busy);
  rotateLangTick();
  if (busy) {
    touch();
    idleDone = false;
    return;
  }
  if (app.mode !== 'idle') idleDone = false;
  const idleFor = Date.now() - app.lastActivity;
  if (!idleDone && idleFor > app.config.settings.idle_timeout_sec * 1000) {
    resetSession();
    idleDone = true;
    // Bo'sh turganda admin kiritgan o'zgarishlarni olib turamiz
    loadConfig().then(() => applyLang(app.config.settings.default_lang)).catch(() => {});
  }
}

async function boot() {
  $('micBtn').replaceChildren(uiIcon('mic', 40));
  $('stopBtn').replaceChildren(uiIcon('stop', 20));
  $('pauseBtn').replaceChildren(uiIcon('pause', 20));
  $('askSend').replaceChildren(uiIcon('send', 22));
  $('panelClose').replaceChildren(uiIcon('close', 24));
  $('panelMic').replaceChildren(uiIcon('mic', 24));
  // Admin panelga ko'rinadigan havola yo'q: klaviaturada maxfiy kod teriladi.
  // ?osk=1 — admin panelda ham ekran klaviaturasi ochilsin (kioskda oddiy klaviatura yo'q).
  initKeyboard($('kbd'), { secrets: { [ADMIN_CODE]: () => { location.href = '/admin/?osk=1'; } } });

  $('micBtn').addEventListener('click', onMic);
  $('stopBtn').addEventListener('click', () => { touch(); cancelTurn(); });
  $('pauseBtn').addEventListener('click', () => {
    touch();
    speaker.togglePause();
    $('pauseBtn').replaceChildren(uiIcon(speaker.paused ? 'play' : 'pause', 20));
  });
  $('askForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('askInput').value.trim();
    if (!text) return;
    $('askInput').value = '';
    hideKeyboard();
    getAudioContext();
    ask({ text });
  });
  for (const btn of document.querySelectorAll('[data-panel]')) {
    btn.addEventListener('click', () => {
      if (app.panel === btn.dataset.panel) return closePanel();
      // pastki tugmadan tablo har doim toza ochiladi (oldingi savolning filtri qolib ketmasin)
      if (btn.dataset.panel === 'flights') app.flights = { ...app.flights, type: 'DEPARTURE', airport: '', q: '', window: false };
      openPanel(btn.dataset.panel);
    });
  }
  $('panelClose').addEventListener('click', closePanel);
  // Toshkent ob-havosi bosilsa — reyslar shaharlari ob-havosi oynasi
  $('weather').addEventListener('click', () => (app.panel === 'weather' ? closePanel() : openPanel('weather')));
  // To'liq ekranli panelda pastki mikrofon ko'rinmaydi — shu tugma panelni yopib, tinglashni boshlaydi
  $('panelMic').addEventListener('click', () => { closePanel(); onMic(); });
  for (const ev of ['pointerdown', 'keydown']) {
    document.addEventListener(ev, () => { touch(); lastInput = Date.now(); idleDone = false; }, { passive: true });
  }

  tickClock();
  setInterval(tickClock, 1000);
  layoutFx();
  window.addEventListener('resize', layoutFx);
  new ResizeObserver(() => {
    layoutFx();
    layoutGlobe();
    if (app.panel === 'map') mapView.layout();
  }).observe(document.querySelector('.middle'));

  // Server hali tayyor bo'lmasa — ulanmaguncha qayta urinamiz
  for (;;) {
    try {
      await loadConfig();
      break;
    } catch {
      $('offline').hidden = false;
      $('offline').textContent = t('offline');
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
  $('offline').hidden = true;
  applyLang(app.config.settings.default_lang);
  setMode('idle');
  loadWeather();
  setInterval(loadWeather, 10 * 60_000);
  setInterval(idleTick, 1000);
  // Globus birinchi ochilganda kutib qolmaslik uchun fayllarini oldindan yuklab qo'yamiz
  setTimeout(() => globeView.preload(), 2500);
  setTimeout(() => thinkGlobe.preload(), 1500);
}

boot();
