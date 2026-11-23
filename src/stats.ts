import type { Movement, Product } from './types'

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
