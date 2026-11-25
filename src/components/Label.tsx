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

/**
 * Shtrix-kod rasmi (SVG), o'lchami millimetrda.
 * moduleMm — eng ingichka chiziq eni. Termoprinterlar 203 dpi (1 nuqta = 0.125 mm): eni nuqtaga karrali bo'lsa,
 * chiziqlar bir xil chiqadi va skaner oson o'qiydi. EAN-13 bo'lmasa — CODE128.
 */
export function BarcodeSvg({ code, moduleMm, barMm, digitsMm }: { code: string; moduleMm: number; barMm: number; digitsMm: number }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    const svg = ref.current
    if (!svg || !code) return
    // Birlik = 1 modul; keyin butun rasm mm ga cho'ziladi
    const opts = {
      height: barMm / moduleMm, width: 1, fontSize: digitsMm / moduleMm, textMargin: 0.3 / moduleMm, margin: 0,
      marginTop: 0, marginBottom: 0, marginLeft: 11, marginRight: 7, background: '#ffffff', font: 'Arial',
    }
    try { JsBarcode(svg, code, { ...opts, format: isEan13(code) ? 'EAN13' : 'CODE128' }) }
    catch { JsBarcode(svg, code, { ...opts, format: 'CODE128', marginLeft: 10, marginRight: 10 }) }
    // JsBarcode o'lchamni "143px" ko'rinishida yozadi — birliklarni mm ga aylantiramiz (atribut orqali: React style'ni qayta yozmaydi)
    const w = parseFloat(svg.getAttribute('width') ?? ''), h = parseFloat(svg.getAttribute('height') ?? '')
    if (!(w > 0 && h > 0)) return
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
    svg.setAttribute('preserveAspectRatio', 'none')
    svg.setAttribute('shape-rendering', 'crispEdges')
    svg.setAttribute('width', `${(w * moduleMm).toFixed(3)}mm`)
    svg.setAttribute('height', `${(h * moduleMm).toFixed(3)}mm`)
  }, [code, moduleMm, barMm, digitsMm])
  return <svg ref={ref} style={{ display: 'block', margin: '0 auto' }} />
}

const money = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
const DOT = 0.125 // 203 dpi termoprinter nuqtasi, mm

/** Bitta etiketka — o'lchamlari mm da, ekranda ham chop etishda ham bir xil */
export function Label({ product, format, showPrice, shopName }: { product: Product; format: LabelFormat; showPrice: boolean; shopName?: string }) {
  const small = format.height < 25
  const padX = format.width <= 45 ? 1.5 : 2.5
  const padY = small ? 0.8 : 1.2
  const nameSize = small ? 6.5 : format.height < 32 ? 7.5 : 9 // pt
  const nameLines = small ? 1 : 2
  const priceSize = small ? 8 : format.height < 32 ? 10 : 13 // pt
  const PT = 0.3528 // 1 pt = 0.3528 mm
  const showShop = !!shopName && !small && format.height >= 35
  // EAN-13: 95 modul + bo'sh chetlar (11 + 7) = 113 modul. Modul — butun nuqtalar soni.
  const dots = Math.max(1, Math.min(4, Math.floor((format.width - 2 * padX) / (113 * DOT))))
  const moduleMm = dots * DOT
  const digitsMm = small ? 2 : 2.6
  const textMm = (showShop ? 2.4 : 0) + nameLines * nameSize * PT * 1.15 + (showPrice ? priceSize * PT * 1.15 : 0) + digitsMm + 0.8
  const barMm = Math.max(5, Math.min(18, format.height - 2 * padY - textMm))
  return (
    <div className="label" style={{ width: `${format.width}mm`, height: `${format.height}mm`, padding: `${padY}mm ${padX}mm` }}>
      {showShop && <div className="label-shop">{shopName}</div>}
      <div className="label-name" style={{ fontSize: `${nameSize}pt`, WebkitLineClamp: nameLines }}>{product.name}</div>
      {showPrice && (
        <div className="label-price" style={{ fontSize: `${priceSize}pt` }}>
          {money(product.sellPrice)} {tr("so'm")}{product.unit !== 'dona' ? ` / ${tr(product.unit)}` : ''}
        </div>
      )}
      <div className="label-code">
        <BarcodeSvg code={product.barcode} moduleMm={moduleMm} barMm={barMm} digitsMm={digitsMm} />
      </div>
    </div>
  )
}
