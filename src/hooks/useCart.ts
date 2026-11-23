import { useCallback, useEffect, useState } from 'react'
import type { CartItem, Product } from '../types'


/** Savat shu qurilmada saqlanadi — sahifa yangilansa ham yo'qolmaydi */
export function useCart(key = 'ombor-cart', priceOf: (p: Product) => number = (p) => p.sellPrice) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(key) ?? '[]') } catch { return [] }
  })
  useEffect(() => localStorage.setItem(key, JSON.stringify(items)), [key, items])

  const add = useCallback((p: Product, qty = 1) => {
    setItems((list) => {
      const i = list.findIndex((x) => x.productId === p.id)
      if (i >= 0) return list.map((x, j) => (j === i ? { ...x, qty: x.qty + qty } : x))
      return [{ productId: p.id, qty, price: priceOf(p) }, ...list]
    })
  }, [priceOf])
  const update = useCallback((productId: string, patch: Partial<CartItem>) =>
    setItems((list) => list.map((x) => (x.productId === productId ? { ...x, ...patch } : x))), [])
  const remove = useCallback((productId: string) => setItems((list) => list.filter((x) => x.productId !== productId)), [])
  const clear = useCallback(() => setItems([]), [])

  return { items, add, update, remove, clear }
}

export type Cart = ReturnType<typeof useCart>
