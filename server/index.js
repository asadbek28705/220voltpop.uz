// Ombor serveri: API + tayyor frontend.
// Lokal (do'kon kompyuteri): HTTP 8080 + HTTPS 8443 (LAN uchun o'z sertifikati).
// Internet serveri (nginx orqasida): HOST=127.0.0.1 NO_HTTPS=1 TRUST_PROXY=1
import express from 'express'
import http from 'node:http'
import https from 'node:https'
import { existsSync, readFileSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { HttpError, openDb } from './db.js'
import { ensureCert } from './cert.js'
import { DEFAULT_TG, Telegram } from './telegram.js'
import { Auth } from './auth.js'

// Sanalar, kunlar chegarasi va hisobot vaqti — Toshkent vaqti (server UTC da bo'lsa ham)
process.env.TZ ||= 'Asia/Tashkent'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const HTTP_PORT = Number(process.env.PORT ?? 8080)
const HTTPS_PORT = Number(process.env.HTTPS_PORT ?? 8443)
const HOST = process.env.HOST ?? '0.0.0.0'
const DEV = process.argv.includes('--dev')
// Demo rejim: boshqalarga ko'rsatish uchun — alohida baza, Telegram o'chiq, loginsiz
const DEMO = process.env.DEMO === '1'
const DATA_DIR = process.env.DATA_DIR ?? join(ROOT, DEMO ? 'data-demo' : 'data')

const store = openDb(join(DATA_DIR, 'ombor.db'))
const auth = new Auth(store.db)
const tg = new Telegram(store)
if (DEMO) {
  tg.fire = () => {}
  tg.send = () => Promise.reject(new Error("demo rejimida Telegram o'chirilgan"))
  tg.update = () => { throw new HttpError("Demo rejimida Telegram sozlamalarini o'zgartirib bo'lmaydi") }
  tg.publicCfg = () => ({ ...DEFAULT_TG, token: undefined, hasToken: false, tokenHint: '', demo: true })
} else {
  tg.startPolling()
  tg.startScheduler()
}

const app = express()
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 'loopback')
app.use(express.json({ limit: '50mb' }))

// ---------- Kim so'rov yubormoqda ----------
const DEMO_USER = { id: 'demo', name: 'Demo', login: 'demo', role: 'admin', active: true }

app.use('/api', (req, _res, next) => {
  if (DEMO) {
    let name = 'Demo'
    try { name = decodeURIComponent(req.get('X-Seller') ?? '').slice(0, 60) || 'Demo' } catch { /* */ }
    req.user = { ...DEMO_USER, name }
  } else {
    req.token = Auth.tokenFrom(req)
    req.user = auth.userByToken(req.token)
  }
  next()
})

/** Faqat to'g'ridan-to'g'ri shu kompyuterdan (proksisiz) — birinchi adminni yaratish uchun */
const isLocalDirect = (req) =>
  !req.get('X-Forwarded-For') && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)

const ROLE = { admin: 2, seller: 1 }
const need = (role) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Tizimga kiring' })
  if (ROLE[req.user.role] < ROLE[role]) return res.status(403).json({ error: "Bu amal uchun ruxsat yo'q" })
  next()
}
const seller = (req) => req.user?.name ?? null
const isAdmin = (req) => req.user?.role === 'admin'

// ---------- Real vaqtda yangilanish (Server-Sent Events) ----------
const clients = new Set()
const notify = () => {
  const msg = `data: ${JSON.stringify({ version: store.version, epoch: store.epoch })}\n\n`
  for (const res of clients) res.write(msg)
}
app.get('/api/events', need('seller'), (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
  res.flushHeaders()
  res.write(`data: ${JSON.stringify({ version: store.version, epoch: store.epoch })}\n\n`)
  clients.add(res)
  const ping = setInterval(() => res.write(': ping\n\n'), 25000)
  req.on('close', () => { clearInterval(ping); clients.delete(res) })
})

/** Har bir o'zgartiruvchi so'rov: xatoni ushlash + boshqa qurilmalarga xabar */
const write = (fn) => (req, res) => {
  try {
    const result = fn(req, res)
    notify()
    res.json(result ?? { ok: true })
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message })
    console.error(e)
    res.status(500).json({ error: 'Server xatosi' })
  }
}
const read = (fn) => (req, res) => {
  try { res.json(fn(req, res) ?? { ok: true }) } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message })
    console.error(e)
    res.status(500).json({ error: 'Server xatosi' })
  }
}

// ---------- Login ----------
app.get('/api/me', (req, res) => res.json({
  user: req.user, demo: DEMO, needsSetup: !DEMO && auth.count() === 0, canSetup: !DEMO && auth.count() === 0 && isLocalDirect(req),
}))
app.post('/api/login', read((req, res) => {
  if (DEMO) return { user: req.user }
  const { token, user } = auth.login(req.body?.login, req.body?.password, req.ip)
  auth.setCookie(req, res, token)
  return { user }
}))
app.post('/api/logout', (req, res) => { auth.logout(req.token); auth.clearCookie(res); res.json({ ok: true }) })
// Birinchi admin: faqat do'kon kompyuterining o'zidan (internet orqali emas)
app.post('/api/setup', read((req, res) => {
  if (DEMO || auth.count() > 0) throw new HttpError('Allaqachon sozlangan', 400)
  if (!isLocalDirect(req)) throw new HttpError("Birinchi adminni faqat server kompyuterining o'zida yaratish mumkin", 403)
  const { user } = auth.create({ name: req.body?.name, login: req.body?.login, password: req.body?.password, role: 'admin' })
  const { token } = auth.login(req.body.login, req.body.password, req.ip)
  auth.setCookie(req, res, token)
  return { user }
}))
app.post('/api/password', need('seller'), read((req) => {
  if (DEMO) throw new HttpError("Demo rejimida parol yo'q")
  auth.changeOwnPassword(req.user, req.body?.oldPassword, req.body?.newPassword, req.token)
}))
app.get('/api/users', need('admin'), read(() => (DEMO ? [] : auth.list())))
app.post('/api/users', need('admin'), read((req) => { if (DEMO) throw new HttpError("Demo rejimida o'chirilgan"); return auth.create(req.body ?? {}) }))
app.put('/api/users/:id', need('admin'), read((req) => auth.update(req.params.id, req.body ?? {}, req.user)))
app.post('/api/users/:id/reset', need('admin'), read((req) => auth.resetPassword(req.params.id)))

// ---------- Ma'lumotlar ----------
/** Sotuvchiga tannarx, foyda va xarajatlar yuborilmaydi */
function forSeller(d) {
  return {
    ...d,
    products: d.products.map((p) => ({ ...p, buyPrice: 0, buyPriceUsd: 0, markup: 0 })),
    movements: d.movements
      .filter((m) => m.type === 'out' || m.type === 'in' || m.type === 'return')
      .map((m) => ({ ...m, cost: null, price: m.type === 'in' ? 0 : m.price, priceUsd: null })),
    expenses: [],
    customers: d.customers.map(({ paid: _p, ...c }) => c),
  }
}

app.get('/api/data', need('seller'), (req, res) => {
  const d = store.data(Number(req.query.since ?? 0), String(req.query.epoch ?? ''), req.query.p === '1')
  res.json(isAdmin(req) ? d : forSeller(d))
})

// Sotuvchi ham qila oladigan amallar
app.post('/api/sales', need('seller'), write((req) => {
  const r = store.sell(req.body, seller(req))
  tg.onSale(r.saleId)
  return r
}))
// Tovar qaytarish: tovar omborga qaytadi, pul qaytarilgani (yoki qarzdan ayrilgani) yoziladi
app.post('/api/returns', need('seller'), write((req) => {
  const r = store.returnSale(req.body ?? {}, seller(req))
  tg.onReturn(r.returnId)
  return r
}))
app.post('/api/movements', need('seller'), write((req) => {
  const b = { ...req.body }
  if (!isAdmin(req)) {
    if (!['in', 'out'].includes(b.type)) throw new HttpError("Bu amal uchun ruxsat yo'q", 403)
    if (b.type === 'in') { b.price = 0; b.priceUsd = 0; b.sellPrice = 0 } // kelish narxini sotuvchi ko'rmaydi — joriy narx olinadi
  }
  const r = store.addMovement(b, seller(req))
  tg.onMovement(r.movement)
  return r
}))
// Mijozlar: sotuvchi qo'sha oladi va qarz to'lovini qabul qiladi
app.post('/api/customers', need('seller'), write((req) => store.createCustomer(req.body ?? {})))
app.post('/api/customers/:id/tx', need('seller'), write((req) => {
  if (req.body?.type === 'debt' && !isAdmin(req)) throw new HttpError("Qarz qo'shish faqat admin uchun", 403)
  const r = store.addCustomerTx(req.params.id, req.body ?? {}, seller(req))
  tg.onCustomerTx(r.tx, r.customer)
  return r
}))
app.post('/api/receive', need('seller'), write((req) => {
  const b = { ...req.body }
  if (!isAdmin(req)) b.items = (b.items ?? []).map((it) => ({ productId: it.productId, qty: it.qty, price: 0 }))
  const r = store.receive(b, seller(req))
  tg.onReceive(r.batchId)
  return r
}))

// Faqat admin
const admin = need('admin')
app.post('/api/products', admin, write((req) => {
  const p = store.createProduct(req.body, seller(req))
  if (p.qty > 0) tg.onMovement(store.db.prepare("SELECT * FROM movements WHERE productId = ? AND type = 'in'").get(p.id))
  return p
}))
app.put('/api/products/:id', admin, write((req) => store.updateProduct(req.params.id, req.body)))
app.delete('/api/products/:id', admin, write((req) => store.deleteProduct(req.params.id)))
app.post('/api/categories', admin, write((req) => store.addCategory(req.body.name)))
app.delete('/api/movements/:id', admin, write((req) => {
  const m = store.deleteMovement(req.params.id)
  tg.onUndo(m, seller(req))
  return { ok: true }
}))
app.put('/api/customers/:id', admin, write((req) => store.updateCustomer(req.params.id, req.body ?? {})))
app.delete('/api/customers/:id', admin, write((req) => store.deleteCustomer(req.params.id)))
app.delete('/api/customer-tx/:id', admin, write((req) => {
  const t = store.deleteCustomerTx(req.params.id)
  tg.onCustomerTxUndo(t, seller(req))
  return { ok: true }
}))
app.post('/api/barcodes/next', admin, write(() => store.reserveBarcode()))
app.post('/api/barcodes/generate', admin, write((req) => store.generateBarcodes(req.body?.ids)))
app.post('/api/expenses', admin, write((req) => {
  const e = store.addExpense(req.body, seller(req))
  tg.onExpense(e)
  return e
}))
app.delete('/api/expenses/:id', admin, write((req) => {
  const e = store.deleteExpense(req.params.id)
  tg.onExpenseUndo(e, seller(req))
  return { ok: true }
}))
app.put('/api/settings', admin, write((req) => store.saveSettings(req.body)))
/** Hisob davrini yopish: savdo/foyda/xarajat hisoblagichlari shu paytdan 0 dan boshlanadi. Yozuvlar o'chirilmaydi. */
app.post('/api/period/close', admin, write((req) => {
  const p = store.closePeriod(req.body ?? {}, seller(req))
  tg.onPeriodClose(p)
  return p
}))
app.put('/api/rate', admin, write((req) => {
  const r = store.setRate(req.body ?? {})
  tg.onRate?.(r, seller(req))
  return r
}))
/** Markaziy bank (cbu.uz) rasmiy kursi */
app.get('/api/rate/cbu', admin, async (_req, res) => {
  try {
    const r = await fetch('https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/', { signal: AbortSignal.timeout(8000) })
    const [usd] = await r.json()
    const rate = Number(usd?.Rate)
    if (!(rate > 0)) throw new Error()
    res.json({ rate, date: usd.Date })
  } catch {
    res.status(502).json({ error: "Markaziy bank saytidan kursni olib bo'lmadi. Qo'lda kiriting." })
  }
})
app.post('/api/import', admin, write((req) => store.importAll(req.body)))
app.post('/api/reset', admin, write(() => store.reset()))
app.post('/api/clear', admin, write(() => store.clear()))

// ---------- Telegram (faqat admin) ----------
app.get('/api/telegram', admin, (_req, res) => res.json(tg.publicCfg()))
app.put('/api/telegram', admin, write((req) => tg.update(req.body)))
const tgAction = (fn) => async (req, res) => {
  try {
    if (!tg.cfg.token || !tg.cfg.chatId) return res.status(400).json({ error: 'Token va guruh ID sini kiriting' })
    await fn(req)
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ error: 'Telegram: ' + e.message })
  }
}
app.post('/api/telegram/test', admin, tgAction(() => tg.send("✅ <b>Ombor dasturi ulandi.</b>\nSavdo, kirim va kunlik hisobotlar shu guruhga yuboriladi. Buyruqlar: /yordam")))
app.post('/api/telegram/report', admin, tgAction(() => tg.send(tg.dayReport(new Date()))))

app.use('/api', (_req, res) => res.status(404).json({ error: 'Topilmadi' }))

// Android ilova (TWA) shu sayt bilan bog'langanini tasdiqlash: data/assetlinks.json
app.get('/.well-known/assetlinks.json', (_req, res) => {
  const f = join(DATA_DIR, 'assetlinks.json')
  if (!existsSync(f)) return res.status(404).json([])
  res.type('application/json').send(readFileSync(f, 'utf8'))
})

// ---------- Frontend (npm run build dan keyin) ----------
const dist = join(ROOT, 'dist')
if (!DEV && existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '7d', setHeaders: (res, path) => { if (/\.(html|webmanifest)$|sw\.js$/.test(path)) res.setHeader('Cache-Control', 'no-cache') } }))
  app.get(/^\/(?!api\/).*/, (_req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(join(dist, 'index.html')) })
}

const ips = Object.values(networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address)

http.createServer(app).listen(HTTP_PORT, HOST, () => {
  console.log(`\n  Ombor serveri ishga tushdi${DEMO ? ' (DEMO rejim)' : ''}`)
  console.log(`  Shu kompyuterda:   http://localhost:${HTTP_PORT}`)
  if (!DEMO && auth.count() === 0) console.log('  Hali foydalanuvchi yo\'q: shu kompyuterda brauzerni oching yoki `npm run user -- add <login> "<Ism>" admin`')
})

if (!DEMO && process.env.NO_HTTPS !== '1') try {
  const { key, cert } = ensureCert(join(DATA_DIR, 'cert'), ips)
  https.createServer({ key: readFileSync(key), cert: readFileSync(cert) }, app).listen(HTTPS_PORT, HOST, () => {
    for (const ip of ips) console.log(`  Telefonlardan:     https://${ip}:${HTTPS_PORT}   (kamera skaneri uchun)`)
    console.log(`\n  Telefon birinchi marta "xavfsiz emas" deb ogohlantiradi — "Qo'shimcha" → "Baribir o'tish" ni bosing.\n`)
  })
} catch (e) {
  console.warn('HTTPS ishga tushmadi (kamera skaneri telefonda ishlamaydi):', e.message)
}
