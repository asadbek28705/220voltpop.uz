// Ombor serveri: API + tayyor frontend. Telefonlar Wi-Fi orqali ulanadi.
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

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const HTTP_PORT = Number(process.env.PORT ?? 8080)
const HTTPS_PORT = Number(process.env.HTTPS_PORT ?? 8443)
const DEV = process.argv.includes('--dev')
// Demo rejim: boshqalarga ko'rsatish uchun — alohida baza, Telegram o'chiq
const DEMO = process.env.DEMO === '1'
const DATA_DIR = process.env.DATA_DIR ?? join(ROOT, DEMO ? 'data-demo' : 'data')

const store = openDb(join(DATA_DIR, 'ombor.db'))
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
app.use(express.json({ limit: '50mb' }))

// ---- Real vaqtda yangilanish (Server-Sent Events) ----
const clients = new Set()
const notify = () => {
  const msg = `data: ${JSON.stringify({ version: store.version, epoch: store.epoch })}\n\n`
  for (const res of clients) res.write(msg)
}
app.get('/api/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
  res.flushHeaders()
  res.write(`data: ${JSON.stringify({ version: store.version, epoch: store.epoch })}\n\n`)
  clients.add(res)
  const ping = setInterval(() => res.write(': ping\n\n'), 25000)
  req.on('close', () => { clearInterval(ping); clients.delete(res) })
})

const seller = (req) => {
  const raw = req.get('X-Seller')
  try { return raw ? decodeURIComponent(raw).slice(0, 60) : null } catch { return null }
}

/** Har bir o'zgartiruvchi so'rov: xatoni ushlash + boshqa qurilmalarga xabar */
const write = (fn) => (req, res) => {
  try {
    const result = fn(req)
    notify()
    res.json(result ?? { ok: true })
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message })
    console.error(e)
    res.status(500).json({ error: 'Server xatosi' })
  }
}

app.get('/api/data', (req, res) => {
  res.json(store.data(Number(req.query.since ?? 0), String(req.query.epoch ?? '')))
})
app.post('/api/products', write((req) => {
  const p = store.createProduct(req.body, seller(req))
  if (p.qty > 0) tg.onMovement(store.db.prepare("SELECT * FROM movements WHERE productId = ? AND type = 'in'").get(p.id))
  return p
}))
app.put('/api/products/:id', write((req) => store.updateProduct(req.params.id, req.body)))
app.delete('/api/products/:id', write((req) => store.deleteProduct(req.params.id)))
app.post('/api/categories', write((req) => store.addCategory(req.body.name)))
app.post('/api/movements', write((req) => {
  const r = store.addMovement(req.body, seller(req))
  tg.onMovement(r.movement)
  return r
}))
app.delete('/api/movements/:id', write((req) => {
  const m = store.deleteMovement(req.params.id)
  tg.onUndo(m, seller(req))
  return { ok: true }
}))
app.post('/api/sales', write((req) => {
  const r = store.sell(req.body, seller(req))
  tg.onSale(r.saleId)
  return r
}))
app.post('/api/receive', write((req) => {
  const r = store.receive(req.body, seller(req))
  tg.onReceive(r.batchId)
  return r
}))
app.put('/api/settings', write((req) => store.saveSettings(req.body)))
app.post('/api/import', write((req) => store.importAll(req.body)))
app.post('/api/reset', write(() => store.reset()))
app.post('/api/clear', write(() => store.clear()))

// ---- Telegram ----
app.get('/api/telegram', (_req, res) => res.json(tg.publicCfg()))
app.put('/api/telegram', write((req) => tg.update(req.body)))
const tgAction = (fn) => async (req, res) => {
  try {
    if (!tg.cfg.token || !tg.cfg.chatId) return res.status(400).json({ error: 'Token va guruh ID sini kiriting' })
    await fn(req)
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ error: 'Telegram: ' + e.message })
  }
}
app.post('/api/telegram/test', tgAction(() => tg.send("✅ <b>Ombor dasturi ulandi.</b>\nSavdo, kirim va kunlik hisobotlar shu guruhga yuboriladi. Buyruqlar: /yordam")))
app.post('/api/telegram/report', tgAction(() => tg.send(tg.dayReport(new Date()))))

// ---- Frontend (npm run build dan keyin) ----
const dist = join(ROOT, 'dist')
if (!DEV && existsSync(dist)) {
  app.use(express.static(dist))
  app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(join(dist, 'index.html')))
}

const ips = Object.values(networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address)

http.createServer(app).listen(HTTP_PORT, '0.0.0.0', () => {
  console.log(`\n  Ombor serveri ishga tushdi${DEMO ? ' (DEMO rejim)' : ''}`)
  console.log(`  Shu kompyuterda:   http://localhost:${HTTP_PORT}`)
})

if (!DEMO) try {
  const { key, cert } = ensureCert(join(DATA_DIR, 'cert'), ips)
  https.createServer({ key: readFileSync(key), cert: readFileSync(cert) }, app).listen(HTTPS_PORT, '0.0.0.0', () => {
    for (const ip of ips) console.log(`  Telefonlardan:     https://${ip}:${HTTPS_PORT}   (kamera skaneri uchun)`)
    console.log(`\n  Telefon birinchi marta "xavfsiz emas" deb ogohlantiradi — "Qo'shimcha" → "Baribir o'tish" ni bosing.\n`)
  })
} catch (e) {
  console.warn('HTTPS ishga tushmadi (kamera skaneri telefonda ishlamaydi):', e.message)
}
