// Bilimlar bazasiga yozuvlarni JSON fayldan qo'shadi: node tools/import-kb.mjs [tools/kb-services.json]
// Shu sarlavhali yozuv bazada bo'lsa — tegilmaydi (admin panelda tahrirlangan matn ustidan yozilmaydi).
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../server/db.js';

const file = path.resolve(process.argv[2] || path.join(import.meta.dirname, 'kb-services.json'));
const items = JSON.parse(fs.readFileSync(file, 'utf8'));
const exists = db.prepare('SELECT id FROM kb WHERE title = ?');
const insert = db.prepare('INSERT INTO kb (title, content, category, active) VALUES (?, ?, ?, 1)');

let added = 0;
let skipped = 0;
for (const { title, content, category = '' } of items) {
  if (!title || !content) continue;
  if (exists.get(title)) {
    skipped++;
    continue;
  }
  insert.run(title, content, category);
  added++;
}
console.log(`Qoʻshildi: ${added}, oldin bor edi: ${skipped}, jami bazada: ${db.prepare('SELECT COUNT(*) AS n FROM kb').get().n}`);
