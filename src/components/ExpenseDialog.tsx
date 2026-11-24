import { useState } from 'react'
import {
  Alert, Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, Stack, TextField,
  ToggleButton, ToggleButtonGroup, Typography, useMediaQuery, useTheme,
} from '@mui/material'
import type { Warehouse } from '../store'
import type { Payment } from '../types'
import { EXPENSE_CATEGORIES, PAYMENTS } from '../types'
import { attempt } from '../api'
import { today } from '../stats'
import { fmtMoney } from '../utils'
import { t as tr } from '../i18n'

export default function ExpenseDialog({ wh, onClose }: { wh: Warehouse; onClose: () => void }) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down('sm'))
  const used = wh.data.expenses.map((e) => e.category)
  const options = [...new Set([...EXPENSE_CATEGORIES, ...used])]
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [payment, setPayment] = useState<Payment>('naqd')
  const [date, setDate] = useState(today())
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const value = Number(amount.replace(/\s/g, '').replace(',', '.')) || 0

  const save = async () => {
    if (!category.trim()) return setErr(tr("Xarajat turini tanlang"))
    if (!(value > 0)) return setErr(tr("Summani kiriting"))
    // Bugungi sana — hozirgi vaqt bilan; o'tgan kun — kun o'rtasi bilan saqlanadi
    const iso = date === today() ? undefined : new Date(date + 'T12:00:00').toISOString()
    setBusy(true)
    const r = await attempt(() => wh.addExpense({ category: category.trim(), amount: value, note: note.trim(), payment, date: iso }))
    setBusy(false)
    if (!r.ok) return setErr(r.error)
    onClose()
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" fullScreen={fullScreen}>
      <DialogTitle>{tr("Yangi xarajat")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Autocomplete freeSolo options={options} inputValue={category} onInputChange={(_, v) => setCategory(v)}
            renderInput={(params) => <TextField {...params} label={tr("Xarajat turi *")} autoFocus />} />
          <TextField label={tr("Summa *")} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal"
            helperText={value > 0 ? fmtMoney(value) : ' '}
            slotProps={{ input: { endAdornment: <InputAdornment position="end">{tr("so'm")}</InputAdornment> } }} />
          <TextField label={tr("Izoh")} value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("Masalan: noyabr ijarasi, Ali — ish haqi")} />
          <Stack spacing={0.75}>
            <Typography variant="body2" color="text.secondary">{tr("To'lov usuli")}</Typography>
            <ToggleButtonGroup exclusive fullWidth size="small" value={payment} onChange={(_, v) => v && setPayment(v)}>
              {PAYMENTS.map((p) => <ToggleButton key={p.value} value={p.value}>{p.value === 'otkazma' ? tr("O'tkazma") : p.label}</ToggleButton>)}
            </ToggleButtonGroup>
          </Stack>
          <TextField type="date" label={tr("Sana")} value={date} onChange={(e) => setDate(e.target.value)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: today() } }} />
          {err && <Alert severity="error">{err}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{tr("Bekor qilish")}</Button>
        <Button variant="contained" onClick={save} disabled={busy}>{tr("Saqlash")}</Button>
      </DialogActions>
    </Dialog>
  )
}
