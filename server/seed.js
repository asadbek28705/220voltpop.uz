import { randomUUID } from 'node:crypto'

export const DEFAULT_CATEGORIES = [
  'Sement va quruq aralashmalar',
  "G'isht va blok",
  'Quvurlar va fitinglar',
  'Kranlar va smesitellar',
  'Sanfayans (unitaz, rakovina, vanna)',
  "Bo'yoq va lak",
  'Elektr mollari',
  'Asboblar',
  'Mahkamlagichlar (bolt, shurup)',
  'Boshqa',
]

const C = DEFAULT_CATEGORIES
const id = () => randomUUID()

const p = (name, sku, barcode, category, unit, buyPrice, sellPrice, qty, minQty, location) =>
  ({ id: id(), name, sku, barcode, category, unit, buyPrice, sellPrice, qty, minQty, location, createdAt: new Date().toISOString() })

const CUSTOMERS = ['Chakana mijoz', 'Chakana mijoz', 'Chakana mijoz', 'Usta Akmal', 'Obyekt: Yunusobod 12-uy', 'Qurilish brigadasi', 'Usta Jasur']
const SUPPLIERS = ['Sement zavodi', 'Santexnika ulgurji', "G'isht zavodi", "Bo'yoq distribyutori"]
const PAYMENTS = ['naqd', 'naqd', 'karta', 'otkazma']

export function seedData() {
  const products = [
    p('Sement M400 (50 kg)', 'SEM-400', '4780001000011', C[0], 'qop', 52000, 60000, 120, 30, 'A-1'),
    p('Shpaklyovka (25 kg)', 'SHP-25', '4780001000028', C[0], 'qop', 68000, 80000, 18, 20, 'A-2'),
    p("Pishgan g'isht", 'GSH-01', '', C[1], 'dona', 1100, 1400, 5000, 1000, 'Hovli'),
    p('Gazoblok 600x300x200', 'GZB-20', '', C[1], 'dona', 14000, 17000, 240, 100, 'Hovli'),
    p('PPR quvur 20 mm', 'PPR-20', '4780001000035', C[2], 'metr', 5500, 7500, 400, 100, 'B-1'),
    p('PPR quvur 25 mm', 'PPR-25', '4780001000042', C[2], 'metr', 8000, 10500, 60, 100, 'B-1'),
    p('PPR burchak 20 mm (90°)', 'PPR-B20', '4780001000059', C[2], 'dona', 1200, 2000, 300, 50, 'B-2'),
    p('Kanalizatsiya quvuri 110 mm', 'KAN-110', '4780001000066', C[2], 'metr', 22000, 28000, 45, 20, 'B-3'),
    p('Oshxona smesiteli', 'SMS-01', '4780001000073', C[3], 'dona', 180000, 240000, 12, 5, 'C-1'),
    p('Sharli kran 1/2"', 'KRN-12', '4780001000080', C[3], 'dona', 35000, 45000, 3, 10, 'C-2'),
    p('Unitaz (kompakt)', 'UNT-01', '4780001000097', C[4], 'komplekt', 850000, 1100000, 6, 3, 'D-1'),
    p('Rakovina 60 sm', 'RKV-60', '4780001000103', C[4], 'dona', 320000, 420000, 8, 3, 'D-2'),
    p("Emulsiya bo'yoq oq (10 l)", 'BOY-10', '4780001000110', C[5], 'pachka', 145000, 180000, 25, 10, 'E-1'),
    p('Shurup 4x50 (1 kg)', 'SHR-450', '4780001000127', C[8], 'kg', 28000, 36000, 40, 10, 'F-1'),
  ]

  const movements = []
  const pick = (a) => a[Math.floor(Math.random() * a.length)]
  const qtyFor = (pr) =>
    pr.buyPrice < 2000 ? 50 * (1 + Math.floor(Math.random() * 10)) : pr.buyPrice < 30000 ? 2 + Math.floor(Math.random() * 15) : 1 + Math.floor(Math.random() * 3)
  const now = new Date()
  let receiptNo = 0
  for (let day = 89; day >= 0; day--) {
    const base = new Date(now)
    base.setDate(now.getDate() - day)
    const sales = Math.floor(Math.random() * 4)
    for (let i = 0; i < sales; i++) {
      const d = new Date(base)
      d.setHours(9 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 60))
      if (d > now) continue
      const saleId = String(++receiptNo)
      const customer = pick(CUSTOMERS)
      const payment = pick(PAYMENTS)
      const lines = 1 + Math.floor(Math.random() * 3)
      const used = new Set()
      for (let j = 0; j < lines; j++) {
        const pr = pick(products)
        if (used.has(pr.id)) continue
        used.add(pr.id)
        movements.push({ id: id(), productId: pr.id, productName: pr.name, type: 'out', qty: qtyFor(pr), price: pr.sellPrice, cost: pr.buyPrice,
          counterparty: customer, note: '', date: d.toISOString(), saleId, payment, seller: 'Administrator' })
      }
    }
    if (day % 9 === 0) {
      for (const pr of products.filter(() => Math.random() < 0.35)) {
        const d = new Date(base)
        d.setHours(8, 30)
        if (d > now) continue
        movements.push({ id: id(), productId: pr.id, productName: pr.name, type: 'in', qty: qtyFor(pr) * 4, price: pr.buyPrice, cost: null,
          counterparty: pick(SUPPLIERS), note: '', date: d.toISOString(), saleId: null, payment: null, seller: null })
      }
    }
  }
  return { products, movements, categories: [...C], receiptNo }
}
