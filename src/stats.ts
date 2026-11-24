import { t as tr } from './i18n'
import type { Expense, Movement, Product, ShopSettings } from './types'

const pad = (n: number) => n.toString().padStart(2, '0')

/** Mahalliy vaqt bo'yicha YYYY-MM-DD */
export const dayKey = (d: Date | string) => {
  const x = typeof d === 'string' ? new Date(d) : d
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
}

export const today = () => dayKey(new Date())

export const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return dayKey(d)
}

/**
 * Davr chegarasi: "YYYY-MM-DD" — kun bo'yicha (ikkala chegara kiradi),
 * to'liq ISO vaqt ("...T...") — aniq payt bo'yicha (hisob davri yopilgan soniya).
 */
export const dateInRange = (iso: string, from: string, to: string) => {
  const k = dayKey(iso)
  const okFrom = !from || (from.includes('T') ? iso >= from : k >= from)
  const okTo = !to || (to.includes('T') ? iso < to : k <= to)
  return okFrom && okTo
}
export const expenseInRange = (e: Expense, from: string, to: string) => dateInRange(e.date, from, to)
export const inRange = (m: Movement, from: string, to: string) => dateInRange(m.date, from, to)

/** Sotuv tannarxi: sotuv paytida saqlangan, bo'lmasa hozirgi kelish narxi */
export const unitCost = (m: Movement, products: Product[]) =>
  m.cost ?? products.find((p) => p.id === m.productId)?.buyPrice ?? 0

export const profitOf = (m: Movement, products: Product[]) => m.qty * (m.price - unitCost(m, products))

export const MONTHS = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'].map((m) => tr(m))

export const shortMoney = (n: number) =>
  n >= 1e9 ? (n / 1e9).toFixed(1).replace('.0', '') + ' ' + tr('mlrd')
    : n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + ' ' + tr('mln')
      : n >= 1e3 ? Math.round(n / 1e3) + ' ' + tr('ming') : String(Math.round(n))

// ---------- Chorak (3 oy): hisoblagichlar har chorak 0 dan boshlanadi ----------
const QN = ['I', 'II', 'III', 'IV']
const QMONTHS = ['Yanvar–Mart', 'Aprel–Iyun', 'Iyul–Sentabr', 'Oktabr–Dekabr'].map((m) => tr(m))

export interface Period { from: string; to: string; label: string; short: string }

/** offset: 0 — joriy chorak, -1 — o'tgan chorak va h.k. */
export function quarter(offset = 0, base = new Date()): Period {
  const q0 = Math.floor(base.getMonth() / 3) + offset
  const start = new Date(base.getFullYear(), q0 * 3, 1)
  const end = new Date(start.getFullYear(), start.getMonth() + 3, 0)
  const qi = Math.floor(start.getMonth() / 3)
  return {
    from: dayKey(start), to: dayKey(end),
    label: tr('{0} — {1} chorak ({2})', start.getFullYear(), QN[qi], QMONTHS[qi]),
    short: tr('{0} chorak {1}', QN[qi], start.getFullYear()),
  }
}

export function yearPeriod(offset = 0): Period {
  const y = new Date().getFullYear() + offset
  return { from: `${y}-01-01`, to: `${y}-12-31`, label: tr('{0} yil', y), short: tr('{0} yil', y) }
}

/** Davr chegaralarini kunlarga aylantirish (grafiklar va fayl nomi uchun). Ochiq oxir — bugun. */
export const dayBounds = (from: string, to: string) => ({
  from: from.includes('T') ? dayKey(from) : from,
  to: !to ? today() : to.includes('T') ? dayKey(new Date(new Date(to).getTime() - 1)) : to,
})

/** Joriy hisob davri: oxirgi «Davrni yopish» dan beri; hali yopilmagan bo'lsa — chorak boshidan */
export function currentPeriod(settings: ShopSettings) {
  const ps = settings.periods ?? []
  const from = ps.length ? ps[ps.length - 1].to : new Date(quarter(0).from + 'T00:00:00').toISOString()
  return { from, to: '', closedBefore: ps.length > 0 }
}

export const fmtDay = (iso: string) => {
  const d = new Date(iso)
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}
