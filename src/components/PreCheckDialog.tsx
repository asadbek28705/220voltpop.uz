import { createPortal } from 'react-dom'
import { Box, Button, Dialog, DialogActions, DialogContent, Typography } from '@mui/material'
import PrintIcon from '@mui/icons-material/PrintOutlined'
import type { Product, ShopSettings } from '../types'
import { fmtNum } from '../utils'
import { ReceiptHeader } from './Receipt'
import { printPrintRoot, receiptCss, receiptPage } from '../print'
import { t as tr } from '../i18n'

const money = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
const pad = (n: number) => String(n).padStart(2, '0')
const now = () => { const d = new Date(); return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}` }

export interface PreLine { product: Product; qty: number; price: number }

/** Prichek: savatdagi tovarlar ro'yxati va jami summa. Savdo yozilmaydi, qoldiq o'zgarmaydi. */
function PreCheck({ lines, settings, customer, seller }: { lines: PreLine[]; settings: ShopSettings; customer?: string; seller?: string }) {
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0)
  return (
    <div className="receipt">
      <ReceiptHeader settings={settings} />
      <div className="r-sep2" />
      <div className="r-center r-huge">{tr("PRICHEK")}</div>
      <div className="r-center r-small">{tr("(to'lov cheki emas)")}</div>
      <div className="r-row"><span>{tr("Sana")}</span><span>{now()}</span></div>
      {seller && <div className="r-row"><span>{tr("Sotuvchi")}</span><span>{seller}</span></div>}
      {customer && <div className="r-row"><span>{tr("Mijoz")}</span><span className="r-bold">{customer}</span></div>}
      <div className="r-sep" />
      {lines.map((l, i) => (
        <div key={l.product.id} className="r-item">
          <div className="r-name">{i + 1}. {l.product.name}</div>
          <div className="r-row"><span>{fmtNum(l.qty)} x {money(l.price)}</span><span className="r-bold">{money(l.qty * l.price)}</span></div>
        </div>
      ))}
      <div className="r-sep" />
      <div className="r-row r-small"><span>{tr("Tovarlar")}</span><span>{tr("{0} xil", lines.length)}</span></div>
      <div className="r-row r-huge"><span>{tr('JAMI:')}</span><span>{money(total)} <small style={{ fontSize: '60%' }}>{tr("so'm")}</small></span></div>
      <div className="r-status">{tr("To'lanmagan")}</div>
      <div className="r-center r-small">{tr("Narxlar bugungi kun uchun amal qiladi")}</div>
    </div>
  )
}

export default function PreCheckDialog({ lines, settings, customer, seller, onClose }: {
  lines: PreLine[]; settings: ShopSettings; customer?: string; seller?: string; onClose: () => void
}) {
  const print = () => setTimeout(() => printPrintRoot(receiptPage(), receiptCss()), 50)
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogContent sx={{ bgcolor: 'background.default', pt: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, textAlign: 'center' }}>
          {tr("Savdo yozilmaydi, ombordagi qoldiq o'zgarmaydi.")}
        </Typography>
        <Box className="receipt-preview" sx={{ boxShadow: 1, borderRadius: 2, overflowX: 'auto' }}>
          <PreCheck lines={lines} settings={settings} customer={customer} seller={seller} />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>{tr("Yopish")}</Button>
        <Button variant="contained" size="large" startIcon={<PrintIcon />} onClick={print}>{tr("Prichekni chop etish")}</Button>
      </DialogActions>
      {createPortal(<PreCheck lines={lines} settings={settings} customer={customer} seller={seller} />, document.getElementById('print-root')!)}
    </Dialog>
  )
}
