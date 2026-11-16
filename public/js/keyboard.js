// Ekran klaviaturasi (sensorli kiosk uchun). Matn maydoni tanlanganda ochiladi.
import { h } from './categories.js';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const LAYOUTS = {
  uz: [DIGITS, [...'qwertyuiop'], [...'asdfghjkl', 'ʼ'], [...'zxcvbnm', 'oʻ', 'gʻ']],
  ru: [DIGITS, [...'йцукенгшщзх'], [...'фывапролджэ'], [...'ячсмитьбюъ']],
  en: [DIGITS, [...'qwertyuiop'], [...'asdfghjkl'], [...'zxcvbnm', '-', '@']],
};
// Belgilar sahifasi: e-mail, telefon va parollar uchun
const SYMBOLS = [DIGITS, [...'-_/:;()&@"'], [...".,?!'+=*%#"], [...'$^~|\\<>[]{}']];
const ORDER = ['uz', 'ru', 'en'];
const TEXT_TYPES = ['text', 'search', 'tel', 'email', 'password', 'url', 'number'];

let root = null;
let target = null;
let layout = 'uz';
let shift = false;
let symbols = false;
let secrets = {};

const isTextField = (el) =>
  el && !el.readOnly && !el.disabled &&
  (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && TEXT_TYPES.includes(el.type)));

// email/number maydonlarida kursor o'rni yo'q — matn oxiriga yoziladi.
const hasCaret = (el) => typeof el.selectionStart === 'number';

function setRaw(value) {
  // number maydoni "12." kabi tugallanmagan qiymatni tashlab yuboradi — asl matnni o'zimiz eslab turamiz
  target.kbdRaw = value;
  target.value = value;
  target.dispatchEvent(new Event('input', { bubbles: true }));
}

function insert(text) {
  if (!target) return;
  if (!hasCaret(target)) return setRaw((target.kbdRaw ?? target.value) + text);
  const start = target.selectionStart;
  const end = target.selectionEnd ?? start;
  target.setRangeText(text, start, end, 'end');
  target.dispatchEvent(new Event('input', { bubbles: true }));
}

function backspace() {
  if (!target) return;
  if (!hasCaret(target)) return setRaw((target.kbdRaw ?? target.value).slice(0, -1));
  const start = target.selectionStart;
  const end = target.selectionEnd ?? start;
  if (start === end && start === 0) return;
  target.setRangeText('', start === end ? start - 1 : start, end, 'end');
  target.dispatchEvent(new Event('input', { bubbles: true }));
}

function enter() {
  if (!target) return;
  if (target.tagName === 'TEXTAREA') insert('\n');
  else if (target.form) target.form.requestSubmit();
  else hide();
}

function key(label, action, cls = '') {
  // pointerdown + preventDefault: fokus matn maydonida qoladi
  return h('button', {
    type: 'button', class: `key ${cls}`, tabIndex: -1,
    onpointerdown: (e) => {
      e.preventDefault();
      action();
    },
  }, label);
}

function render() {
  const rows = (symbols ? SYMBOLS : LAYOUTS[layout]).map((row) =>
    h('div', { class: 'key-row' }, row.map((ch) => {
      const out = shift && !symbols ? ch.charAt(0).toUpperCase() + ch.slice(1) : ch;
      return key(out, () => {
        insert(out);
        if (shift) {
          shift = false;
          render();
        }
      });
    })));
  const next = ORDER[(ORDER.indexOf(layout) + 1) % ORDER.length];
  rows.push(h('div', { class: 'key-row' },
    key('⇧', () => { shift = !shift; render(); }, `wide${shift ? ' on' : ''}`),
    key(symbols ? 'ABC' : '#+=', () => { symbols = !symbols; shift = false; render(); }, `wide${symbols ? ' on' : ''}`),
    key(next.toUpperCase(), () => { layout = next; symbols = false; render(); }, 'wide'),
    key(',', () => insert(',')),
    key(' ', () => insert(' '), 'space'),
    key('.', () => insert('.')),
    key('?', () => insert('?')),
    key('⌫', backspace, 'wide'),
    key('↵', enter, 'wide accent'),
    key('✕', hide, 'wide')));
  root.replaceChildren(...rows);
}

function show(el) {
  target = el;
  delete el.kbdRaw;
  symbols = false;
  shift = false;
  render();
  root.hidden = false;
  document.body.classList.add('kbd-open');
  // Boshqa maydonga yozilayotganda savol qatori joy egallamasin
  document.body.classList.toggle('kbd-foreign', el.id !== 'askInput');
  document.documentElement.style.setProperty('--kbd-h', `${root.offsetHeight}px`);
  el.scrollIntoView({ block: 'nearest' });
}

export function hide() {
  if (!root || root.hidden) return;
  root.hidden = true;
  document.body.classList.remove('kbd-open', 'kbd-foreign');
  document.documentElement.style.setProperty('--kbd-h', '0px');
  const el = target;
  target = null;
  el?.blur();
}

export function setKeyboardLayout(lang) {
  if (LAYOUTS[lang]) layout = lang;
  if (root && !root.hidden) render();
}

/**
 * @param {HTMLElement} container
 * @param {{ secrets?: Record<string, () => void> }} [options]
 *   secrets — maxfiy kodlar: istalgan matn maydonida terilsa (kichik harflarda yoziladi), funksiya chaqiriladi.
 */
export function initKeyboard(container, options = {}) {
  root = container;
  secrets = options.secrets || {};
  document.addEventListener('focusin', (e) => {
    if (isTextField(e.target)) show(e.target);
  });
  // Maydon allaqachon fokusda bo'lsa (focusin kelmaydi) — bosilganda ham ochiladi
  document.addEventListener('click', (e) => {
    if (isTextField(e.target) && (e.target !== target || root.hidden)) show(e.target);
  });
  if (isTextField(document.activeElement)) show(document.activeElement);
  document.addEventListener('focusout', (e) => {
    if (e.target === target) setTimeout(() => !isTextField(document.activeElement) && hide(), 0);
  });
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!isTextField(el)) return;
    const typed = String(el.kbdRaw ?? el.value).toLowerCase();
    for (const [code, run] of Object.entries(secrets)) {
      if (!typed.endsWith(code)) continue;
      el.value = '';
      delete el.kbdRaw;
      hide();
      run();
      return;
    }
  });
}
