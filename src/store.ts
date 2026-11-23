import { useCallback, useEffect, useRef, useState } from 'react'
import type { CartItem, Expense, Movement, MovementType, Product, ShopSettings, WarehouseData } from './types'
import { api } from './api'

interface DataResponse extends WarehouseData {
  full: boolean
  epoch: string
  version: number
  deleted: string[]
}

export interface MovementInput {
  productId: string
  type: MovementType
  qty: number
  price: number
  counterparty: string
  note: string
  payment?: string
}

export type ProductInput = Omit<Product, 'id' | 'createdAt' | 'qty'> & { id?: string; qty?: number }

const EMPTY: WarehouseData = {
  products: [], movements: [], categories: [], expenses: [],
  settings: { shopName: '', address: '', phone: '', receiptFooter: '' },
}

export function useWarehouse() {
  const [data, setData] = useState<WarehouseData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [online, setOnline] = useState(true)
  const sync = useRef({ version: 0, epoch: '', busy: false, again: false })

  /** Serverdan faqat o'zgarganlarini oladi */
  const refresh = useCallback(async () => {
    const s = sync.current
    if (s.busy) { s.again = true; return }
    s.busy = true
    try {
      const d = await api<DataResponse>('GET', `/data?since=${s.version}&epoch=${encodeURIComponent(s.epoch)}`)
      setData((prev) => {
        let movements: Movement[]
        if (d.full) movements = d.movements
        else {
          const drop = new Set([...d.deleted, ...d.movements.map((m) => m.id)])
          movements = [...d.movements, ...prev.movements.filter((m) => !drop.has(m.id))]
          if (d.movements.length) movements.sort((a, b) => b.date.localeCompare(a.date))
        }
        return { products: d.products, categories: d.categories, settings: d.settings, expenses: d.expenses ?? [], movements }
      })
      s.version = d.version
      s.epoch = d.epoch
      setOnline(true)
    } catch {
      setOnline(false)
    } finally {
      s.busy = false
      setLoading(false)
      if (s.again) { s.again = false; refresh() }
    }
  }, [])

  // Boshqa qurilmalardagi o'zgarishlarni real vaqtda olish
  useEffect(() => {
    refresh()
    const es = new EventSource('/api/events')
    es.onmessage = (e) => {
      const { version, epoch } = JSON.parse(e.data)
      if (version !== sync.current.version || epoch !== sync.current.epoch) refresh()
    }
    es.onopen = () => setOnline(true)
    es.onerror = () => setOnline(false)
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => { es.close(); document.removeEventListener('visibilitychange', onVisible) }
  }, [refresh])

  const mutate = useCallback(<T,>(method: string, path: string, body?: unknown) =>
    api<T>(method, path, body).finally(refresh), [refresh])

  const saveProduct = useCallback((p: ProductInput) =>
    p.id ? mutate<Product>('PUT', `/products/${p.id}`, p) : mutate<Product>('POST', '/products', p), [mutate])
  const deleteProduct = useCallback((id: string) => mutate('DELETE', `/products/${id}`), [mutate])
  const addMovement = useCallback((m: MovementInput) => mutate<{ saleId: string | null }>('POST', '/movements', m), [mutate])
  const deleteMovement = useCallback((id: string) => mutate('DELETE', `/movements/${id}`), [mutate])
  const sell = useCallback((b: { items: CartItem[]; counterparty: string; note: string; payment: string }) =>
    mutate<{ saleId: string }>('POST', '/sales', b), [mutate])
  const receive = useCallback((b: { items: CartItem[]; counterparty: string; note: string }) =>
    mutate<{ batchId: string }>('POST', '/receive', b), [mutate])
  const addExpense = useCallback((e: { category: string; amount: number; note: string; payment: string; date?: string }) =>
    mutate<Expense>('POST', '/expenses', e), [mutate])
  const deleteExpense = useCallback((id: string) => mutate('DELETE', `/expenses/${id}`), [mutate])
  const nextBarcode = useCallback(() => mutate<{ barcode: string }>('POST', '/barcodes/next'), [mutate])
  const generateBarcodes = useCallback((ids?: string[]) => mutate<{ count: number }>('POST', '/barcodes/generate', { ids }), [mutate])
  const saveSettings = useCallback((s: ShopSettings) => mutate('PUT', '/settings', s), [mutate])
  const replaceAll = useCallback((d: WarehouseData) => mutate('POST', '/import', d), [mutate])
  const reset = useCallback(() => mutate('POST', '/reset'), [mutate])
  const clearAll = useCallback(() => mutate('POST', '/clear'), [mutate])

  const findByCode = useCallback((code: string) => {
    const c = code.trim().toLowerCase()
    if (!c) return undefined
    return data.products.find((p) => p.barcode.toLowerCase() === c) ?? data.products.find((p) => p.sku.toLowerCase() === c)
  }, [data.products])

  return {
    data, loading, online, refresh, findByCode,
    saveProduct, deleteProduct, addMovement, deleteMovement, sell, receive, addExpense, deleteExpense, nextBarcode, generateBarcodes, saveSettings, replaceAll, reset, clearAll,
  }
}

export type Warehouse = ReturnType<typeof useWarehouse>
