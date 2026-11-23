import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import type { Product } from '../types'

export interface LabelFormat {
  key: string
  label: string
  width: number // mm
  height: number // mm
  sheet?: { cols: number; rows: number } // A4 varaq; bo'lmasa — termo-rulon (har etiketka alohida sahifa)
}

export const LABEL_FORMATS: LabelFormat[] = [
  { key: 't58x40', label: 'Termo etiketka 58×40 mm', width: 58, height: 40 },
  { key: 't40x30', label: 'Termo etiketka 40×30 mm', width: 40, height: 30 },
  { key: 't30x20', label: 'Termo etiketka 30×20 mm (kichik)', width: 30, height: 20 },
  { key: 'a4x24', label: 'A4 varaq — 24 ta (70×37 mm)', width: 70, height: 37.125, sheet: { cols: 3, rows: 8 } },
  { key: 'a4x40', label: 'A4 varaq — 40 ta (52,5×29,7 mm)', width: 52.5, height: 29.7, sheet: { cols: 4, rows: 10 } },
]

const isEan13 = (c: string) => /^\d{13}$/.test(c)

/** Shtrix-kod rasmi (SVG). EAN-13 bo'lmasa — CODE128. */
export function BarcodeSvg({ code, height, fontSize, width = 1.6 }: { code: string; height: number; fontSize: number; width?: number }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!ref.current || !code) return
    try {
      JsBarcode(ref.current, code, {
        format: isEan13(code) ? 'EAN13' : 'CODE128', height, width, fontSize, margin: 0, textMargin: 1,
        flat: true, background: 'transparent',
      })
    } catch {
      JsBarcode(ref.current, code, { format: 'CODE128', height, width, fontSize, margin: 0, textMargin: 1, background: 'transparent' })
    }
  }, [code, height, fontSize, width])
  return <svg ref={ref} style={{ maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto' }} />
}

const money = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

/** Bitta etiketka — o'lchamlari mm da, ekranda ham chop etishda ham bir xil */
export function Label({ product, format, showPrice, shopName }: { product: Product; format: LabelFormat; showPrice: boolean; shopName?: string }) {
  const small = format.height < 25
  const nameSize = small ? 6.5 : format.height < 32 ? 7.5 : 9
  const barH = small ? 22 : format.height < 32 ? 30 : 40
  return (
    <div className="label" style={{ width: `${format.width}mm`, height: `${format.height}mm`, padding: small ? '1mm 1.5mm' : '1.8mm 2.5mm' }}>
      {shopName && !small && <div className="label-shop">{shopName}</div>}
      <div className="label-name" style={{ fontSize: `${nameSize}pt`, WebkitLineClamp: small ? 1 : 2 }}>{product.name}</div>
      {showPrice && (
        <div className="label-price" style={{ fontSize: `${small ? 8 : format.height < 32 ? 10 : 13}pt` }}>
          {money(product.sellPrice)} so'm{product.unit !== 'dona' ? ` / ${product.unit}` : ''}
        </div>
      )}
      <div className="label-code">
        <BarcodeSvg code={product.barcode} height={barH} fontSize={small ? 9 : 11} width={small ? 1.1 : 1.5} />
      </div>
    </div>
  )
}
