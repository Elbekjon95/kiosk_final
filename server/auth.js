// Admin panel uchun parol + sessiya cookie.
import crypto from 'node:crypto';
import { env } from './config.js';
import { db } from './db.js';

const COOKIE = 'access_admin';
const TTL_MS = 12 * 3600_000;
const sha = (s) => crypto.createHash('sha256').update(s).digest();

export function checkPassword(password) {
  if (!env.ADMIN_PASSWORD) return false;
  return crypto.timingSafeEqual(sha(String(password || '')), sha(env.ADMIN_PASSWORD));
}

function readToken(req) {
  const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([A-Za-z0-9_-]+)`));
  return m ? m[1] : null;
}

export function createSession(res) {
  const token = crypto.randomBytes(32).toString('base64url');
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  db.prepare('INSERT INTO sessions (token_hash, expires_at) VALUES (?, ?)').run(sha(token).toString('hex'), Date.now() + TTL_MS);
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${TTL_MS / 1000}`);
}

export function destroySession(req, res) {
  const token = readToken(req);
  if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha(token).toString('hex'));
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
}

export function isAdmin(req) {
  const token = readToken(req);
  if (!token) return false;
  const row = db.prepare('SELECT expires_at FROM sessions WHERE token_hash = ?').get(sha(token).toString('hex'));
  return Boolean(row && row.expires_at > Date.now());
}

export function requireAdmin(req, res, next) {
  if (isAdmin(req)) return next();
  res.status(401).json({ error: 'Avtorizatsiya talab qilinadi' });
}

/** Oddiy xotiradagi cheklovchi: har bir IP uchun `max` so'rov / `windowMs`. */
export function rateLimit({ max, windowMs }) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [ip, h] of hits) if (h.reset < now) hits.delete(ip);
  }, windowMs).unref();
  return (req, res, next) => {
    const ip = req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let h = hits.get(ip);
    if (!h || h.reset < now) {
      h = { count: 0, reset: now + windowMs };
      hits.set(ip, h);
    }
    if (++h.count > max) return res.status(429).json({ error: 'Juda koʻp soʻrov. Birozdan soʻng urinib koʻring.' });
    next();
  };
}
