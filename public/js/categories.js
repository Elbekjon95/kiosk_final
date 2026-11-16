// Xarita nuqtalari kategoriyalari — kiosk va admin panel uchun umumiy.
// icon: 24x24 chiziqli SVG ichki qismi (statik, ishonchli matn).
export const CATEGORIES = {
  kiosk: { uz: 'Kiosk (siz shu yerdasiz)', ru: 'Киоск (вы здесь)', en: 'Kiosk (you are here)', color: '#38d6ff', icon: '<circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="9"/>' },
  info: { uz: 'Axborot peshtaxtasi', ru: 'Информация', en: 'Information', color: '#3b82f6', icon: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.4v.2"/>' },
  checkin: { uz: 'Roʻyxatdan oʻtish', ru: 'Регистрация', en: 'Check-in', color: '#0ea5e9', icon: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 10h8M8 14h5"/>' },
  security: { uz: 'Nazorat (xavfsizlik, pasport, bojxona)', ru: 'Контроль (досмотр, паспорт, таможня)', en: 'Security & passport control', color: '#6366f1', icon: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>' },
  gate: { uz: 'Chiqish yoʻlagi (gate)', ru: 'Выход на посадку', en: 'Gate', color: '#14b8a6', icon: '<path d="M5 21V4h9v17M3 21h18M14 12h6M17 9l3 3-3 3"/>' },
  baggage: { uz: 'Bagaj', ru: 'Багаж', en: 'Baggage', color: '#f59e0b', icon: '<rect x="5" y="7" width="14" height="13" rx="2"/><path d="M9 7V4h6v3M9 11v5M15 11v5"/>' },
  wc: { uz: 'Hojatxona', ru: 'Туалет', en: 'Restroom', color: '#22c55e', icon: '<circle cx="8" cy="5" r="2"/><path d="M8 9v6M5 11h6M8 15l-2 6M8 15l2 6"/><circle cx="17" cy="5" r="2"/><path d="M17 9l-3 7h6l-3-7M17 16v5"/>' },
  cafe: { uz: 'Kafe va restoran', ru: 'Кафе и рестораны', en: 'Cafés & restaurants', color: '#f97316', icon: '<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9zM17 10h2a2 2 0 0 1 0 5h-2M8 3v3M12 3v3"/>' },
  shop: { uz: 'Doʻkon', ru: 'Магазин', en: 'Shop', color: '#ec4899', icon: '<path d="M5 8h14l-1 13H6L5 8zM9 8V6a3 3 0 0 1 6 0v2"/>' },
  exchange: { uz: 'Bank, bankomat, valyuta', ru: 'Банк, банкомат, обмен валют', en: 'Bank, ATM, exchange', color: '#84cc16', icon: '<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .8-3 2s1 1.8 3 2 3 .8 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2"/>' },
  medical: { uz: 'Tibbiyot punkti', ru: 'Медпункт', en: 'Medical', color: '#ef4444', icon: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/>' },
  prayer: { uz: 'Namozxona', ru: 'Молельная комната', en: 'Prayer room', color: '#10b981', icon: '<path d="M18 14.5A7.5 7.5 0 1 1 9.5 6a6 6 0 0 0 8.5 8.5z"/>' },
  mother: { uz: 'Ona va bola xonasi', ru: 'Комната матери и ребёнка', en: 'Mother & child room', color: '#f472b6', icon: '<path d="M12 20s-7-4.4-7-9.5A4 4 0 0 1 12 8a4 4 0 0 1 7 2.5C19 15.6 12 20 12 20z"/>' },
  lounge: { uz: 'Kutish zali, VIP', ru: 'Зал ожидания, VIP', en: 'Lounge, VIP', color: '#a855f7', icon: '<path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3v-5zM6 18v2M18 18v2"/>' },
  taxi: { uz: 'Transport, taksi', ru: 'Транспорт, такси', en: 'Transport, taxi', color: '#eab308', icon: '<path d="M5 12l2-5h10l2 5M4 12h16v5H4v-5zM7 17v2M17 17v2M9 4h6"/>' },
  exit: { uz: 'Kirish / chiqish', ru: 'Вход / выход', en: 'Entrance / exit', color: '#64748b', icon: '<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/>' },
  lift: { uz: 'Lift', ru: 'Лифт', en: 'Elevator', color: '#0891b2', icon: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 10l3-3 3 3M9 14l3 3 3-3"/>' },
  escalator: { uz: 'Eskalator', ru: 'Эскалатор', en: 'Escalator', color: '#0891b2', icon: '<path d="M4 18h4l8-10h4"/><circle cx="9" cy="7" r="2"/>' },
  stairs: { uz: 'Zina', ru: 'Лестница', en: 'Stairs', color: '#0891b2', icon: '<path d="M4 20h4v-4h4v-4h4V8h4"/>' },
  other: { uz: 'Boshqa', ru: 'Другое', en: 'Other', color: '#94a3b8', icon: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/>' },
};

export const category = (key) => CATEGORIES[key] || CATEGORIES.other;

const NS = 'http://www.w3.org/2000/svg';

/** DOM yordamchisi: h('div', { class: 'x', onclick }, child1, 'matn') */
export function h(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'html') node.innerHTML = v; // faqat statik ikonkalar uchun
    else if (k in node && k !== 'list' && k !== 'form') node[k] = v;
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

/** SVG element yordamchisi. */
export function s(tag, attrs, ...children) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (k === 'html') node.innerHTML = v;
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

/** Kategoriya ikonkasi (24x24 chiziqli SVG). */
export function catIcon(key, size = 20) {
  return s('svg', {
    viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor',
    'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', html: category(key).icon,
  });
}

/** Xaritadagi nuqta belgisi (SVG <g>), r — rasm piksellarida radius. */
export function markerNode(place, r) {
  const cat = category(place.category);
  const g = s('g', { class: 'marker', transform: `translate(${place.x} ${place.y})`, 'data-id': place.id });
  g.append(
    s('circle', { r, fill: cat.color, stroke: '#fff', 'stroke-width': r * 0.14 }),
    s('g', {
      transform: `translate(${-r * 0.62} ${-r * 0.62}) scale(${(r * 1.24) / 24})`, fill: 'none', stroke: '#fff',
      'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', html: cat.icon,
    }),
  );
  return g;
}

export const UI_ICONS = {
  map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  plane: '<path d="M12 3c1 0 1.5 1 1.5 2.5V9l7 4v2l-7-2v4l2.5 2v1.5L12 20l-4 1.5V20l2.5-2v-4l-7 2v-2l7-4V5.5C10.5 4 11 3 12 3z"/>',
  chat: '<path d="M4 5h16v11H9l-5 4V5z"/><path d="M8 9h8M8 12.5h5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  play: '<path d="M7 4l13 8-13 8V4z"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
  send: '<path d="M4 12l16-8-6 16-2.5-6.5L4 12z"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  walk: '<circle cx="13" cy="4" r="2"/><path d="M13 8l-3 3 1 4-2 6M11 11l4 2 2 3M13 15l2 6"/>',
  fit: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
};

export function uiIcon(name, size = 22) {
  return s('svg', {
    viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor',
    'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', html: UI_ICONS[name] || '',
  });
}
