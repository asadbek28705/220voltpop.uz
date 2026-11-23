import { useEffect, useState } from 'react'
import { Alert, Button, FormControlLabel, Paper, Stack, Switch, TextField, Typography } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import { api, attempt } from '../api'

interface TgConfig {
  chatId: string
  enabled: boolean
  notifySales: boolean
  notifyIncoming: boolean
  notifyAdjust: boolean
  notifyUndo: boolean
  notifyLowStock: boolean
  dailyEnabled: boolean
  dailyTime: string
  hasToken: boolean
  tokenHint: string
}

const TOGGLES: [keyof TgConfig, string][] = [
  ['notifySales', 'Har bir savdo (chek)'],
  ['notifyIncoming', 'Kirimlar'],
  ['notifyAdjust', 'Inventarizatsiya'],
  ['notifyUndo', 'Bekor qilingan yozuvlar'],
  ['notifyLowStock', 'Tovar kam qolganda ogohlantirish'],
]

export default function TelegramSettings() {
  const [cfg, setCfg] = useState<TgConfig | null>(null)
  const [token, setToken] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => { api<TgConfig>('GET', '/telegram').then(setCfg).catch(() => {}) }, [])
  if (!cfg) return null

  const save = async (patch: Partial<TgConfig> & { token?: string }, okText = 'Saqlandi') => {
    setBusy(true)
    const r = await attempt(() => api<TgConfig>('PUT', '/telegram', patch))
    setBusy(false)
    if (r.ok) { setCfg(r.value); setToken(''); setMsg({ ok: true, text: okText }) } else setMsg({ ok: false, text: r.error })
  }
  const action = async (path: string, okText: string) => {
    setBusy(true)
    const r = await attempt(() => api('POST', path))
    setBusy(false)
    setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: r.error })
  }

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h6">Telegram bot</Typography>
        <FormControlLabel label={cfg.enabled ? 'Yoqilgan' : "O'chirilgan"}
          control={<Switch checked={cfg.enabled} disabled={busy} onChange={(e) => save({ enabled: e.target.checked })} />} />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Savdo, kirim va kunlik hisobot guruhga yuboriladi. Guruhda buyruqlar: /hisobot, /kecha, /oy, /kam, /qoldiq.
      </Typography>
      <Stack spacing={2}>
        <TextField size="small" label="Bot token" value={token} onChange={(e) => setToken(e.target.value)} type="password" autoComplete="off"
          placeholder={cfg.hasToken ? `Saqlangan: ${cfg.tokenHint}` : '123456:ABC...'} helperText={cfg.hasToken ? "O'zgartirish uchun yangisini kiriting" : '@BotFather dan olinadi'} />
        <TextField size="small" label="Guruh ID" value={cfg.chatId} onChange={(e) => setCfg({ ...cfg, chatId: e.target.value })} placeholder="-1001234567890" />
        <Button variant="contained" sx={{ alignSelf: 'flex-start' }} disabled={busy}
          onClick={() => save({ chatId: cfg.chatId, ...(token.trim() ? { token: token.trim() } : {}) })}>Saqlash</Button>

        <Typography sx={{ fontWeight: 600, pt: 1 }}>Darhol yuboriladigan xabarlar</Typography>
        <Stack>
          {TOGGLES.map(([k, label]) => (
            <FormControlLabel key={k} label={label}
              control={<Switch size="small" checked={!!cfg[k]} disabled={busy} onChange={(e) => save({ [k]: e.target.checked })} />} />
          ))}
        </Stack>

        <Typography sx={{ fontWeight: 600, pt: 1 }}>Kunlik umumiy hisobot</Typography>
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
          <FormControlLabel label="Har kuni yuborish"
            control={<Switch checked={cfg.dailyEnabled} disabled={busy} onChange={(e) => save({ dailyEnabled: e.target.checked })} />} />
          <TextField size="small" type="time" label="Vaqti" value={cfg.dailyTime} sx={{ width: 140 }}
            onChange={(e) => setCfg({ ...cfg, dailyTime: e.target.value })}
            onBlur={() => save({ dailyTime: cfg.dailyTime }, `Hisobot har kuni ${cfg.dailyTime} da yuboriladi`)}
            slotProps={{ inputLabel: { shrink: true } }} />
        </Stack>
        <Typography variant="caption" color="text.secondary">
          Vaqt 12:00 dan keyin bo'lsa — o'sha kun hisoboti, ertalab bo'lsa — kechagi kun hisoboti yuboriladi. Do'kon kompyuteri o'sha paytda yoqiq bo'lishi kerak.
        </Typography>

        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
          <Button variant="outlined" startIcon={<SendIcon />} disabled={busy || !cfg.hasToken} onClick={() => action('/telegram/test', 'Test xabar yuborildi')}>Test xabar</Button>
          <Button variant="outlined" startIcon={<SendIcon />} disabled={busy || !cfg.hasToken} onClick={() => action('/telegram/report', 'Bugungi hisobot yuborildi')}>Bugungi hisobotni hozir yuborish</Button>
        </Stack>
        {msg && <Alert severity={msg.ok ? 'success' : 'error'} onClose={() => setMsg(null)}>{msg.text}</Alert>}
      </Stack>
    </Paper>
  )
}
