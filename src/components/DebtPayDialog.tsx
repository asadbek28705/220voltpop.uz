import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, Stack, TextField,
  ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material'
import PrintIcon from '@mui/icons-material/PrintOutlined'
import CheckIcon from '@mui/icons-material/CheckCircleRounded'
import type { Warehouse } from '../store'
import type { Customer, CustomerTx, Payment, ShopSettings } from '../types'
import { PAYMENTS, paymentLabel } from '../types'
import { attempt } from '../api'
import { fmtDate, fmtMoney } from '../utils'
import { matchCustomer } from './Customers'
import { ReceiptHeader, printReceipt } from './Receipt'
import { t as tr } from '../i18n'

const num = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.'))
const money = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')

/** Qarz to'lovi cheki (termoprinter) */
function PayReceipt({ tx, customer, settings }: { tx: CustomerTx; customer: Customer; settings: ShopSettings }) {
  return (
    <div className="receipt">
      <ReceiptHeader settings={settings} />
      <div className="r-sep2" />
      <div className="r-center r-huge">{tr("QARZ TO'LOVI")}</div>
      <div className="r-row"><span>{tr("Sana")}</span><span>{fmtDate(tx.date)}</span></div>
      {tx.seller && <div className="r-row"><span>{tr("Qabul qildi")}</span><span>{tx.seller}</span></div>}
      <div className="r-row"><span>{tr("Mijoz")}</span><span className="r-bold">{customer.name}</span></div>
      {customer.phone && <div className="r-row"><span>{tr("Telefon")}</span><span>{customer.phone}</span></div>}
      <div className="r-sep" />
      <div className="r-row r-huge"><span>{tr("TO'LANDI:")}</span><span>{money(tx.amount)} <small style={{ fontSize: '60%' }}>{tr("so'm")}</small></span></div>
      <div className="r-status">{paymentLabel(tx.payment)}</div>
      {customer.debt > 0
        ? <div className="r-row r-big r-bold"><span>{tr("Qolgan qarz")}</span><span>{money(customer.debt)}</span></div>
        : <div className="r-center r-bold r-big">{customer.debt === 0 ? tr("Qarz to'liq yopildi") : tr("Oldindan to'lov: {0}", money(-customer.debt))}</div>}
      {tx.note && <div className="r-row"><span>{tr("Izoh")}</span><span>{tx.note}</span></div>}
      <div className="r-sign">{tr("Qabul qiluvchi imzosi:")} __________</div>
      <div className="r-sep" />
      {settings.receiptFooter && <div className="r-center r-bold">{settings.receiptFooter}</div>}
    </div>
  )
}

/**
 * Kassadan qarz to'lovini qabul qilish: mijozni tanlash → summa → to'lov usuli → chek.
 * Sotuvchi ham qila oladi (faqat to'lov; qo'lda qarz yozish — admin).
 */
export default function DebtPayDialog({ wh, onClose }: { wh: Warehouse; onClose: () => void }) {
  const [customerId, setCustomerId] = useState('')
  const [amount, setAmount] = useState('')
  const [payment, setPayment] = useState<Payment>('naqd')
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ tx: CustomerTx; customer: Customer } | null>(null)

  // Qarzdorlar tepada, keyin qolganlar
  const options = useMemo(() => [...wh.data.customers].sort((a, b) => (b.debt > 0 ? 1 : 0) - (a.debt > 0 ? 1 : 0) || b.debt - a.debt), [wh.data.customers])
  const c = wh.data.customers.find((x) => x.id === customerId) ?? null
  const a = Math.round(num(amount) || 0)
  const after = c ? c.debt - a : 0

  const save = async () => {
    if (!c) return setErr(tr("Mijozni tanlang"))
    if (!(a > 0)) return setErr(tr("Summani kiriting"))
    setBusy(true)
    const r = await attempt(() => wh.addCustomerTx(c.id, { type: 'pay', amount: a, payment, note: note.trim() }))
    setBusy(false)
    if (!r.ok) return setErr(r.error)
    setDone(r.value)
  }

  if (done) {
    return (
      <Dialog open onClose={onClose} fullWidth maxWidth="xs">
        <DialogContent sx={{ bgcolor: 'background.default', pt: 3 }}>
          <Stack alignItems="center" spacing={0.5} sx={{ mb: 2, color: 'primary.main', fontWeight: 700 }}>
            <CheckIcon sx={{ fontSize: 48 }} />
            <span>{tr("{0}: {1} to'lov qabul qilindi", done.customer.name, fmtMoney(done.tx.amount))}</span>
          </Stack>
          <Box className="receipt-preview" sx={{ boxShadow: 1, borderRadius: 2, overflowX: 'auto' }}>
            <PayReceipt tx={done.tx} customer={done.customer} settings={wh.data.settings} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose}>{tr("Yopish")}</Button>
          <Button variant="contained" size="large" startIcon={<PrintIcon />} onClick={printReceipt}>{tr("Chekni chop etish")}</Button>
        </DialogActions>
        {createPortal(<PayReceipt tx={done.tx} customer={done.customer} settings={wh.data.settings} />, document.getElementById('print-root')!)}
      </Dialog>
    )
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{tr("Qarz to'lovini qabul qilish")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Autocomplete<Customer>
            options={options} value={c} autoHighlight
            onChange={(_, v) => { setCustomerId(v?.id ?? ''); setAmount(v && v.debt > 0 ? String(v.debt) : ''); setErr('') }}
            filterOptions={(opts, { inputValue }) => opts.filter((x) => matchCustomer(x, inputValue)).slice(0, 30)}
            getOptionLabel={(o) => o.name}
            isOptionEqualToValue={(x, y) => x.id === y.id}
            renderOption={(props, o) => (
              <li {...props} key={o.id}>
                <Stack direction="row" justifyContent="space-between" sx={{ width: '100%' }} spacing={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography noWrap>{o.name}</Typography>
                    {o.phone && <Typography variant="caption" color="text.secondary">{o.phone}</Typography>}
                  </Box>
                  {o.debt > 0 && <Typography variant="body2" color="error" sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{fmtMoney(o.debt)}</Typography>}
                </Stack>
              </li>
            )}
            renderInput={(params) => <TextField {...params} label={tr("Mijoz")} placeholder={tr("Ism yoki telefon bilan qidiring")} autoFocus />}
          />
          {c && (
            <Typography>
              {tr("Hozirgi qarzi:")}{' '}
              <Typography component="span" sx={{ fontWeight: 800, color: c.debt > 0 ? 'error.main' : 'text.primary' }}>{fmtMoney(c.debt)}</Typography>
            </Typography>
          )}
          <TextField label={tr("Summa")} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" disabled={!c}
            slotProps={{ input: { endAdornment: <InputAdornment position="end">{tr("so'm")}</InputAdornment> } }} />
          <ToggleButtonGroup exclusive fullWidth size="small" value={payment} onChange={(_, v) => v && setPayment(v)}>
            {PAYMENTS.map((p) => <ToggleButton key={p.value} value={p.value}>{p.value === 'otkazma' ? tr("O'tkazma") : p.label}</ToggleButton>)}
          </ToggleButtonGroup>
          <TextField label={tr("Izoh")} value={note} onChange={(e) => setNote(e.target.value)} />
          {c && a > 0 && (
            <Alert severity={after > 0 ? 'warning' : 'success'} icon={false}>
              {after > 0 ? <>{tr("Qoladigan qarz:")} <b>{fmtMoney(after)}</b></> : after === 0 ? <b>{tr("Qarz to'liq yopiladi")}</b> : <>{tr("Ortiqcha to'lov (keyingi xaridga):")} <b>{fmtMoney(-after)}</b></>}
            </Alert>
          )}
          {err && <Alert severity="error">{err}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{tr("Bekor qilish")}</Button>
        <Button variant="contained" onClick={save} disabled={busy || !c}>{tr("Qabul qilish")}</Button>
      </DialogActions>
    </Dialog>
  )
}
