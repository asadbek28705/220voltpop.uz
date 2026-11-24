import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CartItem, Payment, Product } from '../types'

/** Kassadagi bitta xaridor oynasi: o'z savati, mijozi va to'lov usuli bilan */
export interface SaleTab {
  id: string
  n: number // «Xaridor 1», «Xaridor 2» ...
  items: CartItem[]
  customerId: string // bazadagi doimiy mijoz
  customerText: string // bir martalik mijoz ismi
  payment: Payment
  paidNow: string
}
interface State { tabs: SaleTab[]; active: string }

const KEY = 'ombor-sale-tabs'
export const MAX_TABS = 8
const uid = () => Math.random().toString(36).slice(2, 10)
const blank = (n: number, customerId = ''): SaleTab => ({ id: uid(), n, items: [], customerId, customerText: '', payment: 'naqd', paidNow: '' })

function load(): State {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as State | null
    if (s?.tabs?.length) return { tabs: s.tabs, active: s.tabs.some((t) => t.id === s.active) ? s.active : s.tabs[0].id }
  } catch { /* buzilgan — yangidan */ }
  // Eski versiyadagi bitta savat va mijozni ko'chiramiz
  const t = blank(1, localStorage.getItem('ombor-sale-customer') ?? '')
  try { t.items = JSON.parse(localStorage.getItem('ombor-cart') ?? '[]') } catch { /* */ }
  return { tabs: [t], active: t.id }
}

/**
 * Kassada bir vaqtda bir nechta xaridorga savdo: har biri alohida oyna (tab).
 * Shu qurilmada saqlanadi — sahifa yangilansa ham yo'qolmaydi.
 */
export function useSaleTabs() {
  const [state, setState] = useState<State>(load)
  useEffect(() => localStorage.setItem(KEY, JSON.stringify(state)), [state])

  const tab = state.tabs.find((t) => t.id === state.active) ?? state.tabs[0]

  const patchTab = useCallback((id: string, patch: Partial<SaleTab> | ((t: SaleTab) => Partial<SaleTab>)) =>
    setState((s) => ({ ...s, tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...(typeof patch === 'function' ? patch(t) : patch) } : t)) })), [])
  const patch = useCallback((p: Partial<SaleTab>) => setState((s) => ({ ...s, tabs: s.tabs.map((t) => (t.id === s.active ? { ...t, ...p } : t)) })), [])
  const setItems = useCallback((fn: (items: CartItem[]) => CartItem[]) =>
    setState((s) => ({ ...s, tabs: s.tabs.map((t) => (t.id === s.active ? { ...t, items: fn(t.items) } : t)) })), [])

  const select = useCallback((id: string) => setState((s) => ({ ...s, active: id })), [])

  /** Yangi xaridor oynasi (bo'sh raqam olinadi: 1, 2, 3 ...) */
  const newTab = useCallback((customerId = '') => setState((s) => {
    if (s.tabs.length >= MAX_TABS) return s
    const used = new Set(s.tabs.map((t) => t.n))
    let n = 1
    while (used.has(n)) n++
    const t = blank(n, customerId)
    return { tabs: [...s.tabs, t], active: t.id }
  }), [])

  /** Oynani yopish. Oxirgisi yopilsa — bo'sh «Xaridor 1» qoladi */
  const close = useCallback((id: string) => setState((s) => {
    const i = s.tabs.findIndex((t) => t.id === id)
    const tabs = s.tabs.filter((t) => t.id !== id)
    if (!tabs.length) { const t = blank(1); return { tabs: [t], active: t.id } }
    const active = s.active === id ? tabs[Math.max(0, i - 1)].id : s.active
    return { tabs, active }
  }), [])

  // Faol oynaning savati — eski useCart bilan bir xil interfeys
  const add = useCallback((p: Product, qty = 1) => setItems((list) => {
    const i = list.findIndex((x) => x.productId === p.id)
    if (i >= 0) return list.map((x, j) => (j === i ? { ...x, qty: x.qty + qty } : x))
    return [{ productId: p.id, qty, price: p.sellPrice }, ...list]
  }), [setItems])
  const update = useCallback((productId: string, p: Partial<CartItem>) =>
    setItems((list) => list.map((x) => (x.productId === productId ? { ...x, ...p } : x))), [setItems])
  const remove = useCallback((productId: string) => setItems((list) => list.filter((x) => x.productId !== productId)), [setItems])
  const clear = useCallback(() => setItems(() => []), [setItems])
  const cart = useMemo(() => ({ items: tab.items, add, update, remove, clear }), [tab.items, add, update, remove, clear])

  /** Mijozlar sahifasidan «Sotish»: joriy oyna band bo'lsa — shu mijoz uchun yangi oyna */
  const openForCustomer = useCallback((customerId: string) => {
    if (tab.items.length === 0 || tab.customerId === customerId || state.tabs.length >= MAX_TABS) patch({ customerId, customerText: '' })
    else {
      const free = state.tabs.find((t) => t.items.length === 0 && !t.customerId)
      if (free) { select(free.id); patchTab(free.id, { customerId }) } else newTab(customerId)
    }
  }, [tab, state.tabs, patch, patchTab, select, newTab])

  const itemCount = state.tabs.reduce((s, t) => s + t.items.length, 0)

  return { tabs: state.tabs, tab, select, newTab, close, patch, cart, openForCustomer, itemCount }
}

export type SaleTabs = ReturnType<typeof useSaleTabs>
