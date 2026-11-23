import type { Product, WarehouseData } from './types'
import { DEFAULT_CATEGORIES } from './types'
import { uid } from './utils'

const p = (
  name: string, sku: string, category: string, unit: Product['unit'],
  buyPrice: number, sellPrice: number, qty: number, minQty: number, location: string,
): Product => ({ id: uid(), name, sku, category, unit, buyPrice, sellPrice, qty, minQty, location, createdAt: new Date().toISOString() })

const C = DEFAULT_CATEGORIES

export const seedData = (): WarehouseData => ({
  categories: [...C],
  movements: [],
  products: [
    p('Sement M400 (50 kg)', 'SEM-400', C[0], 'qop', 52000, 60000, 120, 30, 'A-1'),
    p('Shpaklyovka (25 kg)', 'SHP-25', C[0], 'qop', 68000, 80000, 18, 20, 'A-2'),
    p("Pishgan g'isht", 'GSH-01', C[1], 'dona', 1100, 1400, 5000, 1000, 'Hovli'),
    p('Gazoblok 600x300x200', 'GZB-20', C[1], 'dona', 14000, 17000, 240, 100, 'Hovli'),
    p('PPR quvur 20 mm', 'PPR-20', C[2], 'metr', 5500, 7500, 400, 100, 'B-1'),
    p('PPR quvur 25 mm', 'PPR-25', C[2], 'metr', 8000, 10500, 60, 100, 'B-1'),
    p('PPR burchak 20 mm (90°)', 'PPR-B20', C[2], 'dona', 1200, 2000, 300, 50, 'B-2'),
    p('Kanalizatsiya quvuri 110 mm', 'KAN-110', C[2], 'metr', 22000, 28000, 45, 20, 'B-3'),
    p('Oshxona smesiteli', 'SMS-01', C[3], 'dona', 180000, 240000, 12, 5, 'C-1'),
    p('Sharli kran 1/2"', 'KRN-12', C[3], 'dona', 35000, 45000, 3, 10, 'C-2'),
    p('Unitaz (kompakt)', 'UNT-01', C[4], 'komplekt', 850000, 1100000, 6, 3, 'D-1'),
    p('Rakovina 60 sm', 'RKV-60', C[4], 'dona', 320000, 420000, 8, 3, 'D-2'),
    p("Emulsiya bo'yoq oq (10 l)", 'BOY-10', C[5], 'pachka', 145000, 180000, 25, 10, 'E-1'),
    p('Shurup 4x50 (1 kg)', 'SHR-450', C[8], 'kg', 28000, 36000, 40, 10, 'F-1'),
  ],
})
