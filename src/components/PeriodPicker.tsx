import { MenuItem, TextField } from '@mui/material'
import type { ShopSettings } from '../types'
import { currentPeriod, fmtDay, yearPeriod } from '../stats'
import { t as tr } from '../i18n'

interface Props { from: string; to: string; settings: ShopSettings; onChange: (from: string, to: string) => void }

/** Davr tanlash: joriy hisob davri, yopilgan davrlar arxivi, yil yoki qo'lda sana */
export default function PeriodPicker({ from, to, settings, onChange }: Props) {
  const cur = currentPeriod(settings)
  const presets = [
    { from: cur.from, to: '', label: tr("Joriy davr ({0} dan)", fmtDay(cur.from)) },
    ...[...(settings.periods ?? [])].reverse().map((p) => ({
      from: p.from, to: p.to, label: tr("Yopilgan: {0} – {1}", new Date(p.from).getTime() ? fmtDay(p.from) : 'boshidan', fmtDay(p.to)),
    })),
    ...[0, -1].map((o) => { const y = yearPeriod(o); return { from: y.from, to: y.to, label: y.label } }),
  ]
  const idx = presets.findIndex((p) => p.from === from && p.to === to)
  const day = (s: string) => (s ? s.slice(0, 10) : '')
  // ISO chegarani sana maydonida mahalliy kun sifatida ko'rsatamiz
  const show = (s: string) => (s.includes('T') ? (() => { const d = new Date(s); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })() : day(s))
  return (
    <>
      <TextField size="small" select label={tr("Davr")} value={idx >= 0 ? String(idx) : 'custom'} sx={{ minWidth: 250 }}
        onChange={(e) => { const p = presets[Number(e.target.value)]; if (p) onChange(p.from, p.to) }}>
        {presets.map((p, i) => <MenuItem key={i} value={String(i)}>{p.label}</MenuItem>)}
        <MenuItem value="custom" disabled>{tr("Boshqa sana")}</MenuItem>
      </TextField>
      <TextField size="small" type="date" label={tr("Dan")} value={show(from)} onChange={(e) => onChange(e.target.value, to)} slotProps={{ inputLabel: { shrink: true } }} />
      <TextField size="small" type="date" label={tr("Gacha")} value={show(to)} onChange={(e) => onChange(from, e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
    </>
  )
}
