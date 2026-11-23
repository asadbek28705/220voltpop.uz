import { useState } from 'react'
import {
  Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, InputAdornment, Stack, TextField, Typography,
} from '@mui/material'
import BankIcon from '@mui/icons-material/AccountBalanceOutlined'
import type { Warehouse } from '../store'
import { api, attempt } from '../api'
import { fmtDate, fmtMoney, sellFrom, toUzs } from '../utils'

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
    setInfo(`Markaziy bank kursi (${x.value.date})`)
  }

  const save = async () => {
    setBusy(true)
    const x = await attempt(() => wh.setRate(r, updateSell))
    setBusy(false)
    if (!x.ok) return setErr(x.error)
    onDone?.(`Kurs saqlandi: 1$ = ${fmtMoney(r)}. ${x.value.products} ta tovar tannarxi qayta hisoblandi` +
      (x.value.repriced ? `, ${x.value.repriced} ta tovarning sotuv narxi yangilandi` : ''))
    onClose()
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Dollar kursi</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {settings.usdRate ? (
            <Typography variant="body2" color="text.secondary">
              Hozirgi: <b>1$ = {fmtMoney(settings.usdRate)}</b>{settings.rateDate && <> · {fmtDate(settings.rateDate)}</>}
            </Typography>
          ) : <Alert severity="info">Dollarda olinadigan tovarlar uchun kursni kiriting.</Alert>}
          <TextField label="1 dollar =" value={rate} onChange={(e) => { setRate(e.target.value); setInfo('') }} inputMode="decimal" autoFocus
            helperText={info || ' '}
            slotProps={{ input: { endAdornment: <InputAdornment position="end">so'm</InputAdornment> } }} />
          <Button variant="outlined" startIcon={<BankIcon />} onClick={fromCbu} sx={{ alignSelf: 'flex-start' }}>Markaziy bank kursini olish</Button>
          <FormControlLabel control={<Checkbox checked={updateSell} onChange={(e) => setUpdateSell(e.target.checked)} />}
            label={`Ustamasi bor tovarlarning sotuv narxini ham yangilash (${withMarkup.length} ta)`} />
          {sample && r > 0 && (
            <Alert severity="info" icon={false}>
              Masalan: <b>{sample.name}</b> — ${sample.buyPriceUsd} × {r} = <b>{fmtMoney(toUzs(sample.buyPriceUsd, r))}</b>
              {updateSell && sample.markup > 0 && <> → sotuv: <b>{fmtMoney(sellFrom(toUzs(sample.buyPriceUsd, r), sample.markup))}</b> (+{sample.markup}%)</>}
            </Alert>
          )}
          {err && <Alert severity="error">{err}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Bekor qilish</Button>
        <Button variant="contained" onClick={save} disabled={busy || !(r > 0)}>Saqlash</Button>
      </DialogActions>
    </Dialog>
  )
}
