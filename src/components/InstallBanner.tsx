import { useEffect, useState } from 'react'
import { Box, Button, IconButton, Paper, Stack, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import AndroidIcon from '@mui/icons-material/Android'
import AddBoxIcon from '@mui/icons-material/AddBoxOutlined'
import DownloadIcon from '@mui/icons-material/InstallDesktopOutlined'
import { t as tr } from '../i18n'

const KEY = 'ombor-install-hide'
const HIDE_DAYS = 14

type Kind = 'ios' | 'android' | 'desktop' | null

/** Qurilma turi: ilova sifatida ochilgan bo'lsa — hech narsa ko'rsatilmaydi */
function detect(): Kind {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone
  if (standalone) return null
  const ua = navigator.userAgent
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (ios) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

// iOS Safari'dagi «Ulashish» belgisi
const ShareGlyph = () => (
  <Box component="svg" viewBox="0 0 24 24" sx={{ width: 20, height: 20, verticalAlign: '-4px', mx: 0.25, color: '#0A84FF' }}>
    <path fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 3v12M7.5 7.5 12 3l4.5 4.5M7 11H5.5A1.5 1.5 0 0 0 4 12.5v7A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5H17" />
  </Box>
)

interface BIPEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

/**
 * «Ilova qilib o'rnating» banneri:
 * iPhone — Safari'da «Ulashish → Ekranga qo'shish» yo'riqnomasi,
 * Android — APK faylni yuklab olish, kompyuter — brauzerning o'rnatish oynasi.
 */
export default function InstallBanner() {
  const [kind] = useState<Kind>(detect)
  const [hidden, setHidden] = useState(() => Number(localStorage.getItem(KEY) ?? 0) > Date.now())
  const [bip, setBip] = useState<BIPEvent | null>(null)

  useEffect(() => {
    const on = (e: Event) => { e.preventDefault(); setBip(e as BIPEvent) }
    window.addEventListener('beforeinstallprompt', on)
    return () => window.removeEventListener('beforeinstallprompt', on)
  }, [])

  const hide = () => { localStorage.setItem(KEY, String(Date.now() + HIDE_DAYS * 864e5)); setHidden(true) }
  if (hidden || !kind || (kind === 'desktop' && !bip)) return null

  return (
    <Paper className="no-print" sx={{
      mb: 2.5, p: 2, pr: 1, borderRadius: '18px', border: 1, borderColor: 'primary.light',
      background: 'linear-gradient(120deg, rgba(22,163,99,.10) 0%, rgba(242,183,5,.10) 100%)',
    }}>
      <Stack direction="row" spacing={1.75} alignItems="flex-start">
        <Box component="img" src="/icons/icon-192.png" alt="" sx={{ width: 48, height: 48, borderRadius: 2.5, flexShrink: 0, boxShadow: 2 }} />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800 }}>
            {kind === 'ios' ? tr("iPhone'ga ilova qilib o'rnating") : kind === 'android' ? tr("Android ilovasini o'rnating") : tr("Kompyuterga ilova qilib o'rnating")}
          </Typography>
          {kind === 'ios' && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.7 }}>
              1. {tr("Safari pastidagi")} <ShareGlyph /> <b>{tr("«Ulashish»")}</b> {tr("tugmasini bosing")}<br />
              2. <AddBoxIcon sx={{ fontSize: 18, verticalAlign: '-4px' }} /> <b>{tr("«Ekranga qo'shish»")}</b> {tr("ni tanlang")} → <b>{tr("«Qo'shish»")}</b>
            </Typography>
          )}
          {kind === 'android' && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{tr("Ekranda ⚡ belgisi bilan turadi, to'liq ekranda ochiladi.")}</Typography>
              <Button href="/220volt.apk" variant="contained" size="small" startIcon={<AndroidIcon />} sx={{ mt: 1.25 }}>{tr("Android ilovani yuklab olish")}</Button>
            </>
          )}
          {kind === 'desktop' && bip && (
            <Button variant="contained" size="small" startIcon={<DownloadIcon />} sx={{ mt: 1.25 }}
              onClick={async () => { await bip.prompt(); const r = await bip.userChoice; if (r.outcome === 'accepted') setHidden(true) }}>
              {tr("O'rnatish")}
            </Button>
          )}
        </Box>
        <IconButton size="small" aria-label={tr("Yopish")} onClick={hide}><CloseIcon fontSize="small" /></IconButton>
      </Stack>
    </Paper>
  )
}
