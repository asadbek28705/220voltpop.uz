import { createPortal } from 'react-dom'
import type { Customer, Movement, ShopSettings } from '../types'
import { paymentLabel } from '../types'
import { fmtDate, fmtNum } from '../utils'
import { t as tr } from '../i18n'
import { printPrintRoot, receiptCss, receiptPage } from '../print'

const money = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

/** Chek tepasi: chaqmoq belgisi, katta nom, ikki tomoni chiziqli shior, manzil va telefon */
export function ReceiptHeader({ settings }: { settings: ShopSettings }) {
  const name = settings.shopName || tr("Do'kon")
  return (
    <div className="r-head">
      <div className="r-brand">
        <svg className="r-bolt" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 1.5 4 13.5h6.5L9 22.5l10-13h-6.8z" /></svg>
        <span>{name}</span>
      </div>
      {settings.shopTagline && <div className="r-tagline"><span>{settings.shopTagline}</span></div>}
      {settings.address && <div className="r-center r-small">{settings.address}</div>}
      {settings.phone && <div className="r-center r-small">{tr("Tel:")} {settings.phone}</div>}
    </div>
  )
}

/** To'lov holati — chekda katta ramkada chiqadi */
function payStatus(payment: string | null | undefined, kind: 'sale' | 'return') {
  if (kind === 'return') {
    if (payment === 'nasiya') return tr("Qarzidan ayrildi")
    if (payment === 'karta') return tr("Pul kartaga qaytarildi")
    if (payment === 'otkazma') return tr("Pul o'tkazma orqali qaytarildi")
    return tr("Pul naqd qaytarildi")
  }
  if (payment === 'nasiya') return tr("Nasiyaga olindi")
  if (payment === 'karta') return tr("Kartadan to'landi")
  if (payment === 'otkazma') return tr("O'tkazma orqali to'landi")
  return tr("Naqd pul bilan to'landi")
}

interface ReceiptProps {
  lines: Movement[]
  settings: ShopSettings
  paid?: number // nasiyada darhol to'langan qism
  kind?: 'sale' | 'return'
  customer?: Customer | null // nasiya bo'lsa umumiy qarzi ko'rsatiladi
  returned?: number // shu chekdan keyin qaytarilgan summa
}

/** Chek: 58/80 mm termoprinter uchun. Faqat chop etishda ko'rinadi. */
export function Receipt({ lines, settings, paid, kind = 'sale', customer, returned }: ReceiptProps) {
  if (!lines.length) return null
  const first = lines[0]
  const total = lines.reduce((s, m) => s + m.qty * m.price, 0)
  const ret = kind === 'return'
  const nasiya = first.payment === 'nasiya'
  return (
    <div className="receipt">
      <ReceiptHeader settings={settings} />
      <div className="r-sep2" />
      {ret ? <>
        <div className="r-center r-huge">{tr("QAYTARISH")} №{first.batchId}</div>
        <div className="r-row"><span>{tr("Asl chek")}</span><span className="r-bold">№{first.saleId}</span></div>
      </> : (
        <div className="r-row r-big"><span>{tr("Chek №")}</span><span className="r-bold">{first.saleId}</span></div>
      )}
      <div className="r-row"><span>{tr("Sana")}</span><span>{fmtDate(first.date)}</span></div>
      {first.seller && <div className="r-row"><span>{tr("Sotuvchi")}</span><span>{first.seller}</span></div>}
      {first.counterparty && <div className="r-row"><span>{tr("Mijoz")}</span><span className="r-bold">{first.counterparty}</span></div>}
      {customer?.phone && <div className="r-row"><span>{tr("Telefon")}</span><span>{customer.phone}</span></div>}
      <div className="r-sep" />
      {lines.map((m, i) => (
        <div key={m.id} className="r-item">
          <div className="r-name">{i + 1}. {m.productName}</div>
          <div className="r-row"><span>{fmtNum(m.qty)} x {money(m.price)}</span><span className="r-bold">{money(m.qty * m.price)}</span></div>
        </div>
      ))}
      <div className="r-sep" />
      <div className="r-row r-small"><span>{tr("Tovarlar")}</span><span>{tr("{0} xil", lines.length)}</span></div>
      <div className="r-row r-huge"><span>{ret ? tr("QAYTARILDI:") : tr('JAMI:')}</span><span>{money(total)}</span></div>
      <div className="r-center r-small">{tr("so'm")}</div>

      <div className={'r-status' + (nasiya && !ret ? ' r-inv' : '')}>{payStatus(first.payment, kind)}</div>
      {!ret && <div className="r-row"><span>{tr("To'lov turi")}</span><span className="r-bold">{paymentLabel(first.payment)}</span></div>}

      {!ret && nasiya && <>
        <div className="r-row"><span>{tr("Hozir to'landi")}</span><span>{money(paid ?? 0)}</span></div>
        <div className="r-row r-big r-bold"><span>{tr("Qarzga yozildi")}</span><span>{money(total - (paid ?? 0))}</span></div>
        {customer && <div className="r-row r-bold"><span>{tr("Umumiy qarzi")}</span><span>{money(customer.debt)}</span></div>}
        <div className="r-sign">{tr("Mijoz imzosi:")} ______________</div>
      </>}
      {ret && first.note && <div className="r-row"><span>{tr("Sabab")}</span><span>{first.note}</span></div>}
      {ret && nasiya && customer && <div className="r-row r-bold"><span>{tr("Qolgan qarzi")}</span><span>{money(customer.debt)}</span></div>}
      {ret && <div className="r-sign">{tr("Mijoz imzosi:")} ______________</div>}
      {!ret && !!returned && <div className="r-row r-bold"><span>{tr("Qaytarilgan")}</span><span>−{money(returned)}</span></div>}

      <div className="r-sep" />
      {settings.receiptFooter && <div className="r-center r-bold">{settings.receiptFooter}</div>}
      {!ret && <div className="r-center r-small">{tr("Tovarni chek bilan qaytarish mumkin")}</div>}
    </div>
  )
}

/** Chekni sahifa ustida maxsus joyga chiqarib, brauzer chop etish oynasini ochadi */
export function PrintArea(props: Omit<ReceiptProps, 'lines'> & { lines: Movement[] | null }) {
  if (!props.lines) return null
  return createPortal(<Receipt {...props} lines={props.lines} />, document.getElementById('print-root')!)
}

export function printReceipt() {
  // Portal chizilishiga vaqt beramiz, keyin faqat chekning o'zi alohida sahifada chop etiladi
  setTimeout(() => printPrintRoot(receiptPage(), receiptCss()), 50)
}
