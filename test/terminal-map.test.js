import test from 'node:test';
import assert from 'node:assert/strict';
import { FLOOR, PLACES, KIOSK } from '../tools/terminal-map.js';
import { buildGrid, findPath } from '../public/js/pathfinder.js';

const grid = buildGrid(FLOOR.width, FLOOR.height, FLOOR.obstacles);
const route = (to) => findPath(grid, [KIOSK.x, KIOSK.y], [to.x, to.y]);

test('terminal xaritasi: kioskdan har bir nuqtagacha yoʻl bor', () => {
  for (const p of PLACES) assert.ok(route(p), `${p.uz} ga yoʻl topilmadi`);
});

test('terminal xaritasi: nuqtalar rasm ichida va nomlari toʻliq', () => {
  for (const p of PLACES) {
    assert.ok(p.x > 0 && p.x < FLOOR.width && p.y > 0 && p.y < FLOOR.height, `${p.uz} rasm tashqarisida`);
    assert.ok(p.uz && p.ru && p.en && p.category, `${p.uz}: nom yoki kategoriya yetishmaydi`);
  }
});

test('terminal xaritasi: uchish zaliga yoʻl pasport nazorati qatoridan oʻtadi', () => {
  // Kiosk kirish zalida (y > 1505), chiqish yoʻlaklari esa nazoratdan keyin: yoʻl devorni emas, oʻtish joyini kesib oʻtishi kerak
  const gate = PLACES.find((p) => p.uz.startsWith('B3'));
  const points = route(gate);
  const crossing = points.findIndex((pt, i) => i > 0 && points[i - 1][1] > 1505 && pt[1] <= 1505);
  assert.ok(crossing > 0, 'yoʻl pasport nazorati qatorini kesib oʻtmadi');
  const [a, b] = [points[crossing - 1], points[crossing]];
  const x = a[0] + ((1505 - a[1]) / (b[1] - a[1])) * (b[0] - a[0]);
  const openings = [[1700, 1775], [1865, 1940], [2130, 2205]];
  assert.ok(openings.some(([x0, x1]) => x > x0 && x < x1), `yoʻl devor orqali oʻtdi (x = ${Math.round(x)})`);
});
