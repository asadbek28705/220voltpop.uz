import { useState } from 'react'
import {
  Alert, Box, Button, CircularProgress, IconButton, InputAdornment, Stack, TextField, Typography, alpha,
} from '@mui/material'
import PersonIcon from '@mui/icons-material/PersonOutlineRounded'
import LockIcon from '@mui/icons-material/LockOutlined'
import EyeIcon from '@mui/icons-material/VisibilityOutlined'
import EyeOffIcon from '@mui/icons-material/VisibilityOffOutlined'
import ArrowIcon from '@mui/icons-material/ArrowForwardRounded'
import PosIcon from '@mui/icons-material/PointOfSaleOutlined'
import BoxIcon from '@mui/icons-material/Inventory2Outlined'
import DebtIcon from '@mui/icons-material/MenuBookOutlined'
import ChartIcon from '@mui/icons-material/InsightsOutlined'
import ShieldIcon from '@mui/icons-material/VerifiedUserOutlined'
import { api, attempt } from '../api'
import type { Me } from '../auth'
import { GRADIENT, GREEN, YELLOW } from '../theme'
import { t as tr } from '../i18n'
import LangSwitcher from './LangSwitcher'
import Rings from './Rings'

const FEATURES = [
  { icon: <PosIcon />, title: tr("Tezkor kassa"), text: tr("Skaner, bir nechta xaridor, chek va qaytarish") },
  { icon: <BoxIcon />, title: tr("Ombor nazorati"), text: tr("Qoldiq, kirim va kam qolgan tovarlar") },
  { icon: <DebtIcon />, title: tr("Mijozlar va nasiya"), text: tr("Qarzdorlar daftari doim qo'l ostida") },
  { icon: <ChartIcon />, title: tr("Hisobot va Telegram"), text: tr("Foyda, xarajat va kunlik hisobot") },
]

/** Login sahifasi. Hali foydalanuvchi yo'q bo'lsa — birinchi adminni yaratish (faqat server kompyuterida). */
export default function Login({ me, onDone }: { me: Me; onDone: () => void }) {
  const setup = me.needsSetup
  const [name, setName] = useState('')
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (setup && password !== password2) return setError(tr("Parollar bir xil emas"))
    setBusy(true)
    const r = await attempt(() => setup
      ? api('POST', '/setup', { name: name.trim(), login: login.trim(), password })
      : api('POST', '/login', { login: login.trim(), password }))
    setBusy(false)
    if (!r.ok) return setError(r.error)
    onDone()
  }

  const icon = (el: React.ReactNode) => ({ input: { startAdornment: <InputAdornment position="start" sx={{ color: 'text.secondary' }}>{el}</InputAdornment> } })
  const field = { '& .MuiOutlinedInput-root': { height: 54, bgcolor: 'background.paper' } }

  const logo = (
    <Stack direction="row" alignItems="center" spacing={1.5}>
      <Box component="img" src="/icons/icon-192.png" alt="" sx={{ width: 52, height: 52, borderRadius: '14px', boxShadow: `0 10px 24px ${alpha(GREEN, 0.35)}` }} />
      <Box>
        <Typography sx={{ fontWeight: 900, letterSpacing: 1.5, fontSize: 23, color: 'text.primary', lineHeight: 1.1 }}>220 VOLT</Typography>
        <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>{tr("Elektrika va santexnika")}</Typography>
      </Box>
    </Stack>
  )

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: 'background.default' }}>
      {/* Chap tomon (kompyuterda): brend paneli */}
      <Box sx={{
        display: { xs: 'none', md: 'flex' }, flex: '1 1 52%', position: 'relative', overflow: 'hidden', flexDirection: 'column', justifyContent: 'space-between',
        p: 6, borderRight: 1, borderColor: alpha(GREEN, 0.15),
        background: `linear-gradient(150deg, #E3F6EC 0%, #F4FBF7 45%, #FFFDF6 70%, #FFF3D1 100%)`,
      }}>
        <Rings color={GREEN} size={620} x="100%" y="0%" count={5} />
        <Rings color={YELLOW} size={420} x="0%" y="100%" count={4} strength={1.5} />
        <Box sx={{ position: 'relative' }}>{logo}</Box>
        <Box sx={{ position: 'relative', maxWidth: 520 }}>
          <Typography sx={{ fontSize: 40, fontWeight: 800, letterSpacing: -1.2, lineHeight: 1.12, color: '#0F172A' }}>
            {tr("Do'koningiz boshqaruvi")}{' '}
            <Box component="span" sx={{ background: GRADIENT, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{tr("bir joyda")}</Box>
          </Typography>
          <Typography sx={{ mt: 1.5, fontSize: 16, color: '#475569', maxWidth: 440 }}>
            {tr("Savdo, ombor, mijozlar va hisobotlar — kompyuterda ham, telefonda ham real vaqtda.")}
          </Typography>
          <Box sx={{ mt: 4, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            {FEATURES.map((f) => (
              <Stack key={f.title} direction="row" spacing={1.5} sx={{
                p: 1.75, borderRadius: 3.5, bgcolor: 'rgba(255,255,255,.75)', backdropFilter: 'blur(8px)',
                border: `1px solid ${alpha(GREEN, 0.12)}`, boxShadow: '0 4px 14px rgba(16,24,40,.04)',
              }}>
                <Box sx={{ width: 38, height: 38, flexShrink: 0, borderRadius: 2.5, display: 'grid', placeItems: 'center', color: '#fff', background: GRADIENT, '& svg': { fontSize: 20 } }}>{f.icon}</Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 14, color: '#0F172A' }}>{f.title}</Typography>
                  <Typography sx={{ fontSize: 12.5, color: '#64748B', lineHeight: 1.35 }}>{f.text}</Typography>
                </Box>
              </Stack>
            ))}
          </Box>
        </Box>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ position: 'relative', color: '#64748B' }}>
          <ShieldIcon sx={{ fontSize: 18, color: GREEN }} />
          <Typography sx={{ fontSize: 13 }}>{tr("Ma'lumotlar himoyalangan, har kuni zaxira nusxa olinadi")}</Typography>
        </Stack>
      </Box>

      {/* O'ng tomon: kirish formasi */}
      <Box sx={{ flex: '1 1 48%', position: 'relative', overflow: 'hidden', display: 'grid', placeItems: 'center', p: { xs: 2.5, sm: 4 } }}>
        <Box sx={{ display: { md: 'none' } }}>
          <Rings color={GREEN} size={460} x="100%" y="0%" count={4} />
          <Rings color={YELLOW} size={300} x="0%" y="100%" count={3} strength={1.4} />
        </Box>
        <Box sx={{ position: 'absolute', top: 20, right: 20 }}><LangSwitcher /></Box>

        <Box sx={{ width: '100%', maxWidth: 420, position: 'relative' }}>
          <Box sx={{ display: { md: 'none' }, mb: 4 }}>{logo}</Box>
          <Typography sx={{ fontSize: { xs: 28, sm: 32 }, fontWeight: 800, letterSpacing: -0.8 }}>
            {setup ? tr("Do'kon egasi hisobi") : tr("Xush kelibsiz")}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75, mb: 3.5 }}>
            {setup ? tr("Birinchi kirish: do'kon egasi uchun hisob yarating.") : tr("Davom etish uchun login va parolingizni kiriting")}
          </Typography>

          {setup && !me.canSetup ? (
            <Alert severity="info">
              {tr("Dastur hali sozlanmagan. Administrator serverda quyidagi buyruq bilan birinchi foydalanuvchini yaratishi kerak:")}
              <Box component="code" sx={{ display: 'block', mt: 1, fontSize: 13 }}>{tr("npm run user -- add admin \"Ism\" admin")}</Box>
            </Alert>
          ) : (
            <form onSubmit={submit}>
              <Stack spacing={2}>
                {setup && (
                  <TextField label={tr("Ismingiz")} value={name} onChange={(e) => setName(e.target.value)} required autoFocus sx={field} slotProps={icon(<PersonIcon />)} />
                )}
                <TextField label={tr("Login")} value={login} onChange={(e) => setLogin(e.target.value)} required autoFocus={!setup} sx={field}
                  autoComplete="username" autoCapitalize="none"
                  slotProps={{ ...icon(<PersonIcon />), htmlInput: { autoCorrect: 'off', spellCheck: false } }} />
                <TextField label={tr("Parol")} type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required sx={field}
                  autoComplete={setup ? 'new-password' : 'current-password'}
                  slotProps={{ input: {
                    startAdornment: <InputAdornment position="start" sx={{ color: 'text.secondary' }}><LockIcon /></InputAdornment>,
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton aria-label={show ? tr("Parolni yashirish") : tr("Parolni ko'rsatish")} onClick={() => setShow(!show)} edge="end" size="small">
                          {show ? <EyeOffIcon fontSize="small" /> : <EyeIcon fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  } }} />
                {setup && <TextField label={tr("Parolni takrorlang")} type={show ? 'text' : 'password'} value={password2} onChange={(e) => setPassword2(e.target.value)} required
                  autoComplete="new-password" sx={field} slotProps={icon(<LockIcon />)} />}
                {error && <Alert severity="error">{error}</Alert>}
                <Button type="submit" variant="contained" size="large" disabled={busy}
                  endIcon={busy ? <CircularProgress size={18} color="inherit" /> : <ArrowIcon />}
                  sx={{ height: 54, fontSize: 16, mt: 0.5, '&.Mui-disabled': { color: '#fff', background: GRADIENT, opacity: 0.75 } }}>
                  {setup ? tr("Yaratish va kirish") : tr("Kirish")}
                </Button>
              </Stack>
            </form>
          )}
          <Typography sx={{ mt: 4, fontSize: 12.5, color: 'text.secondary', textAlign: 'center' }}>
            {tr("Parolni unutdingizmi? Do'kon egasiga murojaat qiling.")}
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
