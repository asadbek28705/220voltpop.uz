import { MenuItem, TextField } from '@mui/material'
import { quarter, yearPeriod } from '../stats'

interface Props { from: string; to: string; onChange: (from: string, to: string) => void }

/** Davr tanlash: chorak bo'yicha tez tanlov + qo'lda sana */
export default function PeriodPicker({ from, to, onChange }: Props) {
  const presets = [
    ...[0, -1, -2, -3, -4, -5, -6, -7].map((o) => quarter(o)),
    yearPeriod(0), yearPeriod(-1),
  ]
  const current = presets.find((p) => p.from === from && p.to === to)
  return (
    <>
      <TextField size="small" select label="Davr" value={current ? `${current.from}|${current.to}` : 'custom'} sx={{ minWidth: 230 }}
        onChange={(e) => { if (e.target.value !== 'custom') { const [f, t] = e.target.value.split('|'); onChange(f, t) } }}>
        {presets.map((p, i) => (
          <MenuItem key={p.from + p.to} value={`${p.from}|${p.to}`}>{i === 0 ? `Joriy: ${p.short}` : p.short}</MenuItem>
        ))}
        <MenuItem value="custom" disabled={!!current}>Boshqa sana</MenuItem>
      </TextField>
      <TextField size="small" type="date" label="Dan" value={from} onChange={(e) => onChange(e.target.value, to)} slotProps={{ inputLabel: { shrink: true } }} />
      <TextField size="small" type="date" label="Gacha" value={to} onChange={(e) => onChange(from, e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
    </>
  )
}
