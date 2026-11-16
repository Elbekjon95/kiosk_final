// Kioskdagi xarita (to'liq ekran): qavat rasmi, "Xizmatlar" va "Darvozalar" ro'yxati,
// kioskdan tanlangan joygacha marshrut. Xaritani barmoq bilan surish va kattalashtirish mumkin.
import { createRouter } from './pathfinder.js';
import { CATEGORIES, category, h, s, catIcon, markerNode, uiIcon } from './categories.js';
import { t, placeName, getLang } from './i18n.js';

const CONNECTORS = ['lift', 'escalator', 'stairs'];
const CAT_ORDER = Object.keys(CATEGORIES);
const TAP_PX = 8; // shundan kam siljish — bosish deb hisoblanadi

/** Burchaklari yumaloqlangan SVG yo'l. */
function roundedPath(points, radius) {
  if (points.length < 2) return '';
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1];
    const [cx, cy] = points[i];
    const [nx, ny] = points[i + 1];
    const d1 = Math.hypot(cx - px, cy - py);
    const d2 = Math.hypot(nx - cx, ny - cy);
    const r = Math.min(radius, d1 / 2, d2 / 2);
    const ax = cx + ((px - cx) / d1) * r;
    const ay = cy + ((py - cy) / d1) * r;
    const bx = cx + ((nx - cx) / d2) * r;
    const by = cy + ((ny - cy) / d2) * r;
    d += ` L${ax.toFixed(1)} ${ay.toFixed(1)} Q${cx} ${cy} ${bx.toFixed(1)} ${by.toFixed(1)}`;
  }
  const last = points.at(-1);
  return `${d} L${last[0]} ${last[1]}`;
}

const remPx = () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/** Yozuvli yorliq (qora fon, rangli hoshiya). O'lchami matnga qarab `fitTags` da belgilanadi. */
function tag(text, cls, fontSize, y) {
  return s('g', { class: `tag ${cls}` },
    s('rect', { class: 'tag-box' }),
    s('text', { class: 'tag-text', 'font-size': fontSize, y }, text));
}

function fitTags(layer) {
  for (const g of layer.querySelectorAll('.tag')) {
    const [box, text] = g.children;
    const fs = Number(text.getAttribute('font-size'));
    const y = Number(text.getAttribute('y'));
    let w = 0;
    try { w = text.getComputedTextLength(); } catch { /* element ko'rinmayapti */ }
    if (!w) w = text.textContent.length * fs * 0.7;
    const height = fs * 1.9;
    const width = w + fs * 1.5;
    for (const [k, v] of Object.entries({ x: -width / 2, y: y - height / 2, width, height, rx: fs * 0.35, 'stroke-width': fs * 0.13 })) {
      box.setAttribute(k, v.toFixed(2));
    }
  }
}

export class MapView {
  constructor(root) {
    this.root = root;
    this.floors = [];
    this.places = [];
    this.kiosk = null;
    this.floorId = null;
    this.selected = null;
    this.route = null;
    this.legIndex = 0;
    this.filter = '';
    this.view = null; // xaritaning ko'rinib turgan qismi (rasm piksellarida)
    this.auto = true; // true — ko'rinish marshrutga/qavatga avtomatik moslanadi; surilsa false bo'ladi
    this.dom = null;
    this.raf = 0;
  }

  setData({ floors, places, kioskId }) {
    this.floors = floors;
    this.places = places;
    this.kiosk = places.find((p) => p.id === kioskId) || null;
    this.router = createRouter(floors, places);
    if (!floors.some((f) => f.id === this.floorId)) this.floorId = this.kiosk?.floor_id ?? floors[0]?.id ?? null;
    if (this.selected) this.selected = places.find((p) => p.id === this.selected.id) || null;
    this.route = this.selected && this.kiosk ? this.router.route(this.kiosk, this.selected) : null;
    this.auto = true;
  }

  reset() {
    this.selected = null;
    this.note = '';
    this.route = null;
    this.filter = '';
    this.floorId = this.kiosk?.floor_id ?? this.floors[0]?.id ?? null;
    this.auto = true;
  }

  /** Joyni tanlab, marshrutni ko'rsatadi. note — qo'shimcha qator (masalan reys va peshtaxta raqamlari). */
  select(placeId, note = '') {
    const place = this.places.find((p) => p.id === placeId && p.category !== 'kiosk');
    if (!place) return;
    this.selected = place;
    this.note = note || '';
    this.route = this.kiosk ? this.router.route(this.kiosk, place) : null;
    this.legIndex = 0;
    this.floorId = this.route ? this.route.legs[0].floorId : place.floor_id;
    this.auto = true;
    document.activeElement?.blur?.(); // qidiruv maydoni ochiq bo'lsa, ekran klaviaturasi yopilsin
    this.render();
  }

  /** Tanlovni bekor qiladi — butun qavat ko'rinadi. */
  clear() {
    this.selected = null;
    this.note = '';
    this.route = null;
    this.auto = true;
    this.render();
  }

  get floor() {
    return this.floors.find((f) => f.id === this.floorId) || this.floors[0];
  }

  /** Joriy qavatdagi marshrut bo'lagi. */
  get leg() {
    const id = this.floor?.id;
    return this.route?.legs.find((l, i) => l.floorId === id && i === this.legIndex) ||
      this.route?.legs.find((l) => l.floorId === id) || null;
  }

  render() {
    const root = this.root;
    root.replaceChildren();
    this.dom = null;
    if (!this.floors.length) {
      root.append(h('div', { class: 'empty' }, t('noMap')));
      return;
    }
    const floor = this.floor;
    const svg = s('svg', { class: 'map-svg', preserveAspectRatio: 'xMidYMid meet' });
    const layer = s('g');
    svg.append(s('image', { href: `/uploads/${floor.image}`, width: floor.width, height: floor.height }), layer);
    const canvas = h('div', { class: 'map-canvas' }, svg);

    const left = this.renderServices();
    const right = this.renderGates();
    const info = this.renderInfo(floor);
    const zoomBtn = (label, title, fn) => h('button', { type: 'button', title, onclick: fn }, label);
    const zoom = h('div', { class: 'map-zoom' },
      zoomBtn('+', t('zoomIn'), () => this.zoomBy(1 / 1.4)),
      zoomBtn('−', t('zoomOut'), () => this.zoomBy(1.4)),
      zoomBtn(uiIcon('fit', 22), t('zoomFit'), () => { this.auto = true; this.layout(); }));

    const tabs = this.floors.length > 1
      ? h('div', { class: 'floor-tabs' }, this.floors.map((f) =>
        h('button', {
          class: `chip${f.id === floor.id ? ' active' : ''}`,
          onclick: () => {
            this.floorId = f.id;
            const idx = this.route?.legs.findIndex((l) => l.floorId === f.id);
            if (idx >= 0) this.legIndex = idx;
            this.auto = true;
            this.render();
          },
        }, f.name)))
      : null;

    root.append(h('div', { class: `map-full${right ? '' : ' no-gates'}` }, canvas, left, right, tabs, info, zoom));
    this.dom = { svg, layer, canvas, left, right, info };
    this.bindGestures(svg);
    this.layout();
    // Shrift kech yuklansa, yorliqlar o'lchami qayta hisoblanadi
    document.fonts?.ready.then(() => this.dom?.layer === layer && fitTags(layer));
  }

  // ---------- ro'yxatlar ----------
  placeButton(p, sub) {
    return h('button', { class: `place${this.selected?.id === p.id ? ' active' : ''}`, onclick: () => this.select(p.id) },
      h('span', { class: 'place-icon', style: `background:${category(p.category).color}` }, catIcon(p.category, 18)),
      h('span', { class: 'place-text' }, h('b', null, placeName(p)), sub ? h('small', null, sub) : null));
  }

  floorName(p) {
    return this.floors.length > 1 ? this.floors.find((f) => f.id === p.floor_id)?.name || '' : '';
  }

  /** Chap panel: darvozalardan boshqa barcha joylar. */
  renderServices() {
    const all = this.places
      .filter((p) => p.category !== 'kiosk' && p.category !== 'gate')
      .sort((a, b) => CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category) || placeName(a).localeCompare(placeName(b), getLang(), { numeric: true }));
    const list = h('div', { class: 'place-list' });
    const fill = () => {
      const q = this.filter.trim().toLowerCase();
      const items = all.filter((p) => {
        if (!q) return !CONNECTORS.includes(p.category); // lift va zinalar faqat qidirilganda chiqadi
        return [p.name_uz, p.name_ru, p.name_en, p.description, category(p.category)[getLang()]].some((v) => v && v.toLowerCase().includes(q));
      });
      list.replaceChildren(...items.map((p) => this.placeButton(p, this.floorName(p))));
      if (!items.length) list.append(h('div', { class: 'empty small' }, '—'));
    };
    fill();
    const search = h('input', {
      class: 'search', type: 'search', placeholder: t('searchPlace'), value: this.filter,
      oninput: (e) => {
        this.filter = e.target.value;
        fill();
      },
    });
    return h('aside', { class: 'map-float left' }, h('h3', null, t('services')), search, list);
  }

  /** O'ng panel: chiqish yo'laklari (gate). */
  renderGates() {
    const gates = this.places
      .filter((p) => p.category === 'gate')
      .sort((a, b) => placeName(a).localeCompare(placeName(b), getLang(), { numeric: true }));
    if (!gates.length) return null;
    return h('aside', { class: 'map-float right' }, h('h3', null, t('gates')),
      h('div', { class: 'place-list' }, gates.map((p) => this.placeButton(p, this.floorName(p)))));
  }

  renderInfo(floor) {
    if (!this.selected) return h('div', { class: 'map-info hint' }, t('pickPlace'));
    const p = this.selected;
    const info = h('div', { class: 'map-info' },
      h('span', { class: 'place-icon', style: `background:${category(p.category).color}` }, catIcon(p.category, 22)),
      h('div', { class: 'map-info-text' },
        h('b', null, placeName(p)),
        this.note ? h('span', { class: 'map-note' }, this.note) : p.description ? h('small', null, p.description) : null));

    if (!this.kiosk) info.append(h('span', { class: 'badge warn' }, t('noKiosk')));
    else if (!this.route) info.append(h('span', { class: 'badge warn' }, t('noRoute')));
    else {
      // Masofa: har qavatning o'z masshtabi bo'yicha (admin kiritgan bo'lsa)
      let meters = 0;
      let known = true;
      for (const l of this.route.legs) {
        const f = this.floors.find((x) => x.id === l.floorId);
        if (f?.meters_per_px) meters += l.length * f.meters_per_px;
        else known = false;
      }
      if (known && meters > 0) {
        info.append(h('span', { class: 'badge' }, uiIcon('walk', 18),
          t('walk', { m: Math.round(meters / 5) * 5, min: Math.max(1, Math.round(meters / 70)) })));
      }
    }
    info.append(h('button', { class: 'round', type: 'button', title: t('close'), onclick: () => this.clear() }, uiIcon('close', 20)));

    if (this.route?.legs.length > 1) {
      const target = this.floors.find((f) => f.id === this.route.legs[1].floorId);
      info.append(h('div', { class: 'steps' },
        this.route.legs.map((l, i) =>
          h('button', {
            class: `chip${l.floorId === floor.id ? ' active' : ''}`,
            onclick: () => {
              this.legIndex = i;
              this.floorId = l.floorId;
              this.auto = true;
              this.render();
            },
          }, t('step', { n: i + 1 }))),
        h('span', { class: 'muted' }, t('goVia', { via: placeName(this.route.via), floor: target?.name || '' }))));
    }
    return info;
  }

  // ---------- ko'rinish (surish, kattalashtirish) ----------
  /** Panellar yopmagan bo'sh joy (xarita maydoniga nisbatan, piksellarda). */
  freeRect(r) {
    const rem = remPx();
    const rel = (el) => {
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return b.width ? { l: b.left - r.left, t: b.top - r.top, r: b.right - r.left } : null;
    };
    let x0 = rem;
    let y0 = rem * 5.2; // sarlavha va yopish tugmasi
    let x1 = r.width - rem;
    let y1 = r.height - rem;
    const portrait = matchMedia('(orientation: portrait)').matches;
    for (const p of [rel(this.dom.left), rel(this.dom.right)]) {
      if (!p) continue;
      if (portrait) y1 = Math.min(y1, p.t - rem); // tik ekranda ro'yxatlar pastda
      else if (p.l < r.width / 2) x0 = Math.max(x0, p.r + rem);
      else x1 = Math.min(x1, p.l - rem);
    }
    const info = rel(this.dom.info);
    if (info) y1 = Math.min(y1, info.t - rem);
    if (x1 - x0 < 120 || y1 - y0 < 120) return { x: 0, y: 0, w: r.width, h: r.height };
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  /** Marshrut (yoki barcha nuqtalar) bo'sh joyga sig'adigan ko'rinish. */
  autoView(r) {
    const floor = this.floor;
    const leg = this.leg;
    let pts = leg ? leg.points : this.places.filter((p) => p.floor_id === floor.id).map((p) => [p.x, p.y]);
    if (!leg && this.selected?.floor_id === floor.id) {
      pts = [[this.selected.x, this.selected.y]];
      if (this.kiosk?.floor_id === floor.id) pts.push([this.kiosk.x, this.kiosk.y]);
    }
    if (!pts.length) pts = [[0, 0], [floor.width, floor.height]];
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    const focused = Boolean(leg || this.selected);
    const pad = focused ? 0.2 : 0.07;
    const minFrac = focused ? 0.2 : 0.4; // juda kichik bo'lakka yaqinlashib ketmaslik uchun
    const bw = Math.max((x1 - x0) * (1 + 2 * pad), floor.width * minFrac);
    const bh = Math.max((y1 - y0) * (1 + 2 * pad), floor.height * minFrac);
    const free = this.freeRect(r);
    const scale = Math.min(free.w / bw, free.h / bh); // 1 rasm pikseli = scale ekran pikseli
    return {
      x: (x0 + x1) / 2 - (free.x + free.w / 2) / scale,
      y: (y0 + y1) / 2 - (free.y + free.h / 2) / scale,
      w: r.width / scale,
      h: r.height / scale,
    };
  }

  /** Ko'rinishni xarita maydoni o'lchamiga moslab qayta chizadi (ochilganda va ekran o'lchami o'zgarganda). */
  layout() {
    if (!this.dom) return;
    const r = this.dom.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if (this.auto || !this.view) this.view = this.autoView(r);
    else {
      const cy = this.view.y + this.view.h / 2;
      this.view.h = (this.view.w * r.height) / r.width;
      this.view.y = cy - this.view.h / 2;
    }
    this.applyView();
    this.drawLayer();
  }

  applyView() {
    const v = this.view;
    this.dom.svg.setAttribute('viewBox', `${v.x.toFixed(1)} ${v.y.toFixed(1)} ${v.w.toFixed(1)} ${v.h.toFixed(1)}`);
  }

  /** Ko'rinish markazi rasm chegarasidan chiqib ketmasin. */
  clampView() {
    const f = this.floor;
    const v = this.view;
    v.x = clamp(v.x + v.w / 2, 0, f.width) - v.w / 2;
    v.y = clamp(v.y + v.h / 2, 0, f.height) - v.h / 2;
  }

  /** `from` ekran nuqtasi ostidagi joy `to` nuqtasiga ko'chadi va masshtab `factor` marta o'zgaradi. */
  zoomAt(from, to, factor) {
    if (!this.dom || !this.view) return;
    const r = this.dom.canvas.getBoundingClientRect();
    const f = this.floor;
    const v = this.view;
    const k = r.width / v.w;
    const mx = v.x + (from[0] - r.left) / k;
    const my = v.y + (from[1] - r.top) / k;
    const w = clamp(v.w * factor, f.width / 14, f.width * 2.5);
    const k2 = r.width / w;
    this.view = { x: mx - (to[0] - r.left) / k2, y: my - (to[1] - r.top) / k2, w, h: (w * r.height) / r.width };
    this.auto = false;
    this.clampView();
    this.applyView();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => this.drawLayer());
  }

  zoomBy(factor) {
    if (!this.dom) return;
    const r = this.dom.canvas.getBoundingClientRect();
    const free = this.freeRect(r);
    const c = [r.left + free.x + free.w / 2, r.top + free.y + free.h / 2];
    this.zoomAt(c, c, factor);
  }

  bindGestures(svg) {
    const pts = new Map();
    let moved = 0;
    svg.addEventListener('pointerdown', (e) => {
      if (e.button) return;
      if (!pts.size) moved = 0;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      try { svg.setPointerCapture(e.pointerId); } catch { /* ixtiyoriy */ }
    });
    svg.addEventListener('pointermove', (e) => {
      const prev = pts.get(e.pointerId);
      if (!prev || !this.view) return;
      const cur = [e.clientX, e.clientY];
      if (pts.size === 1) {
        moved += Math.abs(cur[0] - prev[0]) + Math.abs(cur[1] - prev[1]);
        if (moved <= TAP_PX) return; // hali bosish bo'lishi mumkin
        const k = this.dom.canvas.getBoundingClientRect().width / this.view.w;
        this.view.x -= (cur[0] - prev[0]) / k;
        this.view.y -= (cur[1] - prev[1]) / k;
        this.auto = false;
        this.clampView();
        this.applyView();
      } else if (pts.size === 2) {
        // Ikki barmoq: kattalashtirish va surish
        const other = [...pts].find(([id]) => id !== e.pointerId)[1];
        const d0 = Math.hypot(prev[0] - other[0], prev[1] - other[1]);
        const d1 = Math.hypot(cur[0] - other[0], cur[1] - other[1]);
        moved += TAP_PX + 1;
        if (d0 > 0 && d1 > 0) {
          this.zoomAt([(prev[0] + other[0]) / 2, (prev[1] + other[1]) / 2], [(cur[0] + other[0]) / 2, (cur[1] + other[1]) / 2], d0 / d1);
        }
      }
      pts.set(e.pointerId, cur);
    });
    const end = (e) => {
      if (!pts.delete(e.pointerId)) return;
      if (e.type !== 'pointerup' || pts.size || moved > TAP_PX) return;
      // Bosish: ko'rsatkich svg ga "ushlangan" bo'lgani uchun nuqtani o'zimiz topamiz
      const marker = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.marker');
      if (marker) this.select(Number(marker.dataset.id));
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const c = [e.clientX, e.clientY];
      this.zoomAt(c, c, e.deltaY > 0 ? 1.2 : 1 / 1.2);
    }, { passive: false });
  }

  /** Marshrut, belgilar va yorliqlarni joriy masshtabga mos o'lchamda chizadi. */
  drawLayer() {
    if (!this.dom || !this.view) return;
    const { layer, canvas } = this.dom;
    const floor = this.floor;
    const leg = this.leg;
    const width = canvas.getBoundingClientRect().width;
    if (!width) return;
    const unit = (remPx() * 0.8) / (width / this.view.w); // ekranda doimiy o'lcham (≈0.8rem) rasm piksellarida
    const nodes = [];

    if (leg) {
      const d = roundedPath(leg.points, unit * 2.2);
      nodes.push(
        s('path', { d, class: 'route-glow', 'stroke-width': unit * 2.4 }),
        s('path', { d, class: 'route-case', 'stroke-width': unit * 1.05 }),
        s('path', {
          d, class: 'route-line', 'stroke-width': unit * 0.55,
          'stroke-dasharray': `${unit * 1.6} ${unit * 1.5}`, style: `--dash:${unit * 3.1}px`,
        }),
        s('circle', { r: unit * 0.8, class: 'route-dot', 'stroke-width': unit * 0.32 },
          s('animateMotion', { dur: `${Math.max(3, leg.length / (unit * 14)).toFixed(1)}s`, repeatCount: 'indefinite', path: d })),
      );
    }

    // Joy tanlanmaganda barcha nuqtalar ko'rinadi (bosib tanlash uchun); marshrut paytida xarita toza turadi
    const target = this.selected?.floor_id === floor.id ? this.selected : leg?.to?.category !== 'kiosk' ? leg?.to : null;
    if (!this.selected) {
      for (const p of this.places) {
        if (p.floor_id === floor.id && p.category !== 'kiosk') nodes.push(markerNode(p, unit * 1.15));
      }
    }

    const pulse = (cls) => s('circle', { r: unit, class: cls },
      s('animate', { attributeName: 'r', values: `${unit};${unit * 3.4}`, dur: '1.8s', repeatCount: 'indefinite' }),
      s('animate', { attributeName: 'opacity', values: '0.5;0', dur: '1.8s', repeatCount: 'indefinite' }));

    if (this.kiosk?.floor_id === floor.id) {
      const k = this.kiosk;
      nodes.push(s('g', { transform: `translate(${k.x} ${k.y})` },
        pulse('here-pulse'),
        s('circle', { r: unit, class: 'here-dot', 'stroke-width': unit * 0.3 }),
        tag(t('youAreHere').toUpperCase(), 'here', unit * 1.15, -unit * 2.7)));
    }
    if (target) {
      nodes.push(s('g', { transform: `translate(${target.x} ${target.y})` },
        pulse('target-pulse'),
        s('circle', { r: unit, class: 'target-dot', 'stroke-width': unit * 0.3 }),
        s('circle', { r: unit * 0.34, class: 'target-core' }),
        tag(placeName(target).toUpperCase().slice(0, 34), 'target', unit * 1.15, -unit * 2.7)));
    }
    layer.replaceChildren(...nodes);
    fitTags(layer);
  }
}

export { CATEGORIES };
