export type Unit = 'dona' | 'qop' | 'metr' | 'kg' | 'litr' | 'pachka' | 'm²' | 'm³' | 'komplekt'

export const UNITS: Unit[] = ['dona', 'qop', 'metr', 'kg', 'litr', 'pachka', 'm²', 'm³', 'komplekt']

export interface Product {
  id: string
  name: string
  sku: string
  barcode: string
  category: string
  unit: Unit
  buyPrice: number
  sellPrice: number
  qty: number
  minQty: number
  location: string
  createdAt: string
  currency: Currency // qaysi valyutada sotib olinadi
  buyPriceUsd: number // dollar tovar uchun kelish narxi ($)
  markup: number // ustama %, 0 — sotuv narxi qo'lda
}

export type Currency = 'UZS' | 'USD'

export type MovementType = 'in' | 'out' | 'adjust'

export type Payment = 'naqd' | 'karta' | 'otkazma' | 'nasiya'
/** Pul bilan to'lov usullari (xarajat, qarz to'lovi) */
export const PAYMENTS: { value: Payment; label: string }[] = [
  { value: 'naqd', label: 'Naqd' },
  { value: 'karta', label: 'Karta' },
  { value: 'otkazma', label: "O'tkazma (Click/Payme)" },
]
/** Savdoda qo'shimcha: nasiya (qarzga) */
export const SALE_PAYMENTS: { value: Payment; label: string }[] = [...PAYMENTS, { value: 'nasiya', label: 'Nasiya (qarzga)' }]
export const paymentLabel = (p?: string | null) => SALE_PAYMENTS.find((x) => x.value === p)?.label ?? p ?? ''

export interface Movement {
  id: string
  productId: string
  productName: string
  type: MovementType
  qty: number // kirim/chiqim uchun musbat; inventarizatsiyada farq (+/-)
  price: number // bir birlik narxi
  cost?: number | null // sotuv paytidagi tannarx
  counterparty: string // yetkazib beruvchi yoki mijoz
  note: string
  date: string // ISO
  saleId?: string | null // chek raqami
  payment?: Payment | null
  seller?: string | null
  batchId?: string | null // kirim nakladnoyi raqami
  customerId?: string | null // doimiy mijoz
  priceUsd?: number | null // dollar kirimda: $ narx
  rate?: number | null // kirim paytidagi kurs
}

export interface ShopSettings {
  shopName: string
  address: string
  phone: string
  receiptFooter: string
  usdRate?: number // 1$ = ? so'm
  rateDate?: string
}

export interface Expense {
  id: string
  date: string // ISO
  category: string
  amount: number
  note: string
  payment: Payment
  seller?: string | null
  createdAt: string
}

export const EXPENSE_CATEGORIES = [
  'Ijara', 'Ish haqi', 'Elektr, gaz, suv', 'Transport va yetkazib berish', "Soliq va majburiy to'lovlar",
  'Internet va aloqa', "Xo'jalik mollari", "Ta'mirlash", 'Reklama', 'Boshqa',
]

export interface Customer {
  id: string
  name: string
  phone: string
  note: string
  createdAt: string
  debt: number // hozirgi qarzi (manfiy — oldindan to'lagan)
  bought: number // jami xaridlari
  receipts: number
  lastDate: string | null
}

export interface CustomerTx {
  id: string
  customerId: string
  type: 'pay' | 'debt' // to'lov yoki qo'lda yozilgan qarz
  amount: number
  payment: Payment | null
  note: string
  saleId: string | null
  date: string
  seller: string | null
}

export interface WarehouseData {
  customers: Customer[]
  customerTx: CustomerTx[]
  products: Product[]
  movements: Movement[]
  categories: string[]
  expenses: Expense[]
  settings: ShopSettings
}

export interface CartItem {
  productId: string
  qty: number
  price: number
  sellPrice?: number // faqat kirimda: yangi sotuv narxi
  priceUsd?: number // faqat kirimda: dollar tovarning $ narxi
}
