import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DEFAULT_CATEGORIES, DEFAULT_EXPENSE_CATEGORIES, seedData } from './seed.js'

export function openDb(file) {
  mkdirSync(dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, sku TEXT NOT NULL DEFAULT '', barcode TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '', unit TEXT NOT NULL DEFAULT 'dona',
      buyPrice REAL NOT NULL DEFAULT 0, sellPrice REAL NOT NULL DEFAULT 0, qty REAL NOT NULL DEFAULT 0,
      minQty REAL NOT NULL DEFAULT 0, location TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS movements (
      id TEXT PRIMARY KEY, productId TEXT NOT NULL, productName TEXT NOT NULL, type TEXT NOT NULL,
      qty REAL NOT NULL, price REAL NOT NULL DEFAULT 0, cost REAL, counterparty TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '', date TEXT NOT NULL, saleId TEXT, payment TEXT, seller TEXT, rev INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS movements_rev ON movements(rev);
    CREATE INDEX IF NOT EXISTS movements_sale ON movements(saleId);
    CREATE TABLE IF NOT EXISTS deleted_movements (id TEXT PRIMARY KEY, rev INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS categories (name TEXT PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY, date TEXT NOT NULL, category TEXT NOT NULL, amount REAL NOT NULL,
      note TEXT NOT NULL DEFAULT '', payment TEXT NOT NULL DEFAULT 'naqd', seller TEXT, createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS expenses_date ON expenses(date);
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `)
  // Migratsiya: kirim nakladnoylarini guruhlash uchun
  const cols = db.prepare('PRAGMA table_info(movements)').all().map((c) => c.name)
  if (!cols.includes('batchId')) db.exec('ALTER TABLE movements ADD COLUMN batchId TEXT')
  return new Store(db)
}

const PRODUCT_COLS = ['id', 'name', 'sku', 'barcode', 'category', 'unit', 'buyPrice', 'sellPrice', 'qty', 'minQty', 'location', 'createdAt']
const MOVE_COLS = ['id', 'productId', 'productName', 'type', 'qty', 'price', 'cost', 'counterparty', 'note', 'date', 'saleId', 'payment', 'seller', 'batchId', 'rev']

export class HttpError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const str = (v) => (v == null ? '' : String(v)).trim()
const round = (n) => Math.round(n * 1000) / 1000

class Store {
  constructor(db) {
    this.db = db
    if (!this.getMeta('epoch')) {
      this.tx(() => {
        this.setMeta('epoch', randomUUID())
        this.setMeta('version', '0')
        this.setMeta('settings', JSON.stringify({ shopName: "Qurilish va santexnika do'koni", address: '', phone: '', receiptFooter: 'Xaridingiz uchun rahmat!' }))
        this.loadData(seedData())
      })
    }
  }

  // ---------- yordamchilar ----------
  getMeta(key) { return this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key)?.value }
  setMeta(key, value) { this.db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value)) }
  get version() { return Number(this.getMeta('version') ?? 0) }
  get epoch() { return this.getMeta('epoch') }
  bump() { const v = this.version + 1; this.setMeta('version', v); return v }

  tx(fn) {
    this.db.exec('BEGIN IMMEDIATE')
    try { const r = fn(); this.db.exec('COMMIT'); return r } catch (e) { this.db.exec('ROLLBACK'); throw e }
  }

  insertProduct(p) {
    this.db.prepare(`INSERT INTO products (${PRODUCT_COLS}) VALUES (${PRODUCT_COLS.map(() => '?')})`).run(...PRODUCT_COLS.map((c) => p[c] ?? null))
  }
  insertMovement(m) {
    this.db.prepare(`INSERT INTO movements (${MOVE_COLS}) VALUES (${MOVE_COLS.map(() => '?')})`).run(...MOVE_COLS.map((c) => m[c] ?? null))
  }
  product(id) {
    const p = this.db.prepare('SELECT * FROM products WHERE id = ?').get(id)
    if (!p) throw new HttpError('Tovar topilmadi', 404)
    return { ...p }
  }
  ensureCategory(name) { if (name) this.db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)').run(name) }

  loadData({ products = [], movements = [], categories = [], expenses = [], receiptNo = 0 }) {
    this.db.exec('DELETE FROM products; DELETE FROM movements; DELETE FROM deleted_movements; DELETE FROM categories; DELETE FROM expenses;')
    for (const e of expenses) this.insertExpense({ note: '', payment: 'naqd', seller: null, createdAt: e.date, ...e })
    const v = this.bump()
    for (const c of categories.length ? categories : DEFAULT_CATEGORIES) this.ensureCategory(c)
    for (const p of products) {
      this.insertProduct({ ...p, sku: str(p.sku), barcode: str(p.barcode), location: str(p.location), createdAt: p.createdAt ?? new Date().toISOString() })
      this.ensureCategory(p.category)
    }
    for (const m of movements) this.insertMovement({ cost: null, saleId: null, payment: null, seller: null, ...m, rev: v })
    this.setMeta('receiptNo', receiptNo)
    this.setMeta('epoch', randomUUID())
  }

  // ---------- o'qish ----------
  data(since, epoch) {
    const full = !since || epoch !== this.epoch
    const products = this.db.prepare('SELECT * FROM products ORDER BY name').all().map((r) => ({ ...r }))
    const categories = this.db.prepare('SELECT name FROM categories ORDER BY rowid').all().map((r) => r.name)
    const movements = (full
      ? this.db.prepare('SELECT * FROM movements ORDER BY date DESC').all()
      : this.db.prepare('SELECT * FROM movements WHERE rev > ? ORDER BY date DESC').all(since)
    ).map(({ rev: _r, ...m }) => m)
    const deleted = full ? [] : this.db.prepare('SELECT id FROM deleted_movements WHERE rev > ?').all(since).map((r) => r.id)
    const expenses = this.db.prepare('SELECT * FROM expenses ORDER BY date DESC').all().map((r) => ({ ...r }))
    return { full, epoch: this.epoch, version: this.version, products, categories, movements, deleted, expenses, settings: this.settings() }
  }

  settings() { return JSON.parse(this.getMeta('settings') ?? '{}') }

  // ---------- yozish ----------
  saveSettings(s) {
    return this.tx(() => {
      const next = { ...this.settings() }
      for (const k of ['shopName', 'address', 'phone', 'receiptFooter']) if (k in s) next[k] = str(s[k])
      this.setMeta('settings', JSON.stringify(next))
      this.bump()
      return next
    })
  }

  checkUnique(p, id) {
    if (p.barcode) {
      const d = this.db.prepare('SELECT name FROM products WHERE barcode = ? AND id != ?').get(p.barcode, id ?? '')
      if (d) throw new HttpError(`Bu shtrix-kod "${d.name}" tovarida ishlatilgan`)
    }
    if (p.sku) {
      const d = this.db.prepare('SELECT name FROM products WHERE lower(sku) = lower(?) AND id != ?').get(p.sku, id ?? '')
      if (d) throw new HttpError(`Bu artikul "${d.name}" tovarida ishlatilgan`)
    }
  }

  cleanProduct(b) {
    const p = {
      name: str(b.name), sku: str(b.sku), barcode: str(b.barcode), category: str(b.category), unit: str(b.unit) || 'dona',
      buyPrice: num(b.buyPrice), sellPrice: num(b.sellPrice), minQty: num(b.minQty), location: str(b.location),
    }
    if (!p.name) throw new HttpError('Tovar nomini kiriting')
    if (!p.category) throw new HttpError('Kategoriyani tanlang')
    return p
  }

  createProduct(b, seller) {
    return this.tx(() => {
      const p = this.cleanProduct(b)
      this.checkUnique(p)
      const created = { ...p, id: randomUUID(), qty: Math.max(0, num(b.qty)), createdAt: new Date().toISOString() }
      this.insertProduct(created)
      this.ensureCategory(p.category)
      const v = this.bump()
      if (created.qty > 0) {
        this.insertMovement({ id: randomUUID(), productId: created.id, productName: created.name, type: 'in', qty: created.qty,
          price: created.buyPrice, counterparty: '', note: "Boshlang'ich qoldiq", date: new Date().toISOString(), seller, rev: v })
      }
      return created
    })
  }

  updateProduct(id, b) {
    return this.tx(() => {
      this.product(id)
      const p = this.cleanProduct(b)
      this.checkUnique(p, id)
      this.db.prepare(`UPDATE products SET name=?, sku=?, barcode=?, category=?, unit=?, buyPrice=?, sellPrice=?, minQty=?, location=? WHERE id=?`)
        .run(p.name, p.sku, p.barcode, p.category, p.unit, p.buyPrice, p.sellPrice, p.minQty, p.location, id)
      this.ensureCategory(p.category)
      this.bump()
      return this.product(id)
    })
  }

  deleteProduct(id) {
    return this.tx(() => {
      this.db.prepare('DELETE FROM products WHERE id = ?').run(id)
      this.bump()
    })
  }

  addCategory(name) {
    return this.tx(() => { this.ensureCategory(str(name)); this.bump() })
  }

  /** Kirim / chiqim / inventarizatsiya (bitta tovar) */
  addMovement(b, seller) {
    return this.tx(() => {
      const prod = this.product(b.productId)
      const type = b.type
      if (!['in', 'out', 'adjust'].includes(type)) throw new HttpError("Noto'g'ri harakat turi")
      const qty = num(b.qty)
      if (type !== 'adjust' && !(qty > 0)) throw new HttpError("Miqdor 0 dan katta bo'lishi kerak")
      if (type === 'adjust' && qty === 0) throw new HttpError("Qoldiq o'zgarmadi")
      const delta = type === 'out' ? -qty : qty
      if (prod.qty + delta < -1e-9) throw new HttpError(`Omborda faqat ${prod.qty} ${prod.unit} bor`)
      const price = num(b.price)
      const v = this.bump()
      let saleId = null
      if (type === 'out') saleId = this.nextReceipt()
      this.db.prepare('UPDATE products SET qty = ? WHERE id = ?').run(round(prod.qty + delta), prod.id)
      if (type === 'in' && price > 0) this.db.prepare('UPDATE products SET buyPrice = ? WHERE id = ?').run(price, prod.id)
      const m = {
        id: randomUUID(), productId: prod.id, productName: prod.name, type, qty, price: type === 'adjust' ? 0 : price,
        cost: type === 'out' ? prod.buyPrice : null, counterparty: str(b.counterparty), note: str(b.note),
        date: new Date().toISOString(), saleId, payment: type === 'out' ? str(b.payment) || 'naqd' : null, seller, rev: v,
      }
      this.insertMovement(m)
      return { movement: m, saleId }
    })
  }

  nextReceipt() {
    const n = Number(this.getMeta('receiptNo') ?? 0) + 1
    this.setMeta('receiptNo', n)
    return String(n)
  }

  /** Savatdagi bir nechta tovarni bitta chek bilan sotish. Hammasi yoki hech biri. */
  sell(b, seller) {
    return this.tx(() => {
      const items = Array.isArray(b.items) ? b.items : []
      if (items.length === 0) throw new HttpError("Savat bo'sh")
      // Bir tovar savatda ikki marta bo'lsa ham to'g'ri tekshirish uchun yig'amiz
      const need = new Map()
      for (const it of items) {
        const q = num(it.qty)
        if (!(q > 0)) throw new HttpError("Miqdor 0 dan katta bo'lishi kerak")
        need.set(it.productId, (need.get(it.productId) ?? 0) + q)
      }
      const prods = new Map()
      for (const [pid, q] of need) {
        const p = this.product(pid)
        if (q > p.qty + 1e-9) throw new HttpError(`"${p.name}" omborda yetarli emas: ${p.qty} ${p.unit} bor`)
        prods.set(pid, p)
      }
      const v = this.bump()
      const saleId = this.nextReceipt()
      const date = new Date().toISOString()
      const payment = str(b.payment) || 'naqd'
      for (const it of items) {
        const p = prods.get(it.productId)
        this.insertMovement({
          id: randomUUID(), productId: p.id, productName: p.name, type: 'out', qty: num(it.qty), price: num(it.price),
          cost: p.buyPrice, counterparty: str(b.counterparty), note: str(b.note), date, saleId, payment, seller, rev: v,
        })
      }
      for (const [pid, q] of need) {
        const p = prods.get(pid)
        this.db.prepare('UPDATE products SET qty = ? WHERE id = ?').run(round(p.qty - q), pid)
      }
      return { saleId }
    })
  }

  // ---------- xarajatlar ----------
  insertExpense(e) {
    const cols = ['id', 'date', 'category', 'amount', 'note', 'payment', 'seller', 'createdAt']
    this.db.prepare(`INSERT INTO expenses (${cols}) VALUES (${cols.map(() => '?')})`).run(...cols.map((c) => e[c] ?? null))
  }

  addExpense(b, seller) {
    return this.tx(() => {
      const amount = num(b.amount)
      if (!(amount > 0)) throw new HttpError("Summa 0 dan katta bo'lishi kerak")
      const category = str(b.category)
      if (!category) throw new HttpError('Xarajat turini tanlang')
      let date = new Date()
      if (b.date) {
        const d = new Date(b.date)
        if (isNaN(d)) throw new HttpError("Sana noto'g'ri")
        date = d
      }
      const e = {
        id: randomUUID(), date: date.toISOString(), category, amount, note: str(b.note),
        payment: str(b.payment) || 'naqd', seller, createdAt: new Date().toISOString(),
      }
      this.insertExpense(e)
      this.bump()
      return e
    })
  }

  deleteExpense(id) {
    return this.tx(() => {
      const e = this.db.prepare('SELECT * FROM expenses WHERE id = ?').get(id)
      if (!e) throw new HttpError('Xarajat topilmadi', 404)
      this.db.prepare('DELETE FROM expenses WHERE id = ?').run(id)
      this.bump()
      return { ...e }
    })
  }

  /** Skaner bilan qabul: bir nechta tovarni bitta nakladnoy bilan omborga kiritish */
  receive(b, seller) {
    return this.tx(() => {
      const items = Array.isArray(b.items) ? b.items : []
      if (items.length === 0) throw new HttpError("Ro'yxat bo'sh")
      for (const it of items) if (!(num(it.qty) > 0)) throw new HttpError("Miqdor 0 dan katta bo'lishi kerak")
      const v = this.bump()
      const n = Number(this.getMeta('batchNo') ?? 0) + 1
      this.setMeta('batchNo', n)
      const batchId = String(n)
      const date = new Date().toISOString()
      for (const it of items) {
        const p = this.product(it.productId)
        const qty = num(it.qty)
        const price = num(it.price)
        this.db.prepare('UPDATE products SET qty = ? WHERE id = ?').run(round(p.qty + qty), p.id)
        if (price > 0) this.db.prepare('UPDATE products SET buyPrice = ? WHERE id = ?').run(price, p.id)
        const sell = num(it.sellPrice)
        if (sell > 0) this.db.prepare('UPDATE products SET sellPrice = ? WHERE id = ?').run(sell, p.id)
        this.insertMovement({
          id: randomUUID(), productId: p.id, productName: p.name, type: 'in', qty, price,
          counterparty: str(b.counterparty), note: str(b.note), date, seller, batchId, rev: v,
        })
      }
      return { batchId }
    })
  }

  deleteMovement(id) {
    return this.tx(() => {
      const m = this.db.prepare('SELECT * FROM movements WHERE id = ?').get(id)
      if (!m) throw new HttpError('Yozuv topilmadi', 404)
      const delta = m.type === 'out' ? m.qty : -m.qty
      const p = this.db.prepare('SELECT qty FROM products WHERE id = ?').get(m.productId)
      if (p) this.db.prepare('UPDATE products SET qty = ? WHERE id = ?').run(Math.max(0, round(p.qty + delta)), m.productId)
      const v = this.bump()
      this.db.prepare('DELETE FROM movements WHERE id = ?').run(id)
      this.db.prepare('INSERT OR REPLACE INTO deleted_movements (id, rev) VALUES (?, ?)').run(id, v)
      return { ...m }
    })
  }

  importAll(d) {
    if (!Array.isArray(d?.products) || !Array.isArray(d?.movements)) throw new HttpError("Fayl noto'g'ri")
    return this.tx(() => {
      const receiptNo = Math.max(0, ...d.movements.map((m) => Number(m.saleId) || 0))
      this.loadData({ ...d, expenses: Array.isArray(d.expenses) ? d.expenses : [], receiptNo })
      if (d.settings) this.setMeta('settings', JSON.stringify(d.settings))
    })
  }
  reset() { return this.tx(() => this.loadData(seedData())) }
  clear() { return this.tx(() => this.loadData({ products: [], movements: [], categories: DEFAULT_CATEGORIES })) }
}
