import { useCallback, useEffect, useState } from 'react'
import type { Movement, MovementType, Product, WarehouseData } from './types'
import { seedData } from './seed'
import { uid } from './utils'

const KEY = 'ombor-data-v1'

function load(): WarehouseData {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as WarehouseData
  } catch { /* buzilgan ma'lumot — yangidan boshlaymiz */ }
  return seedData()
}

export interface MovementInput {
  productId: string
  type: MovementType
  qty: number
  price: number
  counterparty: string
  note: string
}

export function useWarehouse() {
  const [data, setData] = useState<WarehouseData>(load)

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(data))
  }, [data])

  const saveProduct = useCallback((prod: Omit<Product, 'id' | 'createdAt' | 'qty'> & { id?: string; qty?: number }) => {
    setData((d) => {
      if (prod.id) {
        return { ...d, products: d.products.map((x) => (x.id === prod.id ? { ...x, ...prod, qty: x.qty } as Product : x)) }
      }
      const created: Product = { ...prod, id: uid(), qty: 0, createdAt: new Date().toISOString() } as Product
      const movements = [...d.movements]
      const startQty = prod.qty ?? 0
      if (startQty > 0) {
        created.qty = startQty
        movements.unshift({
          id: uid(), productId: created.id, productName: created.name, type: 'in', qty: startQty,
          price: created.buyPrice, counterparty: '', note: "Boshlang'ich qoldiq", date: new Date().toISOString(),
        })
      }
      const categories = d.categories.includes(prod.category) ? d.categories : [...d.categories, prod.category]
      return { ...d, products: [created, ...d.products], movements, categories }
    })
  }, [])

  const deleteProduct = useCallback((id: string) => {
    setData((d) => ({ ...d, products: d.products.filter((x) => x.id !== id) }))
  }, [])

  /** Kirim / chiqim / inventarizatsiya. Xato bo'lsa matn qaytaradi. */
  const addMovement = useCallback((m: MovementInput): string | null => {
    const prod = data.products.find((x) => x.id === m.productId)
    if (!prod) return 'Mahsulot topilmadi'
    if (m.type !== 'adjust' && !(m.qty > 0)) return "Miqdor 0 dan katta bo'lishi kerak"
    if (m.type === 'out' && m.qty > prod.qty) return `Omborda faqat ${prod.qty} ${prod.unit} bor`
    const delta = m.type === 'in' ? m.qty : m.type === 'out' ? -m.qty : m.qty
    if (prod.qty + delta < 0) return "Qoldiq manfiy bo'lib qoladi"
    const mv: Movement = { ...m, id: uid(), productName: prod.name, date: new Date().toISOString() }
    setData((d) => ({
      ...d,
      products: d.products.map((x) =>
        x.id === m.productId
          ? { ...x, qty: Math.round((x.qty + delta) * 1000) / 1000, ...(m.type === 'in' && m.price > 0 ? { buyPrice: m.price } : {}) }
          : x,
      ),
      movements: [mv, ...d.movements],
    }))
    return null
  }, [data.products])

  const deleteMovement = useCallback((id: string) => {
    // Harakatni bekor qilish: qoldiqni ham qaytaramiz
    setData((d) => {
      const mv = d.movements.find((x) => x.id === id)
      if (!mv) return d
      const delta = mv.type === 'in' ? -mv.qty : mv.type === 'out' ? mv.qty : -mv.qty
      return {
        ...d,
        products: d.products.map((x) => (x.id === mv.productId ? { ...x, qty: Math.max(0, x.qty + delta) } : x)),
        movements: d.movements.filter((x) => x.id !== id),
      }
    })
  }, [])

  const addCategory = useCallback((name: string) => {
    setData((d) => (d.categories.includes(name) ? d : { ...d, categories: [...d.categories, name] }))
  }, [])

  const replaceAll = useCallback((next: WarehouseData) => setData(next), [])
  const reset = useCallback(() => setData(seedData()), [])
  const clearAll = useCallback(() => setData({ products: [], movements: [], categories: seedData().categories }), [])

  return { data, saveProduct, deleteProduct, addMovement, deleteMovement, addCategory, replaceAll, reset, clearAll }
}

export type Warehouse = ReturnType<typeof useWarehouse>
