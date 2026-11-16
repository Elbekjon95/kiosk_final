import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGrid, findPath, pathLength, createRouter } from '../public/js/pathfinder.js';

/** Yo'lning har bir bo'lagi bo'ylab zich nuqtalar olib, to'siq katagiga tushmaganini tekshiradi. */
function crossesObstacle(g, points) {
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / (g.cell * 0.25));
    for (let s = 0; s <= steps; s++) {
      const x = ax + ((bx - ax) * s) / steps;
      const y = ay + ((by - ay) * s) / steps;
      const c = Math.min(g.cols - 1, Math.floor(x / g.cell));
      const r = Math.min(g.rows - 1, Math.floor(y / g.cell));
      if (g.blocked[r * g.cols + c]) return true;
    }
  }
  return false;
}

test('toʻsiq boʻlmasa yoʻl toʻgʻri chiziq', () => {
  const g = buildGrid(1000, 600, []);
  const p = findPath(g, [50, 50], [900, 500]);
  assert.equal(p.length, 2);
  assert.deepEqual(p[0], [50, 50]);
  assert.deepEqual(p[1], [900, 500]);
});

test('devor ustidan oʻtmaydi, eshikdan aylanib oʻtadi', () => {
  // Xaritani ikkiga boʻluvchi devor, eshik faqat pastda (y 520..600)
  const wall = { type: 'wall', points: [[500, 0], [500, 520]], width: 12 };
  const g = buildGrid(1000, 600, [wall]);
  const p = findPath(g, [100, 100], [900, 100]);
  assert.ok(p, 'yoʻl topilishi kerak');
  assert.equal(crossesObstacle(g, p), false);
  assert.ok(Math.max(...p.map((q) => q[1])) > 520, 'yoʻl eshik orqali oʻtishi kerak');
  assert.ok(pathLength(p) > 1100, 'aylanma yoʻl toʻgʻri chiziqdan (800) ancha uzun');
});

test('xona (koʻpburchak) atrofidan aylanadi', () => {
  const room = { type: 'poly', points: [[400, 150], [600, 150], [600, 450], [400, 450]] };
  const g = buildGrid(1000, 600, [room]);
  const p = findPath(g, [100, 300], [900, 300]);
  assert.ok(p);
  assert.equal(crossesObstacle(g, p), false);
  assert.ok(p.length >= 3);
});

test('toʻliq yopiq joyga yoʻl yoʻq', () => {
  const box = { type: 'wall', points: [[700, 100], [900, 100], [900, 300], [700, 300], [700, 100]], width: 10 };
  const g = buildGrid(1000, 600, [box]);
  assert.equal(findPath(g, [100, 300], [800, 200]), null);
});

test('xona ichidagi nuqta eng yaqin boʻsh joyga bogʻlanadi', () => {
  const room = { type: 'poly', points: [[400, 150], [600, 150], [600, 450], [400, 450]] };
  const g = buildGrid(1000, 600, [room]);
  const p = findPath(g, [100, 300], [450, 300]);
  assert.ok(p);
  assert.deepEqual(p.at(-1), [450, 300]);
  // Oxirgi boʻlakdan tashqari hech qaysi boʻlak xonani kesmaydi
  assert.equal(crossesObstacle(g, p.slice(0, -1)), false);
});

test('ikki qavat: bir xil link_code li lift orqali', () => {
  const floors = [
    { id: 1, width: 1000, height: 600, obstacles: [] },
    { id: 2, width: 1000, height: 600, obstacles: [] },
  ];
  const places = [
    { id: 1, floor_id: 1, x: 100, y: 100, category: 'kiosk', link_code: '' },
    { id: 2, floor_id: 1, x: 500, y: 300, category: 'lift', link_code: 'L1' },
    { id: 3, floor_id: 2, x: 500, y: 300, category: 'lift', link_code: 'L1' },
    { id: 4, floor_id: 2, x: 900, y: 500, category: 'cafe', link_code: '' },
  ];
  const r = createRouter(floors, places).route(places[0], places[3]);
  assert.equal(r.legs.length, 2);
  assert.equal(r.legs[0].floorId, 1);
  assert.equal(r.legs[1].floorId, 2);
  assert.equal(r.via.id, 2);
});
