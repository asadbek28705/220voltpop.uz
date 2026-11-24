import { useState } from 'react'
import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material'
import type { Warehouse } from '../store'
import type { Customer, Payment } from '../types'
import { PAYMENTS } from '../types'
import { attempt } from '../api'
import { fmtMoney } from '../utils'

interface Props { wh: Warehouse; customer: Customer; type: 'pay' | 'debt'; onClose: () => void; onDone?: (msg: string) => void }

const num = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.'))

/** Qarz to'lovini qabul qilish yoki qo'lda qarz yozish (masalan, dasturdan oldingi eski qarz) */
export default function DebtDialog({ wh, customer, type, onClose, onDone }: Props) {
  const [amount, setAmount] = useState(type === 'pay' && customer.debt > 0 ? String(customer.debt) : '')
  const [payment, setPayment] = useState<Payment>('naqd')
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const a = Math.round(num(amount) || 0)
  const after = customer.debt + (type === 'debt' ? a : -a)

  const save = async () => {
    if (!(a > 0)) return setErr('Summani kiriting')
    setBusy(true)
    const r = await attempt(() => wh.addCustomerTx(customer.id, { type, amount: a, payment: type === 'pay' ? payment : undefined, note: note.trim() }))
    setBusy(false)
    if (!r.ok) return setErr(r.error)
    onDone?.(type === 'pay' ? `${customer.name}: ${fmtMoney(a)} to'lov qabul qilindi` : `${customer.name}: ${fmtMoney(a)} qarz yozildi`)
    onClose()
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{type === 'pay' ? "Qarz to'lovini qabul qilish" : "Qarz qo'shish"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography>
            <b>{customer.name}</b> · hozirgi qarzi:{' '}
            <Typography component="span" sx={{ fontWeight: 700, color: customer.debt > 0 ? 'error.main' : 'text.primary' }}>{fmtMoney(customer.debt)}</Typography>
          </Typography>
          <TextField label="Summa" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" autoFocus
            slotProps={{ input: { endAdornment: <InputAdornment position="end">so'm</InputAdornment> } }} />
          {type === 'pay' && (
            <ToggleButtonGroup exclusive fullWidth size="small" value={payment} onChange={(_, v) => v && setPayment(v)}>
              {PAYMENTS.map((p) => <ToggleButton key={p.value} value={p.value}>{p.value === 'otkazma' ? "O'tkazma" : p.label}</ToggleButton>)}
            </ToggleButtonGroup>
          )}
          <TextField label="Izoh" value={note} onChange={(e) => setNote(e.target.value)}
            placeholder={type === 'debt' ? "Masalan: daftardagi eski qarz" : ''} />
          {a > 0 && (
            <Alert severity={after > 0 ? 'warning' : 'success'} icon={false}>
              {after > 0 ? <>Qoladigan qarz: <b>{fmtMoney(after)}</b></> : after === 0 ? <b>Qarz to'liq yopiladi</b> : <>Ortiqcha to'lov (keyingi xaridga): <b>{fmtMoney(-after)}</b></>}
            </Alert>
          )}
          {err && <Alert severity="error">{err}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Bekor qilish</Button>
        <Button variant="contained" color={type === 'pay' ? 'primary' : 'warning'} onClick={save} disabled={busy}>
          {type === 'pay' ? 'Qabul qilish' : "Qarz yozish"}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
