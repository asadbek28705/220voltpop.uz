import { useState } from 'react'
import {
  Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, InputAdornment, Stack, TextField, Typography,
} from '@mui/material'
import BankIcon from '@mui/icons-material/AccountBalanceOutlined'
import type { Warehouse } from '../store'
import { api, attempt } from '../api'
import { fmtDate, fmtMoney, sellFrom, toUzs } from '../utils'
import { t as tr } from '../i18n'

const num = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.'))

/** Dollar kursini o'zgartirish. Dollardagi tovarlar tannarxi avtomatik qayta hisoblanadi. */
export default function RateDialog({ wh, onClose, onDone }: { wh: Warehouse; onClose: () => void; onDone?: (msg: string) => void }) {
  const { settings, products } = wh.data
  const [rate, setRate] = useState(settings.usdRate ? String(settings.usdRate) : '')
  const [updateSell, setUpdateSell] = useState(true)
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const r = num(rate) || 0
  const usd = products.filter((p) => p.currency === 'USD')
  const withMarkup = usd.filter((p) => p.markup > 0 && p.buyPriceUsd > 0)
  const sample = withMarkup[0] ?? usd.find((p) => p.buyPriceUsd > 0)

  const fromCbu = async () => {
    setErr('')
    const x = await attempt(() => api<{ rate: number; date: string }>('GET', '/rate/cbu'))
    if (!x.ok) return setErr(x.error)
    setRate(String(x.value.rate))
    setInfo(tr("Markaziy bank kursi ({0})", x.value.date))
  }

  const save = async () => {
    setBusy(true)
    const x = await attempt(() => wh.setRate(r, updateSell))
    setBusy(false)
    if (!x.ok) return setErr(x.error)
    onDone?.(tr("Kurs saqlandi: 1$ = {0}. {1} ta tovar tannarxi qayta hisoblandi", fmtMoney(r), x.value.products) +
      (x.value.repriced ? tr(", {0} ta tovarning sotuv narxi yangilandi", x.value.repriced) : ''))
    onClose()
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{tr("Dollar kursi")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {settings.usdRate ? (
            <Typography variant="body2" color="text.secondary">
              {tr("Hozirgi:")} <b>1$ = {fmtMoney(settings.usdRate)}</b>{settings.rateDate && <> · {fmtDate(settings.rateDate)}</>}
            </Typography>
          ) : <Alert severity="info">{tr("Dollarda olinadigan tovarlar uchun kursni kiriting.")}</Alert>}
          <TextField label={tr("1 dollar =")} value={rate} onChange={(e) => { setRate(e.target.value); setInfo('') }} inputMode="decimal" autoFocus
            helperText={info || ' '}
            slotProps={{ input: { endAdornment: <InputAdornment position="end">{tr("so'm")}</InputAdornment> } }} />
          <Button variant="outlined" startIcon={<BankIcon />} onClick={fromCbu} sx={{ alignSelf: 'flex-start' }}>{tr("Markaziy bank kursini olish")}</Button>
          <FormControlLabel control={<Checkbox checked={updateSell} onChange={(e) => setUpdateSell(e.target.checked)} />}
            label={tr("Ustamasi bor tovarlarning sotuv narxini ham yangilash ({0} ta)", withMarkup.length)} />
          {sample && r > 0 && (
            <Alert severity="info" icon={false}>
              {tr("Masalan:")} <b>{sample.name}</b> — ${sample.buyPriceUsd} × {r} = <b>{fmtMoney(toUzs(sample.buyPriceUsd, r))}</b>
              {updateSell && sample.markup > 0 && <> {tr("→ sotuv:")} <b>{fmtMoney(sellFrom(toUzs(sample.buyPriceUsd, r), sample.markup))}</b> (+{sample.markup}%)</>}
            </Alert>
          )}
          {err && <Alert severity="error">{err}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{tr("Bekor qilish")}</Button>
        <Button variant="contained" onClick={save} disabled={busy || !(r > 0)}>{tr("Saqlash")}</Button>
      </DialogActions>
    </Dialog>
  )
}
