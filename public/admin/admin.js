// ACCESS admin panel: bilimlar bazasi, xarita muharriri, murojaatlar, suhbatlar jurnali, sozlamalar.
import { CATEGORIES, category, h, s, markerNode } from '/js/categories.js';
import { createRouter } from '/js/pathfinder.js';
import { initKeyboard } from '/js/keyboard.js';

const $ = (id) => document.getElementById(id);
const content = $('content');
const TZ = 'Asia/Tashkent';

// Kioskdan (maxfiy kod orqali, /admin/?osk=1) kirilganda oddiy klaviatura yo'q — ekran klaviaturasi yoqiladi.
// Oddiy kompyuterdan kirilganda u ochilmaydi.
let onKiosk = new URLSearchParams(location.search).get('osk') === '1';
try {
  if (onKiosk) sessionStorage.setItem('osk', '1');
  onKiosk = sessionStorage.getItem('osk') === '1';
} catch { /* sessionStorage o'chirilgan bo'lishi mumkin */ }
if (onKiosk) {
  document.body.classList.add('osk');
  initKeyboard($('kbd'));
  $('kioskLink').removeAttribute('target'); // kiosk rejimida yangi oyna ochilmasin
  $('kioskLink').textContent = '← Kioskka qaytish';
}

// ---------- umumiy yordamchilar ----------
let toastTimer = 0;
function toast(message, bad = false) {
  const el = $('toast');
  el.textContent = message;
  el.className = `toast${bad ? ' bad' : ''}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, bad ? 5000 : 2200);
}

async function api(path, { method = 'GET', body, raw } = {}) {
  const res = await fetch(`/api/admin${path}`, {
    method,
    headers: raw ? { 'Content-Type': raw.type } : body ? { 'Content-Type': 'application/json' } : undefined,
    body: raw ? raw.data : body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    showLogin();
    throw new Error('Sessiya tugadi, qayta kiring');
  }
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || `Xato ${res.status}`);
  }
  return (res.headers.get('content-type') || '').includes('json') ? res.json() : res;
}

/** Xatoni ekranga chiqaradigan o'ram. */
const run = (fn) => async (...args) => {
  try {
    await fn(...args);
  } catch (err) {
    toast(err.message, true);
  }
};

const fmtDate = (sqlUtc) =>
  new Date(`${String(sqlUtc).replace(' ', 'T')}Z`).toLocaleString('ru-RU', {
    timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
const fmtTime = (ms) => (ms ? new Date(ms).toLocaleTimeString('ru-RU', { timeZone: TZ }) : '—');

const field = (label, input, hint) => h('label', null, label, input, hint ? h('span', { class: 'hint' }, hint) : null);
const LANG3 = [['uz', 'Oʻzbekcha'], ['ru', 'Ruscha'], ['en', 'Inglizcha']];

// ---------- kirish ----------
function showLogin() {
  $('shell').hidden = true;
  $('login').hidden = false;
  $('password').focus();
}
$('login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await fetch('/api/admin/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('password').value }),
  });
  if (!res.ok) {
    $('loginError').textContent = (await res.json().catch(() => ({}))).error || 'Xato';
    return;
  }
  $('password').value = '';
  $('loginError').textContent = '';
  startApp();
});
$('logout').addEventListener('click', async () => {
  await fetch('/api/admin/logout', { method: 'POST' });
  showLogin();
});

// Brauzer oynasini to'liq ekranga yoyish (kiosk rejimida brauzer allaqachon to'liq ekranda bo'ladi)
if (document.fullscreenEnabled) {
  const syncFs = () => { $('fullscreen').textContent = document.fullscreenElement ? '⛶ Oynaga qaytish' : '⛶ Toʻliq ekran'; };
  $('fullscreen').addEventListener('click', () => {
    (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {});
  });
  document.addEventListener('fullscreenchange', syncFs);
} else {
  $('fullscreen').hidden = true;
}

const VIEWS = [
  ['overview', 'Umumiy holat', viewOverview],
  ['kb', 'Bilimlar bazasi', viewKb],
  ['map', 'Xarita va hududlar', viewMap],
  ['feedback', 'Murojaatlar', viewFeedback],
  ['logs', 'Suhbatlar', viewLogs],
  ['settings', 'Sozlamalar', viewSettings],
];
let currentView = 'overview';

function startApp() {
  $('login').hidden = true;
  $('shell').hidden = false;
  $('nav').replaceChildren(...VIEWS.map(([key, label]) =>
    h('button', { 'data-view': key, onclick: () => openView(key) }, label)));
  openView(location.hash.slice(1) || currentView);
}

function openView(key) {
  const view = VIEWS.find((v) => v[0] === key) || VIEWS[0];
  currentView = view[0];
  location.hash = currentView;
  for (const b of $('nav').children) b.classList.toggle('active', b.dataset.view === currentView);
  content.classList.toggle('flush', currentView === 'map'); // xarita muharriri butun maydonni egallaydi
  content.replaceChildren(h('p', { class: 'muted', style: 'padding:22px 28px' }, 'Yuklanmoqda…'));
  run(view[2])();
}

// ---------- umumiy holat ----------
async function viewOverview() {
  const o = await api('/overview');
  const stat = (value, label, cls = '') => h('div', { class: 'card stat' }, h('b', { class: cls }, value), h('span', null, label));
  const result = h('pre', { hidden: true });
  const question = h('input', { type: 'text', placeholder: 'Masalan: Hojatxona qayerda?' });
  const ask = run(async () => {
    if (!question.value.trim()) return;
    result.hidden = false;
    result.textContent = 'Kutilmoqda…';
    try {
      result.textContent = JSON.stringify(await api('/test-ai', { method: 'POST', body: { text: question.value } }), null, 2);
    } catch (err) {
      result.textContent = `Xato: ${err.message}`;
    }
  });

  content.replaceChildren(
    h('h1', null, 'Umumiy holat'),
    h('div', { class: 'grid stats' },
      stat(o.aiReady ? 'Ulangan' : 'Kalit yoʻq', 'Google AI (GEMINI_API_KEY)', o.aiReady ? 'ok' : 'bad'),
      stat(o.chatsToday, 'Savollar (24 soat)'),
      stat(o.errorsToday, 'Xatolar (24 soat)', o.errorsToday ? 'warn' : ''),
      stat(o.feedbackNew, 'Yangi murojaatlar', o.feedbackNew ? 'warn' : ''),
      stat(o.kbCount, 'Bilim yozuvlari'),
      stat(o.placeCount, 'Borish hududlari'),
      stat(o.kioskCount, 'Kiosklar', o.kioskCount ? '' : 'warn')),
    h('div', { class: 'grid cols-2' },
      h('div', { class: 'card stack' },
        h('div', { class: 'row between' }, h('h2', null, 'Reyslar tablosi (FIDS)'),
          h('button', { class: 'btn', onclick: run(async () => { await api('/fids/refresh', { method: 'POST' }); openView('overview'); }) }, 'Yangilash')),
        h('table', null,
          h('tr', null, h('th', null, 'Tablo'), h('th', null, 'Reyslar'), h('th', null, 'Yangilangan'), h('th', null, 'Holat')),
          o.fids.map((b) => h('tr', null, h('td', null, b.board), h('td', null, b.count), h('td', null, fmtTime(b.fetchedAt)),
            h('td', { class: b.error ? 'bad' : 'ok' }, b.error || 'OK')))),
        h('span', { class: 'hint' }, 'Manba: bot.uzairports.com/fids — har 60 soniyada avtomatik yangilanadi.')),
      h('div', { class: 'card stack' },
        h('h2', null, 'AI ni sinab koʻrish'),
        h('form', { class: 'row', onsubmit: (e) => { e.preventDefault(); ask(); } },
          h('div', { style: 'flex:1' }, question), h('button', { class: 'btn primary', type: 'submit' }, 'Soʻrash')),
        result)),
  );
}

// ---------- bilimlar bazasi ----------
async function viewKb() {
  const items = await api('/kb');
  const edit = (item) => {
    const title = h('input', { type: 'text', value: item?.title || '', maxLength: 200 });
    const cat = h('input', { type: 'text', value: item?.category || '', maxLength: 60, placeholder: 'masalan: xizmatlar, transport, qoidalar' });
    const text = h('textarea', { rows: 12, value: item?.content || '' });
    const active = h('input', { type: 'checkbox', checked: item ? item.active === 1 : true });
    const save = run(async () => {
      const body = { title: title.value, category: cat.value, content: text.value, active: active.checked };
      await api(item ? `/kb/${item.id}` : '/kb', { method: item ? 'PUT' : 'POST', body });
      toast('Saqlandi');
      openView('kb');
    });
    content.replaceChildren(
      h('h1', null, item ? 'Yozuvni tahrirlash' : 'Yangi yozuv'),
      h('div', { class: 'card stack' },
        h('div', { class: 'grid cols-2' }, field('Sarlavha', title), field('Boʻlim', cat)),
        field('Matn', text, 'AI javob berishda shu matndan foydalanadi. Istalgan tilda yozish mumkin — AI yoʻlovchi tiliga oʻzi tarjima qiladi.'),
        h('label', { class: 'check' }, active, 'Faol (AI foydalanadi)'),
        h('div', { class: 'row' },
          h('button', { class: 'btn primary', onclick: save }, 'Saqlash'),
          h('button', { class: 'btn', onclick: () => openView('kb') }, 'Bekor qilish'),
          item ? h('button', {
            class: 'btn danger',
            onclick: run(async () => {
              if (!confirm('Yozuv oʻchirilsinmi?')) return;
              await api(`/kb/${item.id}`, { method: 'DELETE' });
              openView('kb');
            }),
          }, 'Oʻchirish') : null)),
    );
  };

  content.replaceChildren(
    h('div', { class: 'row between' }, h('h1', null, 'Bilimlar bazasi'),
      h('button', { class: 'btn primary', onclick: () => edit(null) }, '＋ Yangi yozuv')),
    h('p', { class: 'muted' }, 'Aeroport haqidagi maʼlumotlar: xizmatlar, ish vaqtlari, qoidalar, transport va h.k. AI faqat shu yerdagi maʼlumot, xarita nuqtalari va reyslar tablosi asosida javob beradi.'),
    h('div', { class: 'card' },
      h('table', null,
        h('tr', null, h('th', null, 'Sarlavha'), h('th', null, 'Boʻlim'), h('th', null, 'Matn'), h('th', null, 'Holat'), h('th', null, 'Yangilangan')),
        items.map((k) => h('tr', { class: 'clickable', onclick: () => edit(k) },
          h('td', null, h('b', null, k.title)), h('td', null, k.category),
          h('td', { class: 'wrap muted' }, k.content.length > 160 ? `${k.content.slice(0, 160)}…` : k.content),
          h('td', { class: k.active ? 'ok' : 'muted' }, k.active ? 'Faol' : 'Oʻchirilgan'), h('td', null, fmtDate(k.updated_at)))),
        items.length ? null : h('tr', null, h('td', { colSpan: 5, class: 'muted' }, 'Hozircha yozuv yoʻq')))),
  );
}

// ---------- murojaatlar ----------
async function viewFeedback() {
  const items = await api('/feedback');
  const TYPES = { complaint: 'Shikoyat', suggestion: 'Taklif', thanks: 'Minnatdorchilik' };
  const STATUS = { new: 'Yangi', seen: 'Koʻrildi', done: 'Hal qilindi' };
  content.replaceChildren(
    h('h1', null, 'Murojaatlar'),
    h('div', { class: 'card' },
      h('table', null,
        h('tr', null, ['Vaqt', 'Turi', 'Matn', 'Aloqa', 'Til', 'Holat', ''].map((x) => h('th', null, x))),
        items.map((f) => {
          const sel = h('select', {
            onchange: run(async () => {
              await api(`/feedback/${f.id}`, { method: 'PUT', body: { status: sel.value } });
              toast('Saqlandi');
            }),
          }, Object.entries(STATUS).map(([k, v]) => h('option', { value: k, selected: f.status === k }, v)));
          return h('tr', null,
            h('td', null, fmtDate(f.created_at)),
            h('td', { class: f.type === 'complaint' ? 'bad' : f.type === 'thanks' ? 'ok' : '' }, TYPES[f.type] || f.type),
            h('td', { class: 'wrap' }, f.message), h('td', null, f.contact), h('td', null, f.lang), h('td', null, sel),
            h('td', null, h('button', {
              class: 'btn danger',
              onclick: run(async () => {
                if (!confirm('Murojaat oʻchirilsinmi?')) return;
                await api(`/feedback/${f.id}`, { method: 'DELETE' });
                openView('feedback');
              }),
            }, '✕')));
        }),
        items.length ? null : h('tr', null, h('td', { colSpan: 7, class: 'muted' }, 'Murojaatlar yoʻq')))),
  );
}

// ---------- suhbatlar ----------
async function viewLogs() {
  const items = await api('/logs?limit=300');
  content.replaceChildren(
    h('div', { class: 'row between' }, h('h1', null, 'Suhbatlar jurnali'),
      h('button', {
        class: 'btn danger',
        onclick: run(async () => {
          if (!confirm('Butun jurnal tozalansinmi?')) return;
          await api('/logs', { method: 'DELETE' });
          openView('logs');
        }),
      }, 'Jurnalni tozalash')),
    h('p', { class: 'muted' }, 'Yoʻlovchilar nima soʻrayotganini koʻrib, yetishmayotgan maʼlumotni bilimlar bazasiga qoʻshing. Ovoz yozuvlari saqlanmaydi.'),
    h('div', { class: 'card' },
      h('table', null,
        h('tr', null, ['Vaqt', 'Kirish', 'Til', 'Savol', 'Javob', 'Amal', 'ms'].map((x) => h('th', null, x))),
        items.map((l) => {
          let action = '';
          try { action = JSON.parse(l.action || '{}').type || ''; } catch { /* bo'sh */ }
          return h('tr', null,
            h('td', null, fmtDate(l.created_at)), h('td', null, l.input_type === 'voice' ? 'Ovoz' : 'Matn'), h('td', null, l.lang),
            h('td', { class: 'wrap' }, l.question),
            h('td', { class: `wrap${l.error ? ' bad' : ''}` }, l.error || l.answer),
            h('td', null, action === 'none' ? '' : action), h('td', null, l.ms));
        }),
        items.length ? null : h('tr', null, h('td', { colSpan: 7, class: 'muted' }, 'Hozircha suhbat yoʻq')))),
  );
}

// ---------- sozlamalar ----------
async function viewSettings() {
  const st = await api('/settings');
  const text = (value, attrs = {}) => h('input', { type: 'text', value: value ?? '', ...attrs });
  const area = (value, rows = 3) => h('textarea', { rows, value: value ?? '' });
  const triple = (obj, make) => Object.fromEntries(LANG3.map(([code]) => [code, make(obj?.[code])]));

  const models = h('datalist', { id: 'models' });
  const voices = h('datalist', { id: 'voices' },
    ['Kore', 'Aoede', 'Leda', 'Zephyr', 'Puck', 'Charon', 'Fenrir', 'Orus', 'Sulafat', 'Achird'].map((v) => h('option', { value: v })));
  const f = {
    chat_model: text(st.chat_model, { list: 'models' }),
    tts_provider: h('select', null,
      [['gemini', 'Gemini TTS (Google API, tavsiya etiladi)'], ['browser', 'Brauzer ovozi (bepul, sifati pastroq)'], ['off', 'Ovozsiz (faqat matn)']]
        .map(([v, l]) => h('option', { value: v, selected: st.tts_provider === v }, l))),
    tts_model: text(st.tts_model, { list: 'models' }),
    tts_voice: text(st.tts_voice, { list: 'voices' }),
    tts_style: text(st.tts_style),
    default_lang: h('select', null, LANG3.map(([v, l]) => h('option', { value: v, selected: st.default_lang === v }, l))),
    idle_timeout_sec: h('input', { type: 'number', min: 20, max: 600, value: st.idle_timeout_sec }),
    welcome: triple(st.welcome, (v) => text(v)),
    status_text: triple(st.status_text, (v) => text(v)),
    op_phone: text(st.operator?.phone, { placeholder: '+998 …' }),
    op_note: triple(st.operator?.note, (v) => area(v, 2)),
    extra_instructions: area(st.extra_instructions, 5),
    weather: h('input', { type: 'checkbox', checked: st.weather?.enabled !== false }),
  };
  const tripleRow = (title, inputs, hint) =>
    h('div', { class: 'stack' }, h('h2', null, title), hint ? h('span', { class: 'hint' }, hint) : null,
      h('div', { class: 'grid cols-3' }, LANG3.map(([code, label]) => field(label, inputs[code]))));

  const save = run(async () => {
    const vals = (inputs) => Object.fromEntries(LANG3.map(([code]) => [code, inputs[code].value.trim()]));
    await api('/settings', {
      method: 'PUT',
      body: {
        chat_model: f.chat_model.value.trim(),
        tts_provider: f.tts_provider.value,
        tts_model: f.tts_model.value.trim(),
        tts_voice: f.tts_voice.value.trim(),
        tts_style: f.tts_style.value.trim(),
        default_lang: f.default_lang.value,
        idle_timeout_sec: Math.min(600, Math.max(20, Number(f.idle_timeout_sec.value) || 75)),
        welcome: vals(f.welcome),
        status_text: vals(f.status_text),
        operator: { phone: f.op_phone.value.trim(), note: vals(f.op_note) },
        extra_instructions: f.extra_instructions.value.trim(),
        weather: { ...st.weather, enabled: f.weather.checked },
      },
    });
    toast('Sozlamalar saqlandi');
  });

  const ttsText = text('Assalomu alaykum! Toshkent xalqaro aeroportiga xush kelibsiz.');
  const testTts = run(async () => {
    toast('Ovoz tayyorlanmoqda…');
    const res = await api('/test-tts', { method: 'POST', body: { text: ttsText.value } });
    const audio = new Audio(URL.createObjectURL(await res.blob()));
    await audio.play();
  });
  const loadModels = run(async () => {
    const list = await api('/models');
    models.replaceChildren(...list.map((m) => h('option', { value: m })));
    toast(`${list.length} ta model topildi — maydonni bosib tanlang`);
  });

  content.replaceChildren(
    h('div', { class: 'row between' }, h('h1', null, 'Sozlamalar'), h('button', { class: 'btn primary', onclick: save }, 'Saqlash')),
    h('div', { class: 'stack' },
      h('div', { class: 'card stack' },
        h('div', { class: 'row between' }, h('h2', null, 'Sunʼiy intellekt va ovoz'),
          h('button', { class: 'btn', onclick: loadModels }, 'Google modellar roʻyxatini olish')),
        models, voices,
        h('div', { class: 'grid cols-2' },
          field('Savol-javob modeli', f.chat_model), field('Ovoz chiqarish usuli', f.tts_provider),
          field('TTS modeli', f.tts_model), field('Ovoz (voice)', f.tts_voice)),
        field('Ovoz uslubi', f.tts_style, 'Inglizcha tavsif, masalan: warm, clear and friendly airport assistant'),
        h('div', { class: 'row' }, h('div', { style: 'flex:1' }, ttsText), h('button', { class: 'btn', onclick: testTts }, '▶ Ovozni sinash')),
        h('span', { class: 'hint' }, 'API kaliti xavfsizlik uchun faqat serverdagi .env faylida saqlanadi (GEMINI_API_KEY). Sinashdan oldin sozlamalarni saqlang.')),
      h('div', { class: 'card stack' },
        h('h2', null, 'Kiosk'),
        h('div', { class: 'grid cols-3' },
          field('Ekran yozuvlarining boshlangʻich tili', f.default_lang,
            'Yoʻlovchi istalgan tilda soʻrashi mumkin — AI oʻsha tilda javob beradi. Bu faqat tugma va yozuvlar tili.'),
          field('Boʻsh turish vaqti (soniya)', f.idle_timeout_sec, 'Shuncha vaqt hech kim tegmasa, kiosk boshlangʻich holatga qaytadi'),
          h('label', { class: 'check' }, f.weather, 'Ob-havoni koʻrsatish')),
        tripleRow('Salomlashuv matni', f.welcome),
        tripleRow('Holat yozuvi (yuqorida)', f.status_text, 'Boʻsh qoldirilsa koʻrsatilmaydi')),
      h('div', { class: 'card stack' },
        h('h2', null, 'Operator'),
        field('Telefon raqami', f.op_phone),
        tripleRow('Izoh', f.op_note)),
      h('div', { class: 'card stack' },
        h('h2', null, 'AI uchun qoʻshimcha koʻrsatmalar'),
        field('Koʻrsatmalar', f.extra_instructions, 'Masalan: “Har doim yoʻlovchiga yaxshi parvoz tilab yakunla”. AI faqat aeroport va reyslar haqida javob berishi oʻzgarmaydi.')),
      h('div', { class: 'row' }, h('button', { class: 'btn primary', onclick: save }, 'Saqlash'))),
  );
}

// ---------- xarita muharriri ----------
const ed = {
  floors: [], places: [], floorId: null,
  mode: 'select', // select | place | kiosk | poly | wall | measure | test
  draft: [], sel: null, newPlace: null, view: null, wallWidth: 0,
  drag: null, test: null, measure: [], q: '',
};
const MODES = [
  ['select', 'Tanlash / surish', 'Hudud yoki toʻsiqni bosib tanlang. Hududni va toʻsiq burchaklarini sudrab surish mumkin. Boʻsh joyni sudrab xaritani suring, gʻildirak yoki ＋/－ bilan kattalashtiring.'],
  ['place', '＋ Hudud', 'Xaritada hudud joyini bosing va oʻng tomonda nomini kiriting. Belgini xonaning eshigi oldiga qoʻying — yoʻl aynan shu yergacha chiziladi.'],
  ['kiosk', '＋ Kiosk joyi', 'Kiosk turgan joyni bosing. Marshrutlar shu nuqtadan boshlanadi.'],
  ['poly', '▱ Xona / toʻsiq', 'Yoʻlovchi oʻta olmaydigan hududning burchaklarini ketma-ket bosing. Tugatish: ikki marta bosish, Enter yoki «Tugatish» tugmasi. Bekor qilish: Esc.'],
  ['wall', '／ Devor', 'Devor chizigʻi nuqtalarini ketma-ket bosing. Tugatish: ikki marta bosish, Enter yoki «Tugatish» tugmasi. Eshik oʻrnini ochiq qoldiring.'],
  ['measure', '↔ Masshtab', 'Haqiqiy uzunligi maʼlum boʻlgan ikki nuqtani bosing va masofani metrda kiriting — piyoda yurish vaqti shundan hisoblanadi.'],
  ['test', '▶ Yoʻlni sinash', 'Hududni bosing — kioskdan shu hududgacha yoʻl chiziladi (toʻsiqlarni aylanib oʻtishi kerak).'],
];
const floorOf = () => ed.floors.find((f) => f.id === ed.floorId) || null;
const fullView = (f) => ({ x: 0, y: 0, w: f.width, h: f.height });

async function loadMapData() {
  [ed.floors, ed.places] = await Promise.all([api('/floors'), api('/places')]);
  if (!floorOf()) {
    ed.floorId = ed.floors[0]?.id ?? null;
    ed.view = null;
  }
}

async function viewMap() {
  await loadMapData();
  ed.sel = null;
  ed.newPlace = null;
  ed.draft = [];
  ed.test = null;
  renderMap();
}

function renderMap() {
  const f = floorOf();
  const toolbar = h('div', { class: 'toolbar' },
    MODES.map(([key, label]) => h('button', { class: `btn${ed.mode === key ? ' active' : ''}`, onclick: () => setMode(key) }, label)),
    h('span', { class: 'sep' }),
    h('label', { class: 'check', title: 'Devor qalinligi (rasm piksellarida)' }, 'Devor:',
      h('input', {
        type: 'number', min: 1, value: Math.round(ed.wallWidth || (f ? Math.max(f.width, f.height) / 150 : 8)),
        onchange: (e) => { ed.wallWidth = Math.max(1, Number(e.target.value) || 8); },
      })),
    ['poly', 'wall'].includes(ed.mode) ? h('button', { class: 'btn primary', onclick: finishDraft }, '✓ Tugatish') : null,
    h('span', { class: 'sep' }),
    h('button', { class: 'btn', title: 'Kattalashtirish', onclick: () => zoomEditor(1 / 1.4) }, '＋'),
    h('button', { class: 'btn', title: 'Kichraytirish', onclick: () => zoomEditor(1.4) }, '－'),
    h('button', { class: 'btn', onclick: () => { ed.view = null; drawSvg(); } }, '⤢ Toʻliq'),
    h('span', { class: 'status', id: 'mapStatus' }));

  const search = h('input', {
    type: 'search', placeholder: 'Hudud qidirish…', value: ed.q,
    oninput: (e) => { ed.q = e.target.value; drawZones(); },
  });
  content.replaceChildren(
    h('div', { class: 'map-editor' },
      h('aside', { class: 'zones' },
        h('h2', null, 'Borish hududlari'),
        h('span', { class: 'hint' }, 'Yoʻlovchi xaritada tanlaydigan va AI yoʻl koʻrsatadigan joylar: peshtaxtalar, darvozalar, zallar, hojatxonalar va h.k.'),
        h('button', { class: `btn primary${ed.mode === 'place' ? ' active' : ''}`, onclick: () => setMode('place') }, '＋ Yangi hudud'),
        search,
        h('div', { class: 'zone-list', id: 'zoneList' })),
      h('div', { class: 'map-main' }, toolbar, h('div', { class: 'hint', id: 'modeHint' }), h('div', { class: 'canvas', id: 'canvas' })),
      h('aside', { class: 'map-props stack', id: 'props' })),
  );
  drawSvg();
  drawProps();
}

/** Chap ustun: barcha qavatlardagi hududlar, turi bo'yicha guruhlangan. */
function drawZones() {
  const box = $('zoneList');
  if (!box) return;
  const q = ed.q.trim().toLowerCase();
  const order = Object.keys(CATEGORIES);
  const items = ed.places
    .filter((p) => !q || [p.name_uz, p.name_ru, p.name_en, p.description, category(p.category).uz].some((v) => v && v.toLowerCase().includes(q)))
    .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.name_uz.localeCompare(b.name_uz, 'uz', { numeric: true }));
  const nodes = [];
  let cat = null;
  for (const p of items) {
    if (p.category !== cat) {
      cat = p.category;
      nodes.push(h('div', { class: 'zone-group' },
        h('i', { style: `background:${category(cat).color}` }), category(cat).uz,
        h('span', null, items.filter((x) => x.category === cat).length)));
    }
    const floor = ed.floors.length > 1 ? ed.floors.find((f) => f.id === p.floor_id)?.name : '';
    nodes.push(h('button', {
      class: `zone${ed.sel?.kind === 'place' && ed.sel.id === p.id ? ' active' : ''}${p.active === 0 ? ' off' : ''}`,
      onclick: () => focusPlace(p),
    }, h('b', null, p.name_uz), h('small', null, p.active === 0 ? 'oʻchirilgan' : floor)));
  }
  if (!nodes.length) {
    nodes.push(h('span', { class: 'hint' }, q ? 'Hech narsa topilmadi.' : 'Hali hudud yoʻq. «＋ Yangi hudud»ni bosib, xaritada joyini belgilang.'));
  }
  box.replaceChildren(...nodes);
  box.querySelector('.zone.active')?.scrollIntoView({ block: 'nearest' });
}

/** Ro'yxatdan tanlangan hududni xaritada ko'rsatadi va tahrirlash uchun ochadi. */
function focusPlace(p) {
  ed.mode = 'select';
  ed.draft = [];
  ed.measure = [];
  ed.newPlace = null;
  ed.test = null;
  if (ed.floorId !== p.floor_id) {
    ed.floorId = p.floor_id;
    ed.view = null;
  }
  ed.sel = { kind: 'place', id: p.id };
  const f = floorOf();
  // Xarita kattalashtirilgan bo'lsa — hudud ko'rinishning o'rtasiga suriladi
  if (ed.view && f && ed.view.w < f.width * 0.95) {
    ed.view.x = p.x - ed.view.w / 2;
    ed.view.y = p.y - ed.view.h / 2;
  }
  renderMap();
}

/** Xaritani ko'rinish markaziga nisbatan kattalashtiradi/kichraytiradi (sensorli ekran uchun tugmalar). */
function zoomEditor(k) {
  const f = floorOf();
  if (!f || !ed.view || !stage) return;
  const v = ed.view;
  const w = Math.min(f.width * 1.5, Math.max(f.width / 25, v.w * k));
  const scale = w / v.w;
  ed.view = { x: v.x + (v.w - w) / 2, y: v.y + (v.h - v.h * scale) / 2, w, h: v.h * scale };
  applyView();
}

function setMode(mode) {
  ed.mode = mode;
  ed.draft = [];
  ed.measure = [];
  ed.newPlace = null;
  if (mode !== 'select') ed.sel = null;
  if (mode !== 'test') ed.test = null;
  renderMap();
}

const setStatus = (text) => { const el = $('mapStatus'); if (el) el.textContent = text; };

async function saveObstacles() {
  const f = floorOf();
  setStatus('Saqlanmoqda…');
  await api(`/floors/${f.id}`, { method: 'PUT', body: { obstacles: f.obstacles } });
  setStatus(`Saqlandi ${new Date().toLocaleTimeString('ru-RU')}`);
}

function finishDraft() {
  const f = floorOf();
  if (!f || !['poly', 'wall'].includes(ed.mode)) return;
  const unit = Math.max(f.width, f.height) / 100;
  // Ikki marta bosishdan qolgan takroriy nuqtalarni olib tashlaymiz
  const pts = ed.draft.filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > unit * 0.3);
  ed.draft = [];
  const min = ed.mode === 'poly' ? 3 : 2;
  if (pts.length < min) {
    toast(ed.mode === 'poly' ? 'Kamida 3 ta burchak kerak' : 'Kamida 2 ta nuqta kerak', true);
    drawSvg();
    return;
  }
  f.obstacles.push(ed.mode === 'poly' ? { type: 'poly', points: pts } : { type: 'wall', points: pts, width: ed.wallWidth || Math.round(unit * 0.67) });
  drawSvg();
  run(saveObstacles)();
}

// SVG bir marta yaratiladi (hodisalar shu elementga bog'lanadi), har o'zgarishda faqat `layer` qayta chiziladi.
// Aks holda bosish paytida element almashib, ikki marta bosish (dblclick) yo'qolib qoladi.
let stage = null;

function toMap(e) {
  const pt = stage.svg.createSVGPoint();
  pt.x = e.clientX;
  pt.y = e.clientY;
  const m = pt.matrixTransform(stage.svg.getScreenCTM().inverse());
  return [Math.round(m.x * 10) / 10, Math.round(m.y * 10) / 10];
}
const applyView = () => stage.svg.setAttribute('viewBox', `${ed.view.x} ${ed.view.y} ${ed.view.w} ${ed.view.h}`);

function buildStage(box, f) {
  const svg = s('svg', { preserveAspectRatio: 'xMidYMid meet' });
  const layer = s('g');
  svg.append(s('image', { href: `/uploads/${f.image}`, width: f.width, height: f.height }), layer);
  stage = { svg, layer, key: `${f.id}:${f.image}` };

  svg.addEventListener('pointerdown', (e) => {
    const p = toMap(e);
    if (e.button !== 0 || ed.mode === 'select' || ed.mode === 'test') {
      ed.drag = { kind: 'pan', start: p };
      svg.setPointerCapture(e.pointerId);
      return;
    }
    if (ed.mode === 'poly' || ed.mode === 'wall') {
      ed.draft.push(p);
      drawSvg();
    } else if (ed.mode === 'place' || ed.mode === 'kiosk') {
      ed.newPlace = {
        floor_id: ed.floorId, x: p[0], y: p[1], category: ed.mode === 'kiosk' ? 'kiosk' : 'other',
        name_uz: ed.mode === 'kiosk' ? `Kiosk ${ed.places.filter((x) => x.category === 'kiosk').length + 1}` : '',
        name_ru: '', name_en: '', description: '', link_code: '', active: 1,
      };
      ed.sel = null;
      drawSvg();
      drawProps();
    } else if (ed.mode === 'measure') {
      ed.measure.push(p);
      drawSvg();
      if (ed.measure.length === 2) setTimeout(run(finishMeasure), 50);
    }
  });
  svg.addEventListener('pointermove', (e) => {
    const d = ed.drag;
    if (!d) return;
    const p = toMap(e);
    if (d.kind === 'pan') {
      ed.view.x -= p[0] - d.start[0];
      ed.view.y -= p[1] - d.start[1];
      applyView();
    } else if (d.kind === 'place') {
      d.moved = true;
      d.place.x = p[0];
      d.place.y = p[1];
      d.node.setAttribute('transform', `translate(${p[0]} ${p[1]})`);
    } else if (d.kind === 'vertex') {
      d.moved = true;
      d.obstacle.points[d.pi] = p;
      d.node.setAttribute('cx', p[0]);
      d.node.setAttribute('cy', p[1]);
    }
  });
  svg.addEventListener('pointerup', run(async () => {
    const d = ed.drag;
    ed.drag = null;
    if (d?.kind === 'place' && !d.moved) drawSvg(); // tanlanganini ko'rsatish
    if (!d || !d.moved) return;
    if (d.kind === 'place') {
      await api(`/places/${d.place.id}`, { method: 'PUT', body: { ...d.place, active: d.place.active !== 0 } });
      setStatus('Hudud joyi oʻzgartirildi');
      drawProps();
    } else if (d.kind === 'vertex') {
      drawSvg();
      await saveObstacles();
    }
  }));
  svg.addEventListener('dblclick', finishDraft);
  svg.addEventListener('contextmenu', (e) => e.preventDefault());
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const fl = floorOf();
    const p = toMap(e);
    const k = e.deltaY > 0 ? 1.18 : 1 / 1.18;
    const w = Math.min(fl.width * 1.5, Math.max(fl.width / 25, ed.view.w * k));
    const scale = w / ed.view.w;
    ed.view = { x: p[0] - (p[0] - ed.view.x) * scale, y: p[1] - (p[1] - ed.view.y) * scale, w, h: ed.view.h * scale };
    applyView();
  }, { passive: false });

  box.replaceChildren(svg);
}

function drawSvg() {
  const box = $('canvas');
  if (!box) return;
  const f = floorOf();
  $('modeHint').textContent = MODES.find((m) => m[0] === ed.mode)[2];
  if (!f || !f.image) {
    stage = null;
    box.replaceChildren(h('div', { class: 'placeholder' },
      f ? 'Bu qavat uchun xarita rasmi yuklanmagan. Oʻng tomondagi “Rasm yuklash” tugmasidan foydalaning.' : 'Avval qavat qoʻshing (oʻng tomonda).'));
    return;
  }
  if (!ed.view) ed.view = fullView(f);
  if (!stage || stage.key !== `${f.id}:${f.image}` || !stage.svg.isConnected) buildStage(box, f);
  const { svg, layer } = stage;
  const interactive = ed.mode === 'select' || ed.mode === 'test';
  svg.setAttribute('class', `mode-${ed.mode}`);
  // Chizish rejimlarida bosish har doim doimiy fon rasmiga tushsin
  layer.setAttribute('pointer-events', interactive ? 'auto' : 'none');
  applyView();

  const unit = Math.max(f.width, f.height) / 100;
  const pointsAttr = (pts) => pts.map((p) => p.join(',')).join(' ');
  const nodes = [];

  // To'siqlar
  f.obstacles.forEach((o, i) => {
    const selected = ed.sel?.kind === 'obs' && ed.sel.index === i;
    const node = o.type === 'wall'
      ? s('polyline', { points: pointsAttr(o.points), class: `obstacle wall${selected ? ' selected' : ''}`, 'stroke-width': o.width })
      : s('polygon', { points: pointsAttr(o.points), class: `obstacle poly${selected ? ' selected' : ''}`, 'stroke-width': unit * 0.2 });
    node.addEventListener('pointerdown', (e) => {
      if (ed.mode !== 'select' || e.button !== 0) return;
      e.stopPropagation();
      ed.sel = { kind: 'obs', index: i };
      drawSvg();
      drawProps();
    });
    nodes.push(node);
    if (selected) {
      o.points.forEach((p, pi) => {
        const handle = s('circle', { cx: p[0], cy: p[1], r: unit * 0.7, class: 'handle', 'stroke-width': unit * 0.2 });
        handle.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          ed.drag = { kind: 'vertex', obstacle: o, pi, node: handle, moved: false };
          svg.setPointerCapture(e.pointerId);
        });
        nodes.push(handle);
      });
    }
  });

  // Chizilayotgan shakl
  if (ed.draft.length) {
    const wall = ed.mode === 'wall';
    nodes.push(s(wall || ed.draft.length < 3 ? 'polyline' : 'polygon', {
      points: pointsAttr(ed.draft), class: `draft${wall ? ' wall' : ''}`,
      'stroke-width': wall ? ed.wallWidth || unit * 0.67 : unit * 0.25,
    }));
    for (const p of ed.draft) nodes.push(s('circle', { cx: p[0], cy: p[1], r: unit * 0.45, fill: '#2563eb' }));
  }

  // Sinov marshruti
  for (const leg of ed.test?.legs || []) {
    if (leg.floorId !== f.id) continue;
    nodes.push(s('polyline', { points: pointsAttr(leg.points), class: 'test-route', 'stroke-width': unit * 0.8 }));
  }
  if (ed.measure.length) {
    const [a, b = a] = ed.measure;
    nodes.push(s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'measure', 'stroke-width': unit * 0.3 }),
      s('circle', { cx: a[0], cy: a[1], r: unit * 0.5, fill: '#7c3aed' }));
  }

  // Nuqtalar
  const isSelected = (p) => (ed.sel?.kind === 'place' && ed.sel.id === p.id) || p === ed.newPlace;
  // Tanlangan hudud oxirida chiziladi — yozuvi boshqa belgilar ustida turadi
  const drawn = ed.places.filter((p) => p.floor_id === f.id).sort((a, b) => isSelected(a) - isSelected(b));
  if (ed.newPlace) drawn.push(ed.newPlace);
  for (const p of drawn) {
    const selected = isSelected(p);
    const m = markerNode(p, unit * (selected ? 1.6 : 1.3));
    if (selected) m.classList.add('selected');
    if (p.active === 0) m.classList.add('inactive');
    // Nom faqat tanlangan hududda yoziladi (hammasida yozilsa bir-birini yopadi); qolganlarida sichqoncha olib borilganda chiqadi
    if (selected) m.append(s('text', { y: unit * 3.4, 'font-size': unit * 1.3, 'stroke-width': unit * 0.35, class: 'marker-label' }, p.name_uz || 'Yangi hudud'));
    else m.append(s('title', null, p.name_uz));
    m.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || p === ed.newPlace) return;
      if (ed.mode === 'test') {
        e.stopPropagation();
        testRoute(p);
      } else if (ed.mode === 'select') {
        e.stopPropagation();
        ed.sel = { kind: 'place', id: p.id };
        ed.drag = { kind: 'place', place: p, node: m, moved: false };
        svg.setPointerCapture(e.pointerId);
        drawProps();
      }
    });
    nodes.push(m);
  }
  layer.replaceChildren(...nodes);
}

async function finishMeasure() {
  const f = floorOf();
  const [a, b] = ed.measure;
  const px = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const meters = Number(String(prompt('Bu ikki nuqta orasidagi haqiqiy masofa necha metr?') || '').replace(',', '.'));
  ed.measure = [];
  if (meters > 0 && px > 0) {
    f.meters_per_px = meters / px;
    await api(`/floors/${f.id}`, { method: 'PUT', body: { meters_per_px: f.meters_per_px } });
    toast('Masshtab saqlandi');
  }
  drawSvg();
  drawProps();
}

function testRoute(place) {
  const kiosks = ed.places.filter((p) => p.category === 'kiosk' && p.active !== 0);
  const kiosk = kiosks.find((p) => p.floor_id === ed.floorId) || kiosks[0];
  if (!kiosk) return toast('Avval kiosk joyini belgilang', true);
  if (place.category === 'kiosk') return toast('Kioskdan boshqa hududni tanlang', true);
  ed.test = createRouter(ed.floors, ed.places).route(kiosk, place);
  if (!ed.test) toast('Yoʻl topilmadi: hudud toʻsiqlar bilan toʻliq oʻralgan yoki qavatlar bogʻlanmagan', true);
  else {
    const px = ed.test.legs.reduce((sum, l) => sum + l.length, 0);
    setStatus(`Yoʻl topildi: ${ed.test.legs.length} boʻlak, ${Math.round(px)} px`);
  }
  drawSvg();
}

function drawProps() {
  const box = $('props');
  if (!box) return;
  const f = floorOf();
  const cards = [];

  // --- qavat ---
  const floorSelect = h('select', {
    onchange: (e) => {
      ed.floorId = Number(e.target.value);
      ed.view = null;
      ed.sel = null;
      ed.test = null;
      ed.draft = [];
      renderMap();
    },
  }, ed.floors.map((x) => h('option', { value: x.id, selected: x.id === ed.floorId }, x.name)));
  const addFloor = run(async () => {
    const name = prompt('Qavat nomi (masalan: 1-qavat)');
    if (!name) return;
    const r = await api('/floors', { method: 'POST', body: { name, sort: ed.floors.length } });
    await loadMapData();
    ed.floorId = r.id;
    ed.view = null;
    renderMap();
  });
  const file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', hidden: true });
  file.addEventListener('change', run(async () => {
    const blob = file.files[0];
    if (!blob) return;
    const img = new Image();
    img.src = URL.createObjectURL(blob);
    await img.decode();
    toast('Rasm yuklanmoqda…');
    await api(`/floors/${f.id}/image?w=${img.naturalWidth}&h=${img.naturalHeight}`, { method: 'PUT', raw: { type: blob.type, data: blob } });
    URL.revokeObjectURL(img.src);
    await loadMapData();
    ed.view = null;
    renderMap();
    toast('Xarita rasmi yuklandi');
  }));

  const floorCard = h('div', { class: 'card stack' }, h('h2', null, 'Qavat'),
    h('div', { class: 'row' }, h('div', { style: 'flex:1' }, floorSelect), h('button', { class: 'btn', onclick: addFloor }, '＋')));
  if (f) {
    const name = h('input', { type: 'text', value: f.name });
    name.addEventListener('change', run(async () => {
      await api(`/floors/${f.id}`, { method: 'PUT', body: { name: name.value } });
      f.name = name.value.trim() || f.name;
      drawProps();
    }));
    floorCard.append(
      field('Nomi', name),
      h('span', { class: 'hint' },
        f.image ? `Rasm: ${f.width}×${f.height} px · ` : 'Rasm yuklanmagan · ',
        f.meters_per_px ? `masshtab: 100 px ≈ ${(f.meters_per_px * 100).toFixed(1)} m` : 'masshtab belgilanmagan',
        ` · toʻsiqlar: ${f.obstacles.length}`),
      file,
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => file.click() }, f.image ? 'Rasmni almashtirish' : 'Rasm yuklash'),
        h('button', {
          class: 'btn danger',
          onclick: run(async () => {
            if (!confirm(`“${f.name}” qavati va undagi barcha nuqtalar oʻchirilsinmi?`)) return;
            await api(`/floors/${f.id}`, { method: 'DELETE' });
            ed.floorId = null;
            await loadMapData();
            renderMap();
          }),
        }, 'Qavatni oʻchirish')));
  }
  cards.push(floorCard);

  // --- tanlangan nuqta ---
  const place = ed.newPlace || (ed.sel?.kind === 'place' ? ed.places.find((p) => p.id === ed.sel.id) : null);
  if (place) cards.push(placeForm(place));

  // --- tanlangan to'siq ---
  if (ed.sel?.kind === 'obs' && f?.obstacles[ed.sel.index]) {
    const o = f.obstacles[ed.sel.index];
    const card = h('div', { class: 'card stack' }, h('h2', null, o.type === 'wall' ? 'Devor' : 'Xona / toʻsiq'),
      h('span', { class: 'hint' }, `${o.points.length} ta nuqta. Burchaklarni sudrab oʻzgartirish mumkin.`));
    if (o.type === 'wall') {
      const width = h('input', { type: 'number', min: 1, value: o.width });
      width.addEventListener('change', run(async () => {
        o.width = Math.max(1, Number(width.value) || o.width);
        drawSvg();
        await saveObstacles();
      }));
      card.append(field('Qalinligi (px)', width));
    }
    card.append(h('button', { class: 'btn danger', onclick: deleteSelectedObstacle }, 'Oʻchirish (Delete)'));
    cards.push(card);
  }

  // --- hech narsa tanlanmaganda: qisqa yo'riqnoma ---
  if (f && !place && ed.sel?.kind !== 'obs') {
    const hasKiosk = ed.places.some((p) => p.category === 'kiosk');
    cards.push(h('div', { class: 'card stack' }, h('h2', null, 'Qanday ishlatiladi'),
      h('ol', null,
        h('li', null, h('b', null, 'Yangi hudud: '), 'chapdagi «＋ Yangi hudud»ni bosing, xaritada joyini belgilang, nomini yozib saqlang.'),
        h('li', null, h('b', null, 'Tahrirlash: '), 'roʻyxatdan yoki xaritadan hududni tanlang. Joyini oʻzgartirish uchun belgini sudrang.'),
        h('li', null, h('b', null, 'Tekshirish: '), '«▶ Yoʻlni sinash» rejimida hududni bosing — kioskdan yoʻl chiziladi.')),
      hasKiosk ? null : h('span', { class: 'warn' }, 'Kiosk joyi belgilanmagan — «＋ Kiosk joyi» orqali qoʻying, aks holda yoʻl chizilmaydi.')));
  }
  box.replaceChildren(...cards);
  drawZones();
}

const deleteSelectedObstacle = run(async () => {
  const f = floorOf();
  if (ed.sel?.kind !== 'obs' || !f) return;
  f.obstacles.splice(ed.sel.index, 1);
  ed.sel = null;
  drawSvg();
  drawProps();
  await saveObstacles();
});

function placeForm(place) {
  const isNew = !place.id;
  const inp = (key, attrs = {}) => h('input', { type: 'text', value: place[key] || '', ...attrs });
  const f = {
    name_uz: inp('name_uz', { placeholder: 'Hojatxona' }),
    name_ru: inp('name_ru', { placeholder: 'Туалет' }),
    name_en: inp('name_en', { placeholder: 'Restroom' }),
    category: h('select', null, Object.entries(CATEGORIES).map(([k, c]) => h('option', { value: k, selected: place.category === k }, c.uz))),
    description: h('textarea', { rows: 3, value: place.description || '' }),
    link_code: inp('link_code', { placeholder: 'masalan: LIFT-A' }),
    active: h('input', { type: 'checkbox', checked: place.active !== 0 }),
  };
  const linkField = field('Qavatlararo bogʻlanish kodi', f.link_code,
    'Lift, eskalator yoki zina uchun: ikkala qavatdagi nuqtaga bir xil kod yozing — yoʻl shu orqali boshqa qavatga oʻtadi.');
  const syncLink = () => { linkField.hidden = !['lift', 'escalator', 'stairs'].includes(f.category.value); };
  f.category.addEventListener('change', syncLink);
  syncLink();

  const save = run(async () => {
    const body = {
      floor_id: place.floor_id, x: place.x, y: place.y,
      name_uz: f.name_uz.value, name_ru: f.name_ru.value, name_en: f.name_en.value,
      category: f.category.value, description: f.description.value,
      link_code: linkField.hidden ? '' : f.link_code.value, active: f.active.checked,
    };
    const r = await api(isNew ? '/places' : `/places/${place.id}`, { method: isNew ? 'POST' : 'PUT', body });
    await loadMapData();
    ed.newPlace = null;
    ed.sel = { kind: 'place', id: isNew ? r.id : place.id };
    toast('Hudud saqlandi');
    if (isNew) return setMode('select'); // qo'shib bo'lingach oddiy rejimga qaytamiz (tanlov saqlanadi)
    drawSvg();
    drawProps();
  });

  return h('div', { class: 'card stack' },
    h('h2', null, place.category === 'kiosk' ? 'Kiosk joyi' : isNew ? 'Yangi hudud' : 'Hudud'),
    field('Nomi (oʻzbekcha) *', f.name_uz), field('Nomi (ruscha)', f.name_ru), field('Nomi (inglizcha)', f.name_en),
    field('Turi', f.category),
    field('Izoh', f.description, 'AI uchun: qayerda joylashgani, ish vaqti va h.k. Yoʻlovchiga ham koʻrsatiladi.'),
    linkField,
    h('label', { class: 'check' }, f.active, 'Faol'),
    place.category === 'kiosk' && !isNew
      ? h('span', { class: 'hint' }, `Shu kiosk ekrani manzili: ${location.origin}/?kiosk=${place.id}`) : null,
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', onclick: save }, 'Saqlash'),
      h('button', {
        class: 'btn',
        onclick: () => {
          ed.newPlace = null;
          ed.sel = null;
          drawSvg();
          drawProps();
        },
      }, 'Yopish'),
      isNew ? null : h('button', {
        class: 'btn danger',
        onclick: run(async () => {
          if (!confirm(`“${place.name_uz}” oʻchirilsinmi?`)) return;
          await api(`/places/${place.id}`, { method: 'DELETE' });
          await loadMapData();
          ed.sel = null;
          drawSvg();
          drawProps();
        }),
      }, 'Oʻchirish')));
}

document.addEventListener('keydown', (e) => {
  if (currentView !== 'map' || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) return;
  if (e.key === 'Enter') finishDraft();
  else if (e.key === 'Escape') {
    ed.draft = [];
    ed.measure = [];
    drawSvg();
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    if (ed.draft.length) {
      ed.draft.pop();
      drawSvg();
    } else deleteSelectedObstacle();
  }
});

// ---------- ishga tushirish ----------
fetch('/api/admin/me').then((r) => r.json()).then((j) => (j.admin ? startApp() : showLogin())).catch(showLogin);
