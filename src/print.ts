// Chek va etiketkalarni chop etish: #print-root ichidagi tayyor HTML alohida yashirin iframe'ga
// ko'chiriladi va faqat o'sha toza sahifa printerga yuboriladi. Dastur sahifasining uslublari,
// brauzerning sarlavha/manzil yozuvlari (chetlar 0 bo'lgani uchun) aralashmaydi.

/** Joriy sahifadagi chek/etiketka uslublarini yig'adi (.receipt..., .label...) */
function collectCss(): string {
  const out: string[] = []
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try { rules = sheet.cssRules } catch { continue }
    for (const r of Array.from(rules)) {
      if (r instanceof CSSStyleRule && /\.(receipt|r-|label|labels-)/.test(r.selectorText)) out.push(r.cssText)
    }
  }
  return out.join('\n')
}

/**
 * #print-root ni chop etadi.
 * @param pageCss  masalan "@page { size: 40mm 30mm; margin: 0 }"
 * @param extraCss qo'shimcha uslub (chek eni va h.k.)
 */
export function printPrintRoot(pageCss: string | ((doc: Document) => string), extraCss = '') {
  const root = document.getElementById('print-root')
  if (!root || !root.innerHTML.trim()) return
  document.getElementById('print-frame')?.remove()
  const frame = document.createElement('iframe')
  frame.id = 'print-frame'
  frame.setAttribute('aria-hidden', 'true')
  Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0', visibility: 'hidden' })
  document.body.appendChild(frame)
  const doc = frame.contentDocument!
  doc.open()
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>&#8203;</title><style>
    html, body { margin: 0; padding: 0; background: #fff; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    ${collectCss()}
    ${extraCss}
  </style></head><body>${root.innerHTML}</body></html>`)
  doc.close()
  const win = frame.contentWindow!
  // Sahifa o'lchami: tayyor matn yoki chizilgan kontentga qarab hisoblanadi (chek uzunligi)
  const addPage = () => {
    const st = doc.createElement('style')
    st.textContent = typeof pageCss === 'function' ? pageCss(doc) : pageCss
    doc.head.appendChild(st)
  }
  // Shriftlar yuklanishini kutib, chop etamiz
  const go = () => { addPage(); win.focus(); win.print(); setTimeout(() => frame.remove(), 1000) }
  const fonts = (doc as Document & { fonts?: FontFaceSet }).fonts
  setTimeout(() => (fonts ? fonts.ready.then(go) : go()), 100)
}

/** Chek qog'ozi eni: 80 mm (odatiy) yoki 58 mm */
export type ReceiptPaper = '80' | '58'
export const getReceiptPaper = (): ReceiptPaper => (localStorage.getItem('ombor-receipt-paper') === '58' ? '58' : '80')
export const setReceiptPaper = (p: ReceiptPaper) => localStorage.setItem('ombor-receipt-paper', p)

export function receiptCss(paper: ReceiptPaper = getReceiptPaper()) {
  return paper === '58'
    ? `.receipt { width: 48mm !important; font-size: 12px !important; padding: 1mm 0 6mm !important; }
       .receipt .r-shop { font-size: 15px !important; } .receipt .r-huge { font-size: 17px !important; }
       .receipt .r-big { font-size: 14px !important; } .receipt .r-status { font-size: 13px !important; }
       .receipt .r-brand { font-size: 20px !important; } .receipt .r-bolt { width: 5.5mm !important; height: 5.5mm !important; }
       .receipt .r-tagline { font-size: 9px !important; letter-spacing: 1.2px !important; }`
    : `.receipt { width: 72mm !important; }`
}

/** Chek sahifasi: eni — qog'oz eni, bo'yi — chekning o'zi (ortiqcha bo'sh qog'oz chiqmaydi) */
export function receiptPage(paper: ReceiptPaper = getReceiptPaper()) {
  return (doc: Document) => {
    const el = doc.querySelector('.receipt')
    const mm = el ? Math.ceil(el.getBoundingClientRect().height * 25.4 / 96) + 3 : 200
    return `@page { size: ${paper}mm ${Math.max(40, mm)}mm; margin: 0; } body { display: flex; justify-content: center; }`
  }
}
