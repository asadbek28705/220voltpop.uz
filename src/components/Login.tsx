import { useState } from 'react'
import { Alert, Box, Button, Card, Stack, TextField, Typography } from '@mui/material'
import WarehouseIcon from '@mui/icons-material/WarehouseOutlined'
import { api, attempt } from '../api'
import type { Me } from '../auth'
import { YELLOW } from '../theme'

/** Login sahifasi. Hali foydalanuvchi yo'q bo'lsa — birinchi adminni yaratish (faqat server kompyuterida). */
export default function Login({ me, onDone }: { me: Me; onDone: () => void }) {
  const setup = me.needsSetup
  const [name, setName] = useState('')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (setup && password !== password2) return setError('Parollar bir xil emas')
    setBusy(true)
    const r = await attempt(() => setup
      ? api('POST', '/setup', { name: name.trim(), login: login.trim(), password })
      : api('POST', '/login', { login: login.trim(), password }))
    setBusy(false)
    if (!r.ok) return setError(r.error)
    onDone()
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2, bgcolor: 'background.default' }}>
      <Card sx={{ p: { xs: 3, sm: 4 }, width: '100%', maxWidth: 400 }}>
        <Stack alignItems="center" spacing={0.5} sx={{ mb: 3 }}>
          <WarehouseIcon sx={{ fontSize: 44, color: YELLOW }} />
          <Typography sx={{ fontWeight: 800, letterSpacing: 2, color: '#C9A227', fontSize: 22 }}>OMBOR</Typography>
          <Typography variant="body2" color="text.secondary">Qurilish & Santexnika</Typography>
        </Stack>

        {setup && !me.canSetup ? (
          <Alert severity="info">
            Dastur hali sozlanmagan. Administrator serverda quyidagi buyruq bilan birinchi foydalanuvchini yaratishi kerak:
            <Box component="code" sx={{ display: 'block', mt: 1, fontSize: 13 }}>npm run user -- add admin "Ism" admin</Box>
          </Alert>
        ) : (
          <form onSubmit={submit}>
            <Stack spacing={2}>
              {setup && (
                <>
                  <Alert severity="info">Birinchi kirish: do'kon egasi uchun hisob yarating.</Alert>
                  <TextField label="Ismingiz" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
                </>
              )}
              <TextField label="Login" value={login} onChange={(e) => setLogin(e.target.value)} required autoFocus={!setup}
                autoComplete="username" autoCapitalize="none" slotProps={{ htmlInput: { autoCorrect: 'off', spellCheck: false } }} />
              <TextField label="Parol" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                autoComplete={setup ? 'new-password' : 'current-password'} />
              {setup && <TextField label="Parolni takrorlang" type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} required autoComplete="new-password" />}
              {error && <Alert severity="error">{error}</Alert>}
              <Button type="submit" variant="contained" size="large" disabled={busy} sx={{ py: 1.4 }}>
                {setup ? 'Yaratish va kirish' : 'Kirish'}
              </Button>
            </Stack>
          </form>
        )}
      </Card>
    </Box>
  )
}
