import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import type { Product } from '../types'
import { t as tr } from '../i18n'

export interface LabelFormat {
  key: string
  label: string
  width: number // mm
  height: number // mm
  sheet?: { cols: number; rows: number } // A4 varaq; bo'lmasa — termo-rulon (har etiketka alohida sahifa)
}

export const LABEL_FORMATS: LabelFormat[] = [
  { key: 't58x40', label: tr('Termo etiketka 58×40 mm'), width: 58, height: 40 },
  { key: 't40x30', label: tr('Termo etiketka 40×30 mm'), width: 40, height: 30 },
  { key: 'a4x24', label: tr('A4 varaq — 24 ta (70×37 mm)'), width: 70, height: 37.125, sheet: { cols: 3, rows: 8 } },
  { key: 'a4x40', label: tr('A4 varaq — 40 ta (52,5×29,7 mm)'), width: 52.5, height: 29.7, sheet: { cols: 4, rows: 10 } },
]

const isEan13 = (c: string) => /^\d{13}$/.test(c)

/** Shtrix-kod rasmi (SVG). EAN-13 bo'lmasa — CODE128. */
export function BarcodeSvg({ code, height, fontSize, width = 1.6 }: { code: string; height: number; fontSize: number; width?: number }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!ref.current || !code) return
    try {
      JsBarcode(ref.current, code, {
        format: isEan13(code) ? 'EAN13' : 'CODE128', height, width, fontSize, textMargin: 1,
        // Chetlardagi bo'sh joy (quiet zone) — usiz skaner kodni o'qiy olmaydi
        marginTop: 0, marginBottom: 0, marginLeft: Math.ceil(10 * width), marginRight: Math.ceil(8 * width),
        background: '#ffffff',
      })
    } catch {
      JsBarcode(ref.current, code, { format: 'CODE128', height, width, fontSize, marginTop: 0, marginBottom: 0, marginLeft: Math.ceil(10 * width), marginRight: Math.ceil(10 * width), textMargin: 1, background: '#ffffff' })
    }
  }, [code, height, fontSize, width])
  return <svg ref={ref} style={{ maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto' }} />
}

const money = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

/** Bitta etiketka — o'lchamlari mm da, ekranda ham chop etishda ham bir xil */
export function Label({ product, format, showPrice, shopName }: { product: Product; format: LabelFormat; showPrice: boolean; shopName?: string }) {
  const PX = 96 / 25.4 // 1 mm = 3.78 px
  const small = format.height < 25
  const padX = small ? 0.8 : 2.5
  const padY = small ? 1 : 1.8
  const nameSize = small ? 6.5 : format.height < 32 ? 7.5 : 9
  const priceSize = small ? 8 : format.height < 32 ? 10 : 13
  const digits = small ? 8 : 10
  // EAN-13 = 95 modul + ikki chetda ~7 modul bo'sh joy (skaner uchun shart)
  const module = Math.min(2.2, ((format.width - 2 * padX) * PX) / 115)
  // Matnlardan qolgan balandlik — shtrix-kodga
  const textMm = (shopName && !small ? 2.6 : 0) + (small ? 1 : 2) * nameSize * 0.42 + (showPrice ? priceSize * 0.42 : 0) + digits * 0.38 + 1.5
  const barH = Math.max(14, Math.round((format.height - 2 * padY - textMm) * PX))
  return (
    <div className="label" style={{ width: `${format.width}mm`, height: `${format.height}mm`, padding: `${padY}mm ${padX}mm` }}>
      {shopName && !small && <div className="label-shop">{shopName}</div>}
      <div className="label-name" style={{ fontSize: `${nameSize}pt`, WebkitLineClamp: small ? 1 : 2 }}>{product.name}</div>
      {showPrice && (
        <div className="label-price" style={{ fontSize: `${priceSize}pt` }}>
          {money(product.sellPrice)} {tr("so'm")}{product.unit !== 'dona' ? ` / ${tr(product.unit)}` : ''}
        </div>
      )}
      <div className="label-code">
        <BarcodeSvg code={product.barcode} height={barH} fontSize={digits * 1.3} width={module} />
      </div>
    </div>
  )
}
