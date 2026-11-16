// Xaritada yo'l topish: to'siqlar (xona/devor) katakli to'rga chiziladi, A* ular atrofidan aylanib o'tadi.
// Brauzerda ham, Node testlarida ham ishlaydi (DOM kerak emas).

const MAX_CELLS = 320; // uzun tomon bo'yicha kataklar soni
const NEAR = 6; // devorgacha masofa shu katakdan ortiq bo'lsa hisoblanmaydi

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function rasterSegment(g, a, b, half) {
  const { cell, cols, rows, blocked } = g;
  const c0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - half) / cell));
  const c1 = Math.min(cols - 1, Math.floor((Math.max(a[0], b[0]) + half) / cell));
  const r0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - half) / cell));
  const r1 = Math.min(rows - 1, Math.floor((Math.max(a[1], b[1]) + half) / cell));
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (distToSegment((c + 0.5) * cell, (r + 0.5) * cell, a[0], a[1], b[0], b[1]) <= half) blocked[r * cols + c] = 1;
    }
  }
}

function rasterPolygon(g, pts) {
  const { cell, cols, rows, blocked } = g;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minY = Math.min(minY, p[1]);
    maxY = Math.max(maxY, p[1]);
  }
  const r0 = Math.max(0, Math.floor(minY / cell));
  const r1 = Math.min(rows - 1, Math.floor(maxY / cell));
  for (let r = r0; r <= r1; r++) {
    const y = (r + 0.5) * cell;
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if (a[1] <= y === b[1] <= y) continue;
      xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const c0 = Math.max(0, Math.ceil(xs[i] / cell - 0.5));
      const c1 = Math.min(cols - 1, Math.floor(xs[i + 1] / cell - 0.5));
      for (let c = c0; c <= c1; c++) blocked[r * cols + c] = 1;
    }
  }
  // Chegara chiziqlari — ingichka shakllar ham to'siq bo'lib qolishi uchun
  for (let i = 0; i < pts.length; i++) rasterSegment(g, pts[i], pts[(i + 1) % pts.length], cell * 0.75);
}

/** obstacles: [{ type: 'poly', points: [[x,y],...] } | { type: 'wall', points, width }] — rasm piksellarida. */
export function buildGrid(width, height, obstacles = []) {
  const cell = Math.max(width, height, 1) / MAX_CELLS;
  const cols = Math.max(1, Math.ceil(width / cell));
  const rows = Math.max(1, Math.ceil(height / cell));
  const g = { width, height, cell, cols, rows, blocked: new Uint8Array(cols * rows), dist: new Uint8Array(cols * rows) };

  for (const o of obstacles) {
    if (!o?.points?.length) continue;
    if (o.type === 'wall') {
      const half = Math.max((o.width || 0) / 2, cell * 0.75);
      for (let i = 0; i + 1 < o.points.length; i++) rasterSegment(g, o.points[i], o.points[i + 1], half);
    } else if (o.points.length >= 3) {
      rasterPolygon(g, o.points);
    }
  }

  // Har bir katakdan eng yaqin to'siqgacha masofa (katakda, NEAR gacha) — yo'l devorga yopishmasligi uchun
  g.dist.fill(NEAR);
  let frontier = [];
  for (let i = 0; i < g.blocked.length; i++) {
    if (g.blocked[i]) {
      g.dist[i] = 0;
      frontier.push(i);
    }
  }
  for (let d = 1; d < NEAR && frontier.length; d++) {
    const next = [];
    for (const i of frontier) {
      const c = i % cols;
      const r = (i - c) / cols;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nc = c + dc;
          const nr = r + dr;
          if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
          const j = nr * cols + nc;
          if (g.dist[j] > d) {
            g.dist[j] = d;
            next.push(j);
          }
        }
      }
    }
    frontier = next;
  }
  return g;
}

const cellIndex = (g, x, y) => {
  const c = Math.min(g.cols - 1, Math.max(0, Math.floor(x / g.cell)));
  const r = Math.min(g.rows - 1, Math.max(0, Math.floor(y / g.cell)));
  return r * g.cols + c;
};
const cellCenter = (g, i) => {
  const c = i % g.cols;
  return [(c + 0.5) * g.cell, ((i - c) / g.cols + 0.5) * g.cell];
};

/** Nuqta to'siq ichida bo'lsa (masalan xona markazi), eng yaqin bo'sh katakni topadi. */
function nearestFree(g, start) {
  if (!g.blocked[start]) return start;
  const seen = new Uint8Array(g.blocked.length);
  let frontier = [start];
  seen[start] = 1;
  while (frontier.length) {
    const next = [];
    for (const i of frontier) {
      const c = i % g.cols;
      const r = (i - c) / g.cols;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= g.cols || nr >= g.rows) continue;
        const j = nr * g.cols + nc;
        if (seen[j]) continue;
        if (!g.blocked[j]) return j;
        seen[j] = 1;
        next.push(j);
      }
    }
    frontier = next;
  }
  return -1;
}

/** Min-heap: [kalit, tugun] juftliklari (eskirgan yozuvlar `closed` orqali o'tkazib yuboriladi). */
class Heap {
  constructor() {
    this.items = [];
  }
  push(key, node) {
    const a = this.items;
    a.push([key, node]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top[1];
  }
  get size() {
    return this.items.length;
  }
}

const WALL_PENALTY = [0, 3, 1.5, 0.6, 0.2, 0, 0];

function astar(g, start, goal) {
  const { cols, rows, blocked, dist } = g;
  const n = cols * rows;
  const gScore = new Float32Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const gc = goal % cols;
  const gr = (goal - gc) / cols;
  const h = (i) => {
    const dc = Math.abs((i % cols) - gc);
    const dr = Math.abs(Math.floor(i / cols) - gr);
    return Math.max(dc, dr) + 0.4142 * Math.min(dc, dr);
  };
  gScore[start] = 0;
  const open = new Heap();
  open.push(h(start), start);
  while (open.size) {
    const cur = open.pop();
    if (cur === goal) {
      const path = [cur];
      let p = cur;
      while (came[p] !== -1) path.push((p = came[p]));
      return path.reverse();
    }
    if (closed[cur]) continue;
    closed[cur] = 1;
    const c = cur % cols;
    const r = (cur - c) / cols;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const j = nr * cols + nc;
        if (blocked[j] || closed[j]) continue;
        // Burchakni kesib o'tmaslik: diagonal uchun ikkala qo'shni ham bo'sh bo'lishi kerak
        if (dr && dc && (blocked[r * cols + nc] || blocked[nr * cols + c])) continue;
        const step = (dr && dc ? 1.4142 : 1) * (1 + WALL_PENALTY[dist[j]]);
        const t = gScore[cur] + step;
        if (t < gScore[j]) {
          gScore[j] = t;
          came[j] = cur;
          open.push(t + h(j), j);
        }
      }
    }
  }
  return null;
}

function lineOfSight(g, a, b) {
  const [ax, ay] = cellCenter(g, a);
  const [bx, by] = cellCenter(g, b);
  const need = Math.min(2, g.dist[a], g.dist[b]);
  const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / (g.cell * 0.4));
  for (let s = 1; s < steps; s++) {
    const i = cellIndex(g, ax + ((bx - ax) * s) / steps, ay + ((by - ay) * s) / steps);
    if (g.blocked[i] || g.dist[i] < need) return false;
  }
  return true;
}

/** Zinapoyasimon katak yo'lini bir necha to'g'ri bo'lakka qisqartiradi. */
function simplify(g, cells) {
  const out = [cells[0]];
  let anchor = 0;
  while (anchor < cells.length - 1) {
    let far = anchor + 1;
    for (let j = cells.length - 1; j > anchor + 1; j--) {
      if (lineOfSight(g, cells[anchor], cells[j])) {
        far = j;
        break;
      }
    }
    out.push(cells[far]);
    anchor = far;
  }
  return out;
}

/** from/to: [x, y] rasm piksellarida. Yo'l topilmasa null qaytaradi. */
export function findPath(g, from, to) {
  const fromCell = cellIndex(g, from[0], from[1]);
  const toCell = cellIndex(g, to[0], to[1]);
  const start = nearestFree(g, fromCell);
  const goal = nearestFree(g, toCell);
  if (start < 0 || goal < 0) return null;
  const cells = start === goal ? [start] : astar(g, start, goal);
  if (!cells) return null;
  const mid = simplify(g, cells).map((i) => cellCenter(g, i));
  // Boshi va oxiri aynan berilgan nuqtalarda bo'lsin. Nuqta to'siq ichida bo'lgan bo'lsa,
  // eng yaqin bo'sh katak (eshik oldi) oraliq nuqta sifatida saqlanadi.
  if (start === fromCell) mid.shift();
  if (goal === toCell && mid.length) mid.pop();
  return [[from[0], from[1]], ...mid, [to[0], to[1]]];
}

export function pathLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  return len;
}

/**
 * Bir yoki ikki qavatli marshrut. Boshqa qavatga o'tish uchun bir xil `link_code` li
 * nuqtalar (lift/eskalator/zina) ishlatiladi.
 */
export function createRouter(floors, places) {
  const grids = new Map();
  const floorById = new Map(floors.map((f) => [f.id, f]));
  const gridOf = (floorId) => {
    if (!grids.has(floorId)) {
      const f = floorById.get(floorId);
      grids.set(floorId, f && f.width ? buildGrid(f.width, f.height, f.obstacles) : null);
    }
    return grids.get(floorId);
  };
  const leg = (floorId, a, b) => {
    const g = gridOf(floorId);
    const points = g ? findPath(g, [a.x, a.y], [b.x, b.y]) : null;
    return points ? { floorId, points, length: pathLength(points), from: a, to: b } : null;
  };

  return {
    route(from, to) {
      if (!from || !to) return null;
      if (from.floor_id === to.floor_id) {
        const l = leg(from.floor_id, from, to);
        return l ? { legs: [l], via: null } : null;
      }
      let best = null;
      const links = places.filter((p) => p.link_code && p.active !== 0);
      for (const a of links.filter((p) => p.floor_id === from.floor_id)) {
        for (const b of links.filter((p) => p.floor_id === to.floor_id && p.link_code === a.link_code)) {
          const l1 = leg(from.floor_id, from, a);
          const l2 = l1 && leg(to.floor_id, b, to);
          if (!l2) continue;
          const total = l1.length + l2.length;
          if (!best || total < best.total) best = { legs: [l1, l2], via: a, total };
        }
      }
      return best;
    },
  };
}
