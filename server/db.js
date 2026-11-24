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
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL
    );
    -- Mijoz hisobidagi qo'lda yozuvlar: 'pay' — qarz to'lovi, 'debt' — eski/qo'shimcha qarz.
    -- Nasiya savdolar movements jadvalidan hisoblanadi (savdo bekor qilinsa qarz ham kamayadi).
    CREATE TABLE IF NOT EXISTS customer_tx (
      id TEXT PRIMARY KEY, customerId TEXT NOT NULL, type TEXT NOT NULL, amount REAL NOT NULL, payment TEXT,
      note TEXT NOT NULL DEFAULT '', saleId TEXT, date TEXT NOT NULL, seller TEXT, createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS customer_tx_c ON customer_tx(customerId);
  `)
  // Migratsiya: kirim nakladnoylarini guruhlash uchun
  const cols = db.prepare('PRAGMA table_info(movements)').all().map((c) => c.name)
  if (!cols.includes('batchId')) db.exec('ALTER TABLE movements ADD COLUMN batchId TEXT')
  if (!cols.includes('customerId')) db.exec('ALTER TABLE movements ADD COLUMN customerId TEXT')
  db.exec('CREATE INDEX IF NOT EXISTS movements_customer ON movements(customerId)')
  if (!cols.includes('priceUsd')) db.exec('ALTER TABLE movements ADD COLUMN priceUsd REAL; ALTER TABLE movements ADD COLUMN rate REAL;')
  // Migratsiya: dollarda sotib olinadigan tovarlar
  const pcols = db.prepare('PRAGMA table_info(products)').all().map((c) => c.name)
  if (!pcols.includes('currency')) db.exec(`
    ALTER TABLE products ADD COLUMN currency TEXT NOT NULL DEFAULT 'UZS';
    ALTER TABLE products ADD COLUMN buyPriceUsd REAL NOT NULL DEFAULT 0;
    ALTER TABLE products ADD COLUMN markup REAL NOT NULL DEFAULT 0;
  `)
  return new Store(db)
}

const PRODUCT_COLS = ['id', 'name', 'sku', 'barcode', 'category', 'unit', 'buyPrice', 'sellPrice', 'qty', 'minQty', 'location', 'createdAt', 'currency', 'buyPriceUsd', 'markup']
const MOVE_COLS = ['id', 'productId', 'productName', 'type', 'qty', 'price', 'cost', 'counterparty', 'note', 'date', 'saleId', 'payment', 'seller', 'batchId', 'priceUsd', 'rate', 'customerId', 'rev']

export class HttpError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const str = (v) => (v == null ? '' : String(v)).trim()
const round = (n) => Math.round(n * 1000) / 1000
const roundUsd = (n) => Math.round(n * 10000) / 10000
/** Sotuv narxi: 100 so'mga yuqoriga yaxlitlanadi */
export const sellFrom = (costUzs, markup) => Math.ceil((costUzs * (1 + markup / 100)) / 100) * 100

class Store {
  constructor(db) {
    this.db = db
    if (!this.getMeta('epoch')) {
      this.tx(() => {
        this.setMeta('epoch', randomUUID())
        this.setMeta('version', '0')
        this.setMeta('settings', JSON.stringify({ shopName: "Qurilish va santexnika do'koni", address: '', phone: '', receiptFooter: 'Xaridingiz uchun rahmat!' }))
        // NO_SEED=1 — haqiqiy ish uchun bo'sh baza (namuna ma'lumotlarsiz)
        this.loadData(process.env.NO_SEED === '1' ? { products: [], movements: [], categories: DEFAULT_CATEGORIES } : seedData())
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

  loadData({ products = [], movements = [], categories = [], expenses = [], customers = [], customerTx = [], receiptNo = 0 }) {
    this.db.exec('DELETE FROM products; DELETE FROM movements; DELETE FROM deleted_movements; DELETE FROM categories; DELETE FROM expenses; DELETE FROM customers; DELETE FROM customer_tx;')
    for (const c of customers) this.db.prepare('INSERT INTO customers (id, name, phone, note, createdAt) VALUES (?, ?, ?, ?, ?)')
      .run(c.id, str(c.name), str(c.phone), str(c.note), c.createdAt ?? new Date().toISOString())
    for (const t of customerTx) this.insertTx(t)
    for (const e of expenses) this.insertExpense({ note: '', payment: 'naqd', seller: null, createdAt: e.date, ...e })
    const v = this.bump()
    for (const c of categories.length ? categories : DEFAULT_CATEGORIES) this.ensureCategory(c)
    for (const p of products) {
      this.insertProduct({ currency: 'UZS', buyPriceUsd: 0, markup: 0, ...p, sku: str(p.sku), barcode: str(p.barcode), location: str(p.location), createdAt: p.createdAt ?? new Date().toISOString() })
      this.ensureCategory(p.category)
    }
    for (const m of movements) this.insertMovement({ cost: null, saleId: null, payment: null, seller: null, customerId: null, ...m, rev: v })
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
    return {
      full, epoch: this.epoch, version: this.version, products, categories, movements, deleted, expenses, settings: this.settings(),
      customers: this.customers(), customerTx: this.db.prepare('SELECT * FROM customer_tx ORDER BY date DESC').all().map((r) => ({ ...r })),
    }
  }

  /** Mijozlar: qarz = nasiya savdolar + qo'lda qarzlar − to'lovlar */
  customers() {
    return this.db.prepare(`
      SELECT c.*,
        COALESCE((SELECT SUM(CASE type WHEN 'out' THEN qty * price ELSE -qty * price END) FROM movements WHERE customerId = c.id AND type IN ('out', 'return')), 0) AS bought,
        COALESCE((SELECT SUM(CASE type WHEN 'out' THEN qty * price ELSE -qty * price END) FROM movements WHERE customerId = c.id AND type IN ('out', 'return') AND payment = 'nasiya'), 0) AS nasiya,
        COALESCE((SELECT SUM(amount) FROM customer_tx WHERE customerId = c.id AND type = 'debt'), 0) AS extraDebt,
        COALESCE((SELECT SUM(amount) FROM customer_tx WHERE customerId = c.id AND type = 'pay'), 0) AS paid,
        (SELECT COUNT(DISTINCT saleId) FROM movements WHERE customerId = c.id AND type = 'out') AS receipts,
        (SELECT MAX(date) FROM movements WHERE customerId = c.id AND type = 'out') AS lastDate
      FROM customers c ORDER BY c.name COLLATE NOCASE
    `).all().map(({ nasiya, extraDebt, paid, ...c }) => ({ ...c, debt: Math.round(nasiya + extraDebt - paid), paid }))
  }
  customer(id) {
    const c = this.customers().find((x) => x.id === id)
    if (!c) throw new HttpError('Mijoz topilmadi', 404)
    return c
  }

  // ---------- mijozlar ----------
  cleanCustomer(b) {
    const c = { name: str(b.name), phone: str(b.phone), note: str(b.note) }
    if (!c.name) throw new HttpError('Mijoz ismini kiriting')
    return c
  }
  createCustomer(b) {
    return this.tx(() => {
      const c = { ...this.cleanCustomer(b), id: randomUUID(), createdAt: new Date().toISOString() }
      if (c.phone && this.db.prepare('SELECT 1 FROM customers WHERE phone = ?').get(c.phone)) throw new HttpError('Bu telefon raqamli mijoz bor')
      this.db.prepare('INSERT INTO customers (id, name, phone, note, createdAt) VALUES (?, ?, ?, ?, ?)').run(c.id, c.name, c.phone, c.note, c.createdAt)
      this.bump()
      return this.customer(c.id)
    })
  }
  updateCustomer(id, b) {
    return this.tx(() => {
      this.customer(id)
      const c = this.cleanCustomer(b)
      this.db.prepare('UPDATE customers SET name = ?, phone = ?, note = ? WHERE id = ?').run(c.name, c.phone, c.note, id)
      this.bump()
      return this.customer(id)
    })
  }
  deleteCustomer(id) {
    return this.tx(() => {
      const c = this.customer(id)
      if (Math.abs(c.debt) > 0) throw new HttpError(`Mijozda ${c.debt} so'm qarz bor — avval qarzni yoping`)
      this.db.prepare('DELETE FROM customers WHERE id = ?').run(id)
      this.db.prepare('DELETE FROM customer_tx WHERE customerId = ?').run(id)
      this.bump()
    })
  }
  insertTx(t) {
    const cols = ['id', 'customerId', 'type', 'amount', 'payment', 'note', 'saleId', 'date', 'seller', 'createdAt']
    this.db.prepare(`INSERT INTO customer_tx (${cols}) VALUES (${cols.map(() => '?')})`).run(...cols.map((c) => t[c] ?? null))
  }
  /** Qarz to'lovi ('pay') yoki qo'lda qarz ('debt') */
  addCustomerTx(customerId, b, seller) {
    return this.tx(() => {
      const c = this.customer(customerId)
      const type = b.type === 'debt' ? 'debt' : 'pay'
      const amount = Math.round(num(b.amount))
      if (!(amount > 0)) throw new HttpError("Summa 0 dan katta bo'lishi kerak")
      const t = {
        id: randomUUID(), customerId, type, amount, payment: type === 'pay' ? str(b.payment) || 'naqd' : null, note: str(b.note),
        saleId: b.saleId ?? null, date: new Date().toISOString(), seller, createdAt: new Date().toISOString(),
      }
      this.insertTx(t)
      this.bump()
      return { tx: t, customer: { ...c, debt: c.debt + (type === 'debt' ? amount : -amount) } }
    })
  }
  deleteCustomerTx(id) {
    return this.tx(() => {
      const t = this.db.prepare('SELECT * FROM customer_tx WHERE id = ?').get(id)
      if (!t) throw new HttpError('Yozuv topilmadi', 404)
      this.db.prepare('DELETE FROM customer_tx WHERE id = ?').run(id)
      this.bump()
      return { ...t }
    })
  }

  settings() { return { usdRate: 0, rateDate: '', ...JSON.parse(this.getMeta('settings') ?? '{}') } }
  get rate() { return num(this.settings().usdRate) }
  needRate() {
    const r = this.rate
    if (!(r > 0)) throw new HttpError("Avval dollar kursini kiriting (Tovarlar → Dollar kursi)")
    return r
  }

  /** Joriy hisob davri boshlanishi: oxirgi yopilgan davr tugagan payt */
  periodStart() {
    const ps = this.settings().periods ?? []
    return ps.length ? ps[ps.length - 1].to : null
  }

  closePeriod(b, by) {
    return this.tx(() => {
      const s = this.settings()
      const periods = s.periods ?? []
      const now = new Date()
      // Birinchi yopishda boshlanish sanasi brauzerdan keladi (joriy chorak boshi)
      let from = this.periodStart()
      if (!from) {
        const d = new Date(b.from)
        from = isNaN(d) || d > now ? new Date(0).toISOString() : d.toISOString()
      }
      const p = { from, to: now.toISOString(), closedBy: by ?? '', note: str(b.note) }
      this.setMeta('settings', JSON.stringify({ ...s, periods: [...periods, p] }))
      this.bump()
      return p
    })
  }

  /** Dollar kursini o'zgartirish: $ tovarlarning tannarxi qayta hisoblanadi, xohlansa sotuv narxi ham */
  setRate(b) {
    return this.tx(() => {
      const rate = num(b.rate)
      if (!(rate >= 1000 && rate <= 100000)) throw new HttpError("Kurs noto'g'ri (masalan: 12650)")
      const next = { ...this.settings(), usdRate: rate, rateDate: new Date().toISOString() }
      this.setMeta('settings', JSON.stringify(next))
      const usd = this.db.prepare("SELECT * FROM products WHERE currency = 'USD' AND buyPriceUsd > 0").all()
      let repriced = 0
      for (const p of usd) {
        const cost = Math.round(p.buyPriceUsd * rate)
        let sell = p.sellPrice
        if (b.updateSellPrices && p.markup > 0) { sell = sellFrom(cost, p.markup); repriced++ }
        this.db.prepare('UPDATE products SET buyPrice = ?, sellPrice = ? WHERE id = ?').run(cost, sell, p.id)
      }
      this.bump()
      return { rate, products: usd.length, repriced }
    })
  }

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
      currency: b.currency === 'USD' ? 'USD' : 'UZS', buyPriceUsd: 0, markup: Math.max(0, num(b.markup)),
    }
    if (!p.name) throw new HttpError('Tovar nomini kiriting')
    if (!p.category) throw new HttpError('Kategoriyani tanlang')
    if (p.currency === 'USD') {
      p.buyPriceUsd = roundUsd(Math.max(0, num(b.buyPriceUsd)))
      if (p.buyPriceUsd > 0) p.buyPrice = Math.round(p.buyPriceUsd * this.needRate())
      if (p.markup > 0 && !(p.sellPrice > 0) && p.buyPrice > 0) p.sellPrice = sellFrom(p.buyPrice, p.markup)
    }
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
        const usd = created.currency === 'USD'
        this.insertMovement({ id: randomUUID(), productId: created.id, productName: created.name, type: 'in', qty: created.qty,
          price: created.buyPrice, counterparty: '', note: "Boshlang'ich qoldiq", date: new Date().toISOString(), seller,
          priceUsd: usd ? created.buyPriceUsd : null, rate: usd ? this.rate : null, rev: v })
      }
      return created
    })
  }

  updateProduct(id, b) {
    return this.tx(() => {
      this.product(id)
      const p = this.cleanProduct(b)
      this.checkUnique(p, id)
      this.db.prepare(`UPDATE products SET name=?, sku=?, barcode=?, category=?, unit=?, buyPrice=?, sellPrice=?, minQty=?, location=?, currency=?, buyPriceUsd=?, markup=? WHERE id=?`)
        .run(p.name, p.sku, p.barcode, p.category, p.unit, p.buyPrice, p.sellPrice, p.minQty, p.location, p.currency, p.buyPriceUsd, p.markup, id)
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
      let price = num(b.price)
      let usd = null
      if (type === 'in') {
        usd = this.inPrice(prod, b)
        price = usd ? usd.price : price > 0 ? price : prod.buyPrice
      }
      const v = this.bump()
      let saleId = null
      if (type === 'out') saleId = this.nextReceipt()
      this.db.prepare('UPDATE products SET qty = ? WHERE id = ?').run(round(prod.qty + delta), prod.id)
      if (type === 'in') this.applyInPrice(prod, price, usd, b.sellPrice)
      const m = {
        id: randomUUID(), productId: prod.id, productName: prod.name, type, qty, price: type === 'adjust' ? 0 : price,
        cost: type === 'out' ? prod.buyPrice : null, counterparty: str(b.counterparty), note: str(b.note),
        date: new Date().toISOString(), saleId, payment: type === 'out' ? str(b.payment) || 'naqd' : null, seller,
        priceUsd: usd?.priceUsd ?? null, rate: usd?.rate ?? null, rev: v,
      }
      this.insertMovement(m)
      return { movement: m, saleId }
    })
  }

  /** Dollar tovar kirimi: $ narx → so'm (joriy kurs bo'yicha). So'mdagi tovar uchun null. */
  inPrice(p, b) {
    if (p.currency !== 'USD') return null
    const rate = this.needRate()
    const priceUsd = num(b.priceUsd) > 0 ? roundUsd(num(b.priceUsd)) : p.buyPriceUsd
    if (!(priceUsd > 0)) return null
    return { priceUsd, rate, price: Math.round(priceUsd * rate) }
  }

  /** Kirimdan keyin tovarning kelish narxi va (kerak bo'lsa) sotuv narxini yangilash */
  applyInPrice(p, price, usd, sellPrice) {
    if (price > 0) this.db.prepare('UPDATE products SET buyPrice = ? WHERE id = ?').run(price, p.id)
    if (usd) this.db.prepare('UPDATE products SET buyPriceUsd = ? WHERE id = ?').run(usd.priceUsd, p.id)
    let sell = num(sellPrice)
    if (!(sell > 0) && usd && p.markup > 0) sell = sellFrom(price, p.markup)
    if (sell > 0) this.db.prepare('UPDATE products SET sellPrice = ? WHERE id = ?').run(sell, p.id)
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
      const payment = str(b.payment) || 'naqd'
      const cust = b.customerId ? this.customer(b.customerId) : null
      if (payment === 'nasiya' && !cust) throw new HttpError('Nasiya uchun mijozni tanlang')
      const v = this.bump()
      const saleId = this.nextReceipt()
      const date = new Date().toISOString()
      let total = 0
      for (const it of items) {
        const p = prods.get(it.productId)
        total += num(it.qty) * num(it.price)
        this.insertMovement({
          id: randomUUID(), productId: p.id, productName: p.name, type: 'out', qty: num(it.qty), price: num(it.price),
          cost: p.buyPrice, counterparty: cust ? cust.name : str(b.counterparty), note: str(b.note), date, saleId, payment, seller,
          customerId: cust?.id ?? null, rev: v,
        })
      }
      // Nasiyada bir qismini darhol to'lasa — to'lov yozuvi
      const paidNow = Math.round(num(b.paidNow))
      if (payment === 'nasiya' && paidNow > 0) {
        if (paidNow >= total) throw new HttpError("To'liq to'lansa — naqd/karta ni tanlang")
        this.insertTx({ id: randomUUID(), customerId: cust.id, type: 'pay', amount: paidNow, payment: str(b.paidNowPayment) || 'naqd',
          note: `Chek №${saleId} bo'yicha`, saleId, date, seller, createdAt: date })
      }
      for (const [pid, q] of need) {
        const p = prods.get(pid)
        this.db.prepare('UPDATE products SET qty = ? WHERE id = ?').run(round(p.qty - q), pid)
      }
      return { saleId }
    })
  }

  /**
   * Tovar qaytarish: chek bo'yicha qaytgan tovar omborga qaytadi, pul qaytarilgani yoziladi.
   * payment: qanday qaytarildi — naqd/karta/otkazma yoki 'nasiya' (mijoz qarzidan ayriladi).
   * Qaytarish yozuvi: type 'return', saleId — asl chek, batchId — qaytarish raqami.
   */
  returnSale(b, seller) {
    return this.tx(() => {
      const saleId = str(b.saleId)
      const sold = this.db.prepare("SELECT * FROM movements WHERE type = 'out' AND saleId = ?").all(saleId)
      if (!saleId || !sold.length) throw new HttpError('Chek topilmadi', 404)
      const items = (Array.isArray(b.items) ? b.items : []).filter((it) => num(it.qty) > 0)
      if (!items.length) throw new HttpError('Qaytariladigan tovarni tanlang')
      const first = sold[0]
      const payment = ['naqd', 'karta', 'otkazma', 'nasiya'].includes(b.payment) ? b.payment : first.payment === 'nasiya' ? 'nasiya' : first.payment || 'naqd'
      if (payment === 'nasiya' && !first.customerId) throw new HttpError("Qarzdan ayirish faqat mijozli chek uchun")
      const returned = this.db.prepare("SELECT productId, SUM(qty) q FROM movements WHERE type = 'return' AND saleId = ? GROUP BY productId").all(saleId)
      const done = new Map(returned.map((r) => [r.productId, r.q]))
      const v = this.bump()
      const n = Number(this.getMeta('returnNo') ?? 0) + 1
      this.setMeta('returnNo', n)
      const returnId = String(n)
      const date = new Date().toISOString()
      let total = 0
      const seen = new Set()
      for (const it of items) {
        if (seen.has(it.productId)) throw new HttpError('Tovar ikki marta berilgan')
        seen.add(it.productId)
        const lines = sold.filter((m) => m.productId === it.productId)
        if (!lines.length) throw new HttpError("Bu tovar shu chekda yo'q")
        const soldQty = lines.reduce((s, m) => s + m.qty, 0)
        const left = round(soldQty - (done.get(it.productId) ?? 0))
        const qty = round(num(it.qty))
        if (qty > left + 1e-9) throw new HttpError(`"${lines[0].productName}": ko'pi bilan ${left} ta qaytarish mumkin`)
        // Narx va tannarx — chekdagi o'rtacha (bir tovar chekda bir necha qatorda bo'lishi mumkin)
        const price = Math.round(lines.reduce((s, m) => s + m.qty * m.price, 0) / soldQty * 100) / 100
        const cost = lines.every((m) => m.cost == null) ? null : lines.reduce((s, m) => s + m.qty * (m.cost ?? 0), 0) / soldQty
        total += qty * price
        const p = this.db.prepare('SELECT qty FROM products WHERE id = ?').get(it.productId)
        if (p) this.db.prepare('UPDATE products SET qty = ? WHERE id = ?').run(round(p.qty + qty), it.productId)
        this.insertMovement({
          id: randomUUID(), productId: it.productId, productName: lines[0].productName, type: 'return', qty, price, cost,
          counterparty: first.counterparty, note: str(b.note), date, saleId, payment, seller, batchId: returnId,
          customerId: first.customerId ?? null, rev: v,
        })
      }
      return { returnId, saleId, total: Math.round(total) }
    })
  }

  // ---------- ichki shtrix-kodlar ----------
  /** EAN-13: "200" + 9 xonali tartib raqami + nazorat raqami. 200–299 do'kon ichki kodlari uchun ajratilgan. */
  nextBarcode() {
    for (;;) {
      const n = Number(this.getMeta('barcodeSeq') ?? 0) + 1
      this.setMeta('barcodeSeq', n)
      const base = '200' + String(n).padStart(9, '0')
      const sum = [...base].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0)
      const code = base + ((10 - (sum % 10)) % 10)
      if (!this.db.prepare('SELECT 1 FROM products WHERE barcode = ?').get(code)) return code
    }
  }

  reserveBarcode() { return this.tx(() => ({ barcode: this.nextBarcode() })) }

  /** Shtrix-kodi yo'q tovarlarga kod berish (ids berilmasa — hammasiga) */
  generateBarcodes(ids) {
    return this.tx(() => {
      const rows = this.db.prepare("SELECT id FROM products WHERE barcode = ''").all().map((r) => r.id)
      const target = Array.isArray(ids) && ids.length ? rows.filter((id) => ids.includes(id)) : rows
      for (const id of target) this.db.prepare('UPDATE products SET barcode = ? WHERE id = ?').run(this.nextBarcode(), id)
      if (target.length) this.bump()
      return { count: target.length }
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
        // Dollar tovar: $ narx kursga ko'paytiriladi. Narx berilmasa (sotuvchi kiritganda) — joriy kelish narxi
        const usd = this.inPrice(p, it)
        const price = usd ? usd.price : num(it.price) > 0 ? num(it.price) : p.buyPrice
        this.db.prepare('UPDATE products SET qty = ? WHERE id = ?').run(round(p.qty + qty), p.id)
        this.applyInPrice(p, price, usd, it.sellPrice)
        this.insertMovement({
          id: randomUUID(), productId: p.id, productName: p.name, type: 'in', qty, price,
          counterparty: str(b.counterparty), note: str(b.note), date, seller, batchId,
          priceUsd: usd?.priceUsd ?? null, rate: usd?.rate ?? null, rev: v,
        })
      }
      return { batchId }
    })
  }

  deleteMovement(id) {
    return this.tx(() => {
      const m = this.db.prepare('SELECT * FROM movements WHERE id = ?').get(id)
      if (!m) throw new HttpError('Yozuv topilmadi', 404)
      if (m.type === 'out' && this.db.prepare("SELECT 1 FROM movements WHERE type = 'return' AND saleId = ? AND productId = ?").get(m.saleId, m.productId))
        throw new HttpError('Bu tovar qaytarilgan — avval qaytarishni bekor qiling')
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
      this.loadData({ ...d, expenses: Array.isArray(d.expenses) ? d.expenses : [],
        customers: Array.isArray(d.customers) ? d.customers : [], customerTx: Array.isArray(d.customerTx) ? d.customerTx : [], receiptNo })
      if (d.settings) this.setMeta('settings', JSON.stringify(d.settings))
    })
  }
  reset() { return this.tx(() => this.loadData(seedData())) }
  clear() { return this.tx(() => this.loadData({ products: [], movements: [], categories: DEFAULT_CATEGORIES })) }

  /** Mijoz bo'yicha qisqa ma'lumot (Telegram uchun) */
  debtors() { return this.customers().filter((c) => c.debt > 0).sort((a, b) => b.debt - a.debt) }
}
