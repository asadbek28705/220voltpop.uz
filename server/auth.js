// Login, sessiyalar va rollar.
// Rollar: admin — hammasi; seller — kassa, savdo, kirim, tovarlarni ko'rish (kelish narxlarisiz).
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { HttpError } from './db.js'

const SESSION_DAYS = 30
const COOKIE = 'ombor_sid'

export function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 64)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

function verifyPassword(password, stored) {
  const [, saltHex, hashHex] = String(stored).split('$')
  if (!saltHex || !hashHex) return false
  const hash = scryptSync(password, Buffer.from(saltHex, 'hex'), 64)
  const expected = Buffer.from(hashHex, 'hex')
  return expected.length === hash.length && timingSafeEqual(hash, expected)
}

export const randomPassword = () => {
  // Adashtiradigan belgilarsiz (0/O, 1/l) — telefonda yozish oson
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
  return Array.from(randomBytes(10), (b) => chars[b % chars.length]).join('')
}

export class Auth {
  constructor(db) {
    this.db = db
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, login TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'seller', active INTEGER NOT NULL DEFAULT 1, createdAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY, userId TEXT NOT NULL, createdAt TEXT NOT NULL, expiresAt TEXT NOT NULL
      );
    `)
    this.failures = new Map() // ip -> { count, until }
  }

  // ---------- foydalanuvchilar ----------
  publicUser(u) { return u && { id: u.id, name: u.name, login: u.login, role: u.role, active: !!u.active } }
  list() { return this.db.prepare('SELECT * FROM users ORDER BY role, name').all().map((u) => this.publicUser(u)) }
  count() { return this.db.prepare('SELECT COUNT(*) n FROM users').get().n }

  create({ name, login, role = 'seller', password }) {
    name = String(name ?? '').trim()
    login = String(login ?? '').trim().toLowerCase()
    if (!name) throw new HttpError('Ismni kiriting')
    if (!/^[a-z0-9._-]{3,32}$/.test(login)) throw new HttpError("Login 3–32 ta lotin harf/raqamdan iborat bo'lsin")
    if (!['admin', 'seller'].includes(role)) throw new HttpError("Noto'g'ri rol")
    if (this.db.prepare('SELECT 1 FROM users WHERE login = ?').get(login)) throw new HttpError('Bu login band')
    const pass = password || randomPassword()
    if (pass.length < 6) throw new HttpError("Parol kamida 6 belgi bo'lsin")
    const u = { id: randomUUID(), name, login, password: hashPassword(pass), role, active: 1, createdAt: new Date().toISOString() }
    this.db.prepare('INSERT INTO users (id, name, login, password, role, active, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(u.id, u.name, u.login, u.password, u.role, u.active, u.createdAt)
    return { user: this.publicUser(u), password: pass }
  }

  update(id, b, actor) {
    const u = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id)
    if (!u) throw new HttpError('Foydalanuvchi topilmadi', 404)
    const name = b.name != null ? String(b.name).trim() : u.name
    const role = b.role ?? u.role
    const active = b.active != null ? (b.active ? 1 : 0) : u.active
    if (!['admin', 'seller'].includes(role)) throw new HttpError("Noto'g'ri rol")
    if (u.id === actor.id && (role !== 'admin' || !active)) throw new HttpError("O'zingizni admin rolidan chiqara olmaysiz")
    this.db.prepare('UPDATE users SET name = ?, role = ?, active = ? WHERE id = ?').run(name || u.name, role, active, id)
    if (!active) this.db.prepare('DELETE FROM sessions WHERE userId = ?').run(id)
    return this.publicUser(this.db.prepare('SELECT * FROM users WHERE id = ?').get(id))
  }

  resetPassword(id) {
    const u = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id)
    if (!u) throw new HttpError('Foydalanuvchi topilmadi', 404)
    const pass = randomPassword()
    this.db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(pass), id)
    this.db.prepare('DELETE FROM sessions WHERE userId = ?').run(id)
    return { password: pass }
  }

  changeOwnPassword(user, oldPass, newPass, keepToken) {
    const u = this.db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)
    if (!verifyPassword(String(oldPass ?? ''), u.password)) throw new HttpError("Eski parol noto'g'ri")
    if (String(newPass ?? '').length < 6) throw new HttpError("Yangi parol kamida 6 belgi bo'lsin")
    this.db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(newPass), u.id)
    // Boshqa qurilmalardagi sessiyalar yopiladi, joriysi qoladi
    this.db.prepare('DELETE FROM sessions WHERE userId = ? AND token != ?').run(u.id, keepToken)
  }

  // ---------- login ----------
  login(loginName, password, ip) {
    const f = this.failures.get(ip)
    if (f && f.until > Date.now()) throw new HttpError("Ko'p urinish. 10 daqiqadan keyin qayta urinib ko'ring", 429)
    const u = this.db.prepare('SELECT * FROM users WHERE login = ?').get(String(loginName ?? '').trim().toLowerCase())
    if (!u || !u.active || !verifyPassword(String(password ?? ''), u.password)) {
      const count = (f && f.until <= Date.now() ? 0 : f?.count ?? 0) + 1
      this.failures.set(ip, { count, until: count >= 8 ? Date.now() + 10 * 60e3 : 0 })
      throw new HttpError("Login yoki parol noto'g'ri", 401)
    }
    this.failures.delete(ip)
    const token = randomBytes(32).toString('hex')
    const now = new Date()
    this.db.prepare('INSERT INTO sessions (token, userId, createdAt, expiresAt) VALUES (?, ?, ?, ?)')
      .run(token, u.id, now.toISOString(), new Date(now.getTime() + SESSION_DAYS * 864e5).toISOString())
    this.db.prepare('DELETE FROM sessions WHERE expiresAt < ?').run(now.toISOString())
    return { token, user: this.publicUser(u) }
  }

  logout(token) { if (token) this.db.prepare('DELETE FROM sessions WHERE token = ?').run(token) }

  userByToken(token) {
    if (!token) return null
    const row = this.db.prepare(
      'SELECT u.* FROM sessions s JOIN users u ON u.id = s.userId WHERE s.token = ? AND s.expiresAt > ? AND u.active = 1',
    ).get(token, new Date().toISOString())
    return row ? this.publicUser(row) : null
  }

  // ---------- express yordamchilari ----------
  static tokenFrom(req) {
    const m = (req.headers.cookie ?? '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]{64})`))
    return m?.[1] ?? null
  }

  setCookie(req, res, token) {
    const secure = req.secure || req.get('X-Forwarded-Proto') === 'https'
    res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure ? '; Secure' : ''}`)
  }

  clearCookie(res) { res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`) }
}
