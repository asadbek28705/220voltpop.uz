import type { Expense, Movement, Product } from './types'

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

export const expenseInRange = (e: Expense, from: string, to: string) => {
  const k = dayKey(e.date)
  return (!from || k >= from) && (!to || k <= to)
}

export const inRange = (m: Movement, from: string, to: string) => {
  const k = dayKey(m.date)
  return (!from || k >= from) && (!to || k <= to)
}

/** Sotuv tannarxi: sotuv paytida saqlangan, bo'lmasa hozirgi kelish narxi */
export const unitCost = (m: Movement, products: Product[]) =>
  m.cost ?? products.find((p) => p.id === m.productId)?.buyPrice ?? 0

export const profitOf = (m: Movement, products: Product[]) => m.qty * (m.price - unitCost(m, products))

export const MONTHS = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek']

export const shortMoney = (n: number) =>
  n >= 1e9 ? (n / 1e9).toFixed(1).replace('.0', '') + ' mlrd'
    : n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + ' mln'
      : n >= 1e3 ? Math.round(n / 1e3) + ' ming' : String(Math.round(n))

// ---------- Chorak (3 oy): hisoblagichlar har chorak 0 dan boshlanadi ----------
const QN = ['I', 'II', 'III', 'IV']
const QMONTHS = ['Yanvar–Mart', 'Aprel–Iyun', 'Iyul–Sentabr', 'Oktabr–Dekabr']

export interface Period { from: string; to: string; label: string; short: string }

/** offset: 0 — joriy chorak, -1 — o'tgan chorak va h.k. */
export function quarter(offset = 0, base = new Date()): Period {
  const q0 = Math.floor(base.getMonth() / 3) + offset
  const start = new Date(base.getFullYear(), q0 * 3, 1)
  const end = new Date(start.getFullYear(), start.getMonth() + 3, 0)
  const qi = Math.floor(start.getMonth() / 3)
  return {
    from: dayKey(start), to: dayKey(end),
    label: `${start.getFullYear()} — ${QN[qi]} chorak (${QMONTHS[qi]})`,
    short: `${QN[qi]} chorak ${start.getFullYear()}`,
  }
}

export function yearPeriod(offset = 0): Period {
  const y = new Date().getFullYear() + offset
  return { from: `${y}-01-01`, to: `${y}-12-31`, label: `${y} yil`, short: `${y} yil` }
}
