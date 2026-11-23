// Telegram bot: savdo/kirim xabarlari, kunlik hisobot va guruhdagi buyruqlar.
// Token faqat serverda (data/ombor.db) saqlanadi.

const PAYMENT = { naqd: 'Naqd', karta: 'Karta', otkazma: "O'tkazma" }
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const money = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + " so'm"
const qtyFmt = (n) => String(Math.round(n * 100) / 100).replace('.', ',')
const pad = (n) => String(n).padStart(2, '0')
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const dmy = (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
const hm = (iso) => { const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

export const DEFAULT_TG = {
  token: '', chatId: '', enabled: false,
  notifySales: true, notifyIncoming: true, notifyAdjust: true, notifyUndo: true, notifyLowStock: true,
  dailyEnabled: true, dailyTime: '20:00', lastDaily: '',
}

export class Telegram {
  constructor(store) {
    this.store = store
    this.queue = Promise.resolve()
    this.pollId = 0
    this.offset = 0
  }

  // ---------- sozlamalar ----------
  get cfg() { return { ...DEFAULT_TG, ...JSON.parse(this.store.getMeta('telegram') ?? '{}') } }
  setCfg(patch) { this.store.setMeta('telegram', JSON.stringify({ ...this.cfg, ...patch })) }
  get ready() { const c = this.cfg; return c.enabled && c.token && c.chatId }

  /** Telefon/brauzerga tokenning to'liq qiymati berilmaydi */
  publicCfg() {
    const { token, ...rest } = this.cfg
    return { ...rest, hasToken: !!token, tokenHint: token ? token.slice(0, 6) + '…' + token.slice(-4) : '' }
  }

  update(b) {
    const patch = {}
    if (typeof b.token === 'string' && b.token.trim()) patch.token = b.token.trim()
    if (b.chatId != null) patch.chatId = String(b.chatId).trim()
    for (const k of ['enabled', 'notifySales', 'notifyIncoming', 'notifyAdjust', 'notifyUndo', 'notifyLowStock', 'dailyEnabled']) {
      if (k in b) patch[k] = !!b[k]
    }
    if (typeof b.dailyTime === 'string' && /^\d{2}:\d{2}$/.test(b.dailyTime)) patch.dailyTime = b.dailyTime
    const tokenChanged = patch.token && patch.token !== this.cfg.token
    this.setCfg(patch)
    if (tokenChanged || 'enabled' in patch) this.startPolling()
    return this.publicCfg()
  }

  // ---------- Telegram API ----------
  async call(method, params, token = this.cfg.token, timeoutMs = 15000) {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params ?? {}),
      signal: AbortSignal.timeout(timeoutMs),
    })
    const data = await res.json()
    if (!data.ok) {
      const err = new Error(data.description ?? 'Telegram xatosi')
      err.retryAfter = data.parameters?.retry_after
      throw err
    }
    return data.result
  }

  /** Xabarlar navbat bilan yuboriladi (Telegram cheklovi: guruhga daqiqasiga ~20 ta) */
  send(text, chatId = this.cfg.chatId) {
    if (!this.cfg.token || !chatId) return Promise.resolve()
    const job = async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          return await this.call('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
        } catch (e) {
          if (e.retryAfter) await new Promise((r) => setTimeout(r, (e.retryAfter + 1) * 1000))
          else if (attempt === 2) throw e
          else await new Promise((r) => setTimeout(r, 2000))
        }
      }
    }
    const p = this.queue.then(job)
    this.queue = p.catch((e) => console.warn('Telegram:', e.message))
    return p
  }

  /** Savdo jarayonini to'xtatmaslik uchun — xato bo'lsa faqat logga yozamiz */
  fire(text) { if (this.ready) this.send(text).catch(() => {}) }

  // ---------- hodisalar ----------
  onSale(saleId) {
    if (!this.ready || !this.cfg.notifySales) return
    const lines = this.store.db.prepare("SELECT * FROM movements WHERE type = 'out' AND saleId = ?").all(saleId)
    if (!lines.length) return
    const f = lines[0]
    const total = lines.reduce((s, m) => s + m.qty * m.price, 0)
    const unit = (id) => this.store.db.prepare('SELECT unit FROM products WHERE id = ?').get(id)?.unit ?? ''
    let t = `🛒 <b>Savdo — chek №${esc(saleId)}</b>\n`
    t += lines.map((m, i) => `${i + 1}. ${esc(m.productName)} — ${qtyFmt(m.qty)} ${esc(unit(m.productId))} × ${money(m.price)}`).join('\n')
    t += `\n\n💰 <b>Jami: ${money(total)}</b>\n💳 To'lov: ${PAYMENT[f.payment] ?? esc(f.payment)}`
    if (f.counterparty) t += `\n👤 Mijoz: ${esc(f.counterparty)}`
    if (f.seller) t += `\n🧑‍💼 Sotuvchi: ${esc(f.seller)}`
    t += `\n🕒 ${hm(f.date)}`
    this.fire(t)
    this.lowStock(lines.map((m) => m.productId))
  }

  onMovement(m) {
    if (!this.ready || !m) return
    const c = this.cfg
    const p = this.store.db.prepare('SELECT * FROM products WHERE id = ?').get(m.productId)
    const unit = p?.unit ?? ''
    if (m.type === 'out') return this.onSale(m.saleId)
    if (m.type === 'in' && c.notifyIncoming) {
      let t = `📥 <b>Kirim</b>\n${esc(m.productName)} — ${qtyFmt(m.qty)} ${esc(unit)} × ${money(m.price)}\n💰 Summa: <b>${money(m.qty * m.price)}</b>`
      if (m.counterparty) t += `\n🚚 Ta'minotchi: ${esc(m.counterparty)}`
      if (m.seller) t += `\n🧑‍💼 Qabul qildi: ${esc(m.seller)}`
      if (p) t += `\n📦 Yangi qoldiq: ${qtyFmt(p.qty)} ${esc(unit)}`
      this.fire(t)
    }
    if (m.type === 'adjust' && c.notifyAdjust) {
      let t = `📋 <b>Inventarizatsiya</b>\n${esc(m.productName)}: ${m.qty > 0 ? '+' : ''}${qtyFmt(m.qty)} ${esc(unit)}`
      if (p) t += `\n📦 Yangi qoldiq: ${qtyFmt(p.qty)} ${esc(unit)}`
      if (m.note) t += `\n📝 ${esc(m.note)}`
      if (m.seller) t += `\n🧑‍💼 ${esc(m.seller)}`
      this.fire(t)
      this.lowStock([m.productId])
    }
  }

  onUndo(m, who) {
    if (!this.ready || !this.cfg.notifyUndo || !m) return
    const kind = m.type === 'out' ? `savdo (chek №${esc(m.saleId)})` : m.type === 'in' ? 'kirim' : 'inventarizatsiya'
    let t = `↩️ <b>Bekor qilindi: ${kind}</b>\n${esc(m.productName)} — ${qtyFmt(m.qty)}`
    if (m.type !== 'adjust') t += ` × ${money(m.price)} = ${money(m.qty * m.price)}`
    if (who) t += `\n🧑‍💼 ${esc(who)}`
    this.fire(t)
  }

  lowStock(ids) {
    if (!this.cfg.notifyLowStock) return
    const low = [...new Set(ids)]
      .map((id) => this.store.db.prepare('SELECT * FROM products WHERE id = ?').get(id))
      .filter((p) => p && p.qty <= p.minQty)
    if (!low.length) return
    this.fire(`⚠️ <b>Kam qoldi</b>\n` + low.map((p) => `• ${esc(p.name)} — ${qtyFmt(p.qty)} ${esc(p.unit)} (minimal ${qtyFmt(p.minQty)})`).join('\n'))
  }

  // ---------- hisobotlar ----------
  report(from, to, title) {
    const db = this.store.db
    const rows = db.prepare('SELECT * FROM movements WHERE date >= ? AND date < ?').all(from.toISOString(), to.toISOString())
    const sales = rows.filter((m) => m.type === 'out')
    const ins = rows.filter((m) => m.type === 'in')
    const products = db.prepare('SELECT * FROM products').all()
    const byId = new Map(products.map((p) => [p.id, p]))
    const revenue = sales.reduce((s, m) => s + m.qty * m.price, 0)
    const profit = sales.reduce((s, m) => s + m.qty * (m.price - (m.cost ?? byId.get(m.productId)?.buyPrice ?? 0)), 0)
    const receipts = new Set(sales.map((m) => m.saleId)).size
    const purchased = ins.reduce((s, m) => s + m.qty * m.price, 0)

    const pay = new Map()
    for (const m of sales) pay.set(m.payment, (pay.get(m.payment) ?? 0) + m.qty * m.price)
    const top = new Map()
    for (const m of sales) {
      const t = top.get(m.productId) ?? { name: m.productName, qty: 0, sum: 0, unit: byId.get(m.productId)?.unit ?? '' }
      t.qty += m.qty; t.sum += m.qty * m.price
      top.set(m.productId, t)
    }
    const sellers = new Map()
    for (const m of sales) { const k = m.seller || '—'; sellers.set(k, (sellers.get(k) ?? 0) + m.qty * m.price) }
    const low = products.filter((p) => p.qty <= p.minQty).sort((a, b) => a.qty - b.qty)
    const stockValue = products.reduce((s, p) => s + p.qty * p.buyPrice, 0)

    let t = `📊 <b>${esc(title)}</b>\n\n`
    t += `💰 Savdo: <b>${money(revenue)}</b>\n`
    t += `📈 Foyda: <b>${money(profit)}</b>\n`
    t += `🧾 Cheklar soni: ${receipts}\n`
    t += `📥 Kirim: ${money(purchased)}\n`
    if (pay.size) {
      t += `\n💳 <b>To'lov usullari</b>\n` + [...pay].sort((a, b) => b[1] - a[1]).map(([k, v]) => `• ${PAYMENT[k] ?? esc(k)}: ${money(v)}`).join('\n') + '\n'
    }
    if (sellers.size > 1 || (sellers.size === 1 && !sellers.has('—'))) {
      t += `\n🧑‍💼 <b>Sotuvchilar</b>\n` + [...sellers].sort((a, b) => b[1] - a[1]).map(([k, v]) => `• ${esc(k)}: ${money(v)}`).join('\n') + '\n'
    }
    if (top.size) {
      t += `\n🏆 <b>Eng ko'p sotilgan</b>\n` + [...top.values()].sort((a, b) => b.sum - a.sum).slice(0, 5)
        .map((x, i) => `${i + 1}. ${esc(x.name)} — ${qtyFmt(x.qty)} ${esc(x.unit)}, ${money(x.sum)}`).join('\n') + '\n'
    }
    if (ins.length) {
      t += `\n📥 <b>Kirimlar</b>\n` + ins.slice(0, 10).map((m) => `• ${esc(m.productName)} — ${qtyFmt(m.qty)}, ${money(m.qty * m.price)}`).join('\n')
      if (ins.length > 10) t += `\n… yana ${ins.length - 10} ta`
      t += '\n'
    }
    t += `\n🏬 Ombor qiymati (tannarx): ${money(stockValue)}`
    if (low.length) {
      t += `\n\n⚠️ <b>Kam qolgan tovarlar (${low.length})</b>\n` + low.slice(0, 15)
        .map((p) => `• ${esc(p.name)} — ${qtyFmt(p.qty)} ${esc(p.unit)}`).join('\n')
      if (low.length > 15) t += `\n… yana ${low.length - 15} ta`
    }
    return t
  }

  dayReport(day) {
    const from = startOfDay(day)
    return this.report(from, addDays(from, 1), `Kunlik hisobot — ${dmy(from)}`)
  }

  /** Kunlik hisobot vaqti 12:00 dan keyin bo'lsa — bugungi, oldin bo'lsa — kechagi kun hisoboti */
  scheduledReport() {
    const now = new Date()
    const [h] = this.cfg.dailyTime.split(':').map(Number)
    return this.dayReport(h >= 12 ? now : addDays(now, -1))
  }

  startScheduler() {
    setInterval(() => {
      const c = this.cfg
      if (!this.ready || !c.dailyEnabled) return
      const now = new Date()
      const today = dayKey(now)
      if (c.lastDaily === today) return
      if (`${pad(now.getHours())}:${pad(now.getMinutes())}` < c.dailyTime) return
      // Vaqt o'tib ketgan bo'lsa (kompyuter o'chiq edi) — 3 soat ichida baribir yuboramiz
      const [h, mi] = c.dailyTime.split(':').map(Number)
      if (now - new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, mi) > 3 * 3600e3) return
      this.setCfg({ lastDaily: today })
      this.send(this.scheduledReport()).catch((e) => {
        console.warn('Kunlik hisobot yuborilmadi:', e.message)
        this.setCfg({ lastDaily: '' })
      })
    }, 30_000)
  }

  // ---------- guruhdagi buyruqlar ----------
  async startPolling() {
    const id = ++this.pollId
    const c = this.cfg
    if (!c.enabled || !c.token) return
    this.call('setMyCommands', {
      commands: [
        { command: 'hisobot', description: 'Bugungi hisobot' },
        { command: 'kecha', description: 'Kechagi hisobot' },
        { command: 'oy', description: 'Shu oy hisoboti' },
        { command: 'kam', description: 'Kam qolgan tovarlar' },
        { command: 'qoldiq', description: 'Tovar qoldig\'i: /qoldiq sement' },
        { command: 'yordam', description: 'Buyruqlar ro\'yxati' },
      ],
    }).catch(() => {})
    while (id === this.pollId) {
      try {
        const updates = await this.call('getUpdates', { offset: this.offset, timeout: 50, allowed_updates: ['message'] }, this.cfg.token, 60000)
        for (const u of updates) {
          this.offset = u.update_id + 1
          if (id === this.pollId) this.handle(u.message).catch((e) => console.warn('Telegram buyruq:', e.message))
        }
      } catch (e) {
        if (id !== this.pollId) return
        await new Promise((r) => setTimeout(r, 5000))
      }
    }
  }

  async handle(msg) {
    if (!msg?.text) return
    // Faqat sozlangan guruhdan kelgan buyruqlarga javob beramiz
    if (String(msg.chat.id) !== String(this.cfg.chatId)) return
    const m = msg.text.trim().match(/^\/(\w+)(?:@\w+)?\s*(.*)$/s)
    if (!m) return
    const [, cmd, arg] = m
    const reply = (t) => this.send(t, msg.chat.id)
    const now = new Date()
    switch (cmd.toLowerCase()) {
      case 'hisobot': return reply(this.dayReport(now))
      case 'kecha': return reply(this.dayReport(addDays(now, -1)))
      case 'oy': {
        const from = new Date(now.getFullYear(), now.getMonth(), 1)
        return reply(this.report(from, addDays(startOfDay(now), 1), `Oylik hisobot — ${pad(now.getMonth() + 1)}.${now.getFullYear()}`))
      }
      case 'kam': {
        const low = this.store.db.prepare('SELECT * FROM products WHERE qty <= minQty ORDER BY qty').all()
        return reply(low.length
          ? `⚠️ <b>Kam qolgan tovarlar (${low.length})</b>\n` + low.map((p) => `• ${esc(p.name)} — ${qtyFmt(p.qty)} ${esc(p.unit)} (min ${qtyFmt(p.minQty)})`).join('\n')
          : '✅ Hamma tovar yetarli')
      }
      case 'qoldiq': {
        const q = arg.trim()
        if (!q) return reply('Masalan: <code>/qoldiq sement</code>')
        const list = this.store.db.prepare(
          "SELECT * FROM products WHERE lower(name) LIKE lower(?) OR barcode = ? OR lower(sku) = lower(?) ORDER BY name LIMIT 15",
        ).all(`%${q}%`, q, q)
        return reply(list.length
          ? list.map((p) => `📦 <b>${esc(p.name)}</b>\nQoldiq: ${qtyFmt(p.qty)} ${esc(p.unit)} · Narx: ${money(p.sellPrice)}${p.location ? ' · Joyi: ' + esc(p.location) : ''}`).join('\n\n')
          : `"${esc(q)}" topilmadi`)
      }
      case 'start':
      case 'yordam':
        return reply([
          '🤖 <b>Ombor boti</b>',
          '/hisobot — bugungi hisobot',
          '/kecha — kechagi hisobot',
          '/oy — shu oy hisoboti',
          '/kam — kam qolgan tovarlar',
          '/qoldiq <i>nomi</i> — tovar qoldig\'i',
          '',
          `Har kuni soat ${this.cfg.dailyTime} da umumiy hisobot yuboriladi.`,
        ].join('\n'))
    }
  }
}
