import { createPortal } from 'react-dom'
import type { Movement, ShopSettings } from '../types'
import { paymentLabel } from '../types'
import { fmtDate, fmtNum } from '../utils'

const money = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

/** Chek: 58/80 mm termoprinter uchun. Faqat chop etishda ko'rinadi. */
export function Receipt({ lines, settings }: { lines: Movement[]; settings: ShopSettings }) {
  if (!lines.length) return null
  const first = lines[0]
  const total = lines.reduce((s, m) => s + m.qty * m.price, 0)
  return (
    <div className="receipt">
      <div className="r-center r-bold r-big">{settings.shopName || "Do'kon"}</div>
      {settings.address && <div className="r-center">{settings.address}</div>}
      {settings.phone && <div className="r-center">Tel: {settings.phone}</div>}
      <div className="r-sep" />
      <div className="r-row"><span>Chek №</span><span className="r-bold">{first.saleId}</span></div>
      <div className="r-row"><span>Sana</span><span>{fmtDate(first.date)}</span></div>
      {first.seller && <div className="r-row"><span>Sotuvchi</span><span>{first.seller}</span></div>}
      {first.counterparty && <div className="r-row"><span>Mijoz</span><span>{first.counterparty}</span></div>}
      <div className="r-sep" />
      {lines.map((m, i) => (
        <div key={m.id} className="r-item">
          <div>{i + 1}. {m.productName}</div>
          <div className="r-row"><span>{fmtNum(m.qty)} x {money(m.price)}</span><span>{money(m.qty * m.price)}</span></div>
        </div>
      ))}
      <div className="r-sep" />
      <div className="r-row r-bold r-big"><span>JAMI:</span><span>{money(total)} so'm</span></div>
      <div className="r-row"><span>To'lov</span><span>{paymentLabel(first.payment)}</span></div>
      <div className="r-sep" />
      {settings.receiptFooter && <div className="r-center">{settings.receiptFooter}</div>}
    </div>
  )
}

/** Chekni sahifa ustida maxsus joyga chiqarib, brauzer chop etish oynasini ochadi */
export function PrintArea({ lines, settings }: { lines: Movement[] | null; settings: ShopSettings }) {
  if (!lines) return null
  return createPortal(<Receipt lines={lines} settings={settings} />, document.getElementById('print-root')!)
}

export function printReceipt() {
  document.body.classList.add('printing-receipt')
  const done = () => { document.body.classList.remove('printing-receipt'); window.removeEventListener('afterprint', done) }
  window.addEventListener('afterprint', done)
  // Portal chizilishiga vaqt beramiz
  setTimeout(() => window.print(), 50)
}
