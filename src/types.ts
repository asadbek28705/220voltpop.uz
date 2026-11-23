export type Unit = 'dona' | 'qop' | 'metr' | 'kg' | 'litr' | 'pachka' | 'm²' | 'm³' | 'komplekt'

export const UNITS: Unit[] = ['dona', 'qop', 'metr', 'kg', 'litr', 'pachka', 'm²', 'm³', 'komplekt']

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

export interface Product {
  id: string
  name: string
  sku: string
  category: string
  unit: Unit
  buyPrice: number
  sellPrice: number
  qty: number
  minQty: number
  location: string
  createdAt: string
}

export type MovementType = 'in' | 'out' | 'adjust'

export interface Movement {
  id: string
  productId: string
  productName: string
  type: MovementType
  qty: number // kirim/chiqim uchun musbat; tuzatish uchun farq (+/-)
  price: number // bir birlik narxi
  counterparty: string // yetkazib beruvchi yoki mijoz
  note: string
  date: string // ISO
}

export interface WarehouseData {
  products: Product[]
  movements: Movement[]
  categories: string[]
}
