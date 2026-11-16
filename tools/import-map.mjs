// Terminal xaritasini (tools/terminal-map.js + tools/terminal.jpg) bazaga yozadi.
//   node tools/import-map.mjs
// Namuna qavat o'chiriladi. Xarita allaqachon kiritilgan bo'lsa — to'siqlar va nuqtalar yangilanadi,
// admin panelda belgilangan kiosk joylari esa saqlanib qoladi. Server ishlab turganda ham ishlatish mumkin.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { FLOOR, PLACES, KIOSK } from './terminal-map.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const UPLOADS = path.join(ROOT, 'data', 'uploads');
const DEMO_FLOOR = 'Namuna qavat (demo)';

const dbFile = path.join(ROOT, 'data', 'access.db');
if (!fs.existsSync(dbFile)) {
  console.error('data/access.db topilmadi — avval serverni bir marta ishga tushiring (start.bat).');
  process.exit(1);
}
const db = new DatabaseSync(dbFile);
db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

const removeImage = (file) => file && fs.rmSync(path.join(UPLOADS, path.basename(file)), { force: true });
const oldImages = [];

db.exec('BEGIN IMMEDIATE');
try {
  for (const demo of db.prepare('SELECT id, image FROM floors WHERE name = ?').all(DEMO_FLOOR)) {
    oldImages.push(demo.image);
    db.prepare('DELETE FROM floors WHERE id = ?').run(demo.id); // nuqtalari ham o'chadi (ON DELETE CASCADE)
  }

  const existing = db.prepare('SELECT id, image FROM floors WHERE name = ?').get(FLOOR.name);
  let floorId = existing?.id;
  if (!floorId) {
    floorId = Number(db.prepare('INSERT INTO floors (name, sort) VALUES (?, 0)').run(FLOOR.name).lastInsertRowid);
  }
  const image = `floor-${floorId}-${Date.now()}${path.extname(FLOOR.image)}`;
  fs.mkdirSync(UPLOADS, { recursive: true });
  fs.copyFileSync(path.join(import.meta.dirname, FLOOR.image), path.join(UPLOADS, image));
  if (existing) oldImages.push(existing.image);

  db.prepare('UPDATE floors SET image = ?, width = ?, height = ?, obstacles = ? WHERE id = ?').run(
    image, FLOOR.width, FLOOR.height, JSON.stringify(FLOOR.obstacles), floorId,
  );

  db.prepare("DELETE FROM places WHERE floor_id = ? AND category != 'kiosk'").run(floorId);
  const insert = db.prepare(
    'INSERT INTO places (floor_id, x, y, category, name_uz, name_ru, name_en, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  );
  for (const p of PLACES) insert.run(floorId, p.x, p.y, p.category, p.uz, p.ru || '', p.en || '', p.desc || '');
  const kiosks = db.prepare("SELECT COUNT(*) AS n FROM places WHERE category = 'kiosk'").get().n;
  if (!kiosks) insert.run(floorId, KIOSK.x, KIOSK.y, 'kiosk', KIOSK.name, '', '', '');

  db.exec('COMMIT');
  for (const file of oldImages) removeImage(file);
  console.log(`«${FLOOR.name}» (id ${floorId}): ${FLOOR.obstacles.length} ta toʻsiq, ${PLACES.length} ta nuqta, rasm ${image}`);
  if (!kiosks) console.log(`Kiosk joyi taxminiy qoʻyildi (${KIOSK.x}, ${KIOSK.y}) — admin panelda haqiqiy joyiga suring.`);
} catch (err) {
  db.exec('ROLLBACK');
  throw err;
}
