import { useState } from 'react'
import {
  Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, TextField, Typography,
} from '@mui/material'
import type { Warehouse } from '../store'
import { attempt } from '../api'
import { fmtMoney } from '../utils'
import { fmtDay } from '../stats'
import { t as tr } from '../i18n'

interface Totals { revenue: number; profit: number; spent: number; net: number }
interface Props { wh: Warehouse; from: string; totals: Totals; onClose: () => void; onDone: (msg: string) => void }

/** Hisob davrini qo'lda yopish: hisoblagichlar 0 dan boshlanadi, yozuvlar arxivda qoladi */
export default function ClosePeriodDialog({ wh, from, totals, onClose, onDone }: Props) {
  const [note, setNote] = useState('')
  const [sure, setSure] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const close = async () => {
    setBusy(true)
    const r = await attempt(() => wh.closePeriod(from, note.trim()))
    setBusy(false)
    if (!r.ok) return setErr(r.error)
    onDone(tr("Davr yopildi — hisoblagichlar 0 dan boshlandi. Eski davr Hisobotlar → «Davr» ro'yxatida"))
    onClose()
  }

  const row = (label: string, v: number, color?: string) => (
    <Stack direction="row" justifyContent="space-between">
      <Typography color="text.secondary">{label}</Typography>
      <Typography sx={{ fontWeight: 700, color }}>{fmtMoney(v)}</Typography>
    </Stack>
  )

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{tr("Hisob davrini yopish")}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          <Typography variant="body2">{tr("Yopilayotgan davr:")} <b>{fmtDay(from)} {tr("— bugun")}</b></Typography>
          {row(tr("Savdo"), totals.revenue)}
          {row(tr("Foyda"), totals.profit)}
          {row(tr("Xarajat"), totals.spent, '#E5533D')}
          {row(tr("Sof foyda"), totals.net, totals.net >= 0 ? '#2E9E5B' : '#E5533D')}
          <Alert severity="info" sx={{ mt: 1 }}>
            {tr("Bosh sahifadagi savdo, foyda va xarajat")} <b>{tr("0 dan")}</b> {tr("boshlanadi. Bu davr yozuvlari o'chirilmaydi — Hisobotlarda «Davr» ro'yxatidan ko'rish mumkin.")} <b>{tr("Mijozlar qarzi va ombor qoldig'i o'zgarmaydi.")}</b>
          </Alert>
          <TextField size="small" label={tr("Izoh (ixtiyoriy)")} value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("Masalan: I chorak yakuni")} />
          <FormControlLabel control={<Checkbox checked={sure} onChange={(e) => setSure(e.target.checked)} />} label={tr("Ha, davrni yopaman")} />
          {err && <Alert severity="error">{err}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{tr("Bekor qilish")}</Button>
        <Button variant="contained" color="warning" disabled={!sure || busy} onClick={close}>{tr("Davrni yopish")}</Button>
      </DialogActions>
    </Dialog>
  )
}
