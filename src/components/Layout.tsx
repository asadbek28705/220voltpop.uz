import { useState, type ReactNode } from 'react'
import {
  Avatar, Box, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, ListSubheader, Stack, Typography,
  alpha, useMediaQuery, useTheme,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import DarkIcon from '@mui/icons-material/DarkModeOutlined'
import LightIcon from '@mui/icons-material/LightModeOutlined'
import { GOLD_GRADIENT, GRADIENT, GREEN, GREEN_DARK, INK, YELLOW } from '../theme'
import { t as tr } from '../i18n'
import LangSwitcher from './LangSwitcher'
import InstallBanner from './InstallBanner'

export interface NavItem { key: string; label: string; icon: ReactNode; admin?: boolean }
export interface NavGroup { title?: string; items: NavItem[] }

const WIDTH = 264

interface Props {
  groups: NavGroup[]
  active: string
  onNavigate: (key: string) => void
  mode: 'light' | 'dark'
  onToggleMode: () => void
  online: boolean
  seller: string
  role: 'admin' | 'seller' | 'demo'
  cartCount: number
  children: ReactNode
}

/** Logotip: oltin belgili to'q kvadrat + nom */
function Brand({ compact }: { compact?: boolean }) {
  // Nom matn rangida (och va to'q rejimga mos)
  return (
    <Stack direction="row" alignItems="center" spacing={1.5}>
      {/* Ilova ikonkasi bilan bir xil belgi: yashil fonda oltin chaqmoq */}
      <Box component="img" src="/icons/icon-192.png" alt="" sx={{
        width: compact ? 34 : 42, height: compact ? 34 : 42, borderRadius: compact ? '10px' : '12px', flexShrink: 0,
        boxShadow: `0 6px 18px ${alpha(GREEN, 0.3)}`,
      }} />
      <Box sx={{ lineHeight: 1 }}>
        <Typography sx={{ fontWeight: 900, letterSpacing: 1.2, fontSize: compact ? 16 : 19, color: 'text.primary', lineHeight: 1.1 }}>220 VOLT</Typography>
        {!compact && <Typography sx={{ fontSize: 11.5, color: 'text.secondary', mt: 0.3 }}>{tr("Elektrika va santexnika")}</Typography>}
      </Box>
    </Stack>
  )
}

export default function Layout({ groups, active, onNavigate, mode, onToggleMode, online, seller, role, cartCount, children }: Props) {
  const theme = useTheme()
  const desktop = useMediaQuery(theme.breakpoints.up('md'))
  const [open, setOpen] = useState(false)
  const dark = mode === 'dark'
  const roleLabel = role === 'admin' ? tr('egasi') : role === 'demo' ? 'demo' : tr('sotuvchi')

  // Yon menyu: och rejimda oq, yashil-oltin nafis tus bilan; to'q rejimda — to'q
  const sb = dark
    ? { text: 'rgba(255,255,255,.72)', strong: '#fff', muted: 'rgba(255,255,255,.4)', icon: 'rgba(255,255,255,.45)', hover: 'rgba(255,255,255,.06)', line: 'rgba(255,255,255,.12)', card: 'rgba(255,255,255,.05)', cardBorder: 'rgba(255,255,255,.07)' }
    : { text: '#475569', strong: '#0F172A', muted: '#94A3B8', icon: '#94A3B8', hover: alpha(GREEN, 0.06), line: '#E7EAF0', card: '#F8FAFC', cardBorder: '#E7EAF0' }
  const sidebar = (
    <Box sx={{
      width: WIDTH, height: '100%', display: 'flex', flexDirection: 'column', color: sb.text, pt: 'env(safe-area-inset-top)', pb: 'env(safe-area-inset-bottom)',
      background: dark
        ? `radial-gradient(120% 60% at 0% 0%, ${alpha(GREEN, 0.22)} 0%, transparent 60%), linear-gradient(180deg, #0E1626 0%, ${INK} 100%)`
        : `radial-gradient(120% 40% at 0% 0%, ${alpha(GREEN, 0.10)} 0%, transparent 60%), radial-gradient(100% 30% at 100% 100%, ${alpha(YELLOW, 0.10)} 0%, transparent 60%), #FFFFFF`,
    }}>
      <Box sx={{ px: 2.5, pt: 3, pb: 2.5 }}><Brand /></Box>
      <Box sx={{ mx: 2.5, mb: 1, height: '1px', background: `linear-gradient(90deg, ${sb.line}, transparent)` }} />
      <Box sx={{ px: 1.5, pb: 2, overflowY: 'auto', flexGrow: 1, '&::-webkit-scrollbar': { width: 6 }, '&::-webkit-scrollbar-thumb': { bgcolor: sb.line, borderRadius: 3 } }}>
        {groups.map((g, i) => (
          <List key={i} dense disablePadding
            subheader={g.title ? (
              <ListSubheader disableSticky sx={{ bgcolor: 'transparent', color: sb.muted, fontSize: 10.5, fontWeight: 800, letterSpacing: 1.4, lineHeight: '30px', mt: 1.5, px: 1.5 }}>
                {g.title}
              </ListSubheader>
            ) : undefined}>
            {g.items.map((it) => {
              const on = active === it.key
              return (
                <ListItemButton key={it.key} selected={on} onClick={() => { onNavigate(it.key); setOpen(false) }}
                  sx={{
                    mb: 0.4, py: 0.95, px: 1.5, position: 'relative', color: on ? (dark ? '#fff' : GREEN_DARK) : 'inherit',
                    '&:hover': { bgcolor: sb.hover, color: sb.strong },
                    '&:hover .MuiListItemIcon-root': { color: dark ? '#fff' : GREEN },
                    '&.Mui-selected, &.Mui-selected:hover': {
                      background: dark
                        ? `linear-gradient(90deg, ${alpha(GREEN, 0.35)} 0%, ${alpha(GREEN, 0.08)} 100%)`
                        : `linear-gradient(90deg, ${alpha(GREEN, 0.14)} 0%, ${alpha(GREEN, 0.04)} 100%)`,
                      color: dark ? '#fff' : GREEN_DARK,
                      boxShadow: `inset 0 0 0 1px ${alpha(GREEN, dark ? 0.35 : 0.22)}`,
                    },
                    '&.Mui-selected::before': {
                      content: '""', position: 'absolute', left: -12, top: 8, bottom: 8, width: 4, borderRadius: 4, background: GOLD_GRADIENT,
                    },
                  }}>
                  <ListItemIcon sx={{ minWidth: 34, color: on ? (dark ? YELLOW : GREEN) : sb.icon }}>{it.icon}</ListItemIcon>
                  <ListItemText primary={it.label} slotProps={{ primary: { fontSize: 14, fontWeight: on ? 700 : 500 } }} />
                  {it.key === 'pos' && cartCount > 0 && (
                    <Box sx={{ minWidth: 22, height: 22, px: 0.75, borderRadius: 11, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, color: '#1a1300', background: GOLD_GRADIENT }}>
                      {cartCount}
                    </Box>
                  )}
                </ListItemButton>
              )
            })}
          </List>
        ))}
      </Box>
      {/* Foydalanuvchi kartasi */}
      <Box sx={{ p: 1.5 }}>
        <Stack direction="row" spacing={1.25} alignItems="center" onClick={() => { onNavigate('settings'); setOpen(false) }}
          sx={{ p: 1.25, borderRadius: 3, cursor: 'pointer', bgcolor: sb.card, border: `1px solid ${sb.cardBorder}`, '&:hover': { bgcolor: sb.hover } }}>
          <Box sx={{ position: 'relative' }}>
            <Avatar sx={{ width: 38, height: 38, fontSize: 16, fontWeight: 800, background: GRADIENT }}>{(seller || 'S').charAt(0).toUpperCase()}</Avatar>
            <Box sx={{ position: 'absolute', right: -1, bottom: -1, width: 11, height: 11, borderRadius: '50%', bgcolor: online ? '#22C55E' : '#E5484D', border: `2px solid ${dark ? INK : '#fff'}` }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap sx={{ fontWeight: 700, fontSize: 14, color: sb.strong }}>{seller || tr("Ism kiritilmagan")}</Typography>
            <Typography sx={{ fontSize: 12, color: sb.muted }}>{roleLabel} · {online ? tr("Onlayn") : tr("Aloqa yo'q")}</Typography>
          </Box>
        </Stack>
      </Box>
    </Box>
  )

  return (
    <Box sx={{
      display: 'flex', minHeight: '100vh', bgcolor: 'background.default',
      backgroundImage: dark
        ? `radial-gradient(60% 40% at 100% 0%, ${alpha(GREEN, 0.08)} 0%, transparent 70%)`
        : `radial-gradient(60% 40% at 100% 0%, ${alpha(GREEN, 0.07)} 0%, transparent 70%), radial-gradient(40% 30% at 30% 0%, ${alpha(YELLOW, 0.06)} 0%, transparent 70%)`,
    }}>
      <Drawer
        variant={desktop ? 'permanent' : 'temporary'}
        open={desktop || open}
        onClose={() => setOpen(false)}
        className="no-print"
        sx={{ width: desktop ? WIDTH : 0, flexShrink: 0, '& .MuiDrawer-paper': { width: WIDTH, border: 0, borderRight: dark ? 0 : '1px solid #E7EAF0', bgcolor: dark ? INK : '#fff', boxShadow: dark ? 'none' : '4px 0 24px rgba(16,24,40,.04)' } }}
      >
        {sidebar}
      </Drawer>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        {/* Yuqori panel: shaffof, orqasi xiralashgan */}
        <Stack direction="row" alignItems="center" spacing={1.25} className="no-print"
          sx={{
            height: 'calc(68px + env(safe-area-inset-top))', pt: 'env(safe-area-inset-top)', px: { xs: 2, md: 4 }, position: 'sticky', top: 0, zIndex: 10,
            bgcolor: alpha(theme.palette.background.paper, dark ? 0.96 : 0.97),
            borderBottom: 1, borderColor: 'divider',
          }}>
          {!desktop && <IconButton aria-label={tr("Menyu")} onClick={() => setOpen(true)} sx={{ ml: -1 }}><MenuIcon /></IconButton>}
          {!desktop && <Brand compact />}
          <Box sx={{ flexGrow: 1 }} />
          <Stack direction="row" alignItems="center" spacing={0.75}
            sx={{ display: { xs: 'none', sm: 'flex' }, px: 1.25, py: 0.5, borderRadius: 5, bgcolor: online ? alpha('#22C55E', 0.1) : alpha('#E5484D', 0.1) }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: online ? '#22C55E' : '#E5484D', boxShadow: `0 0 0 3px ${alpha(online ? '#22C55E' : '#E5484D', 0.2)}` }} />
            <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: online ? '#16A34A' : 'error.main' }}>{online ? tr("Onlayn") : tr("Aloqa yo'q")}</Typography>
          </Stack>
          <LangSwitcher />
          <IconButton aria-label={tr("Rejimni almashtirish")} onClick={onToggleMode} sx={{ border: 1, borderColor: 'divider', width: 38, height: 38 }} title={tr("Rejimni almashtirish")}>
            {dark ? <LightIcon fontSize="small" /> : <DarkIcon fontSize="small" />}
          </IconButton>
          <Avatar onClick={() => onNavigate('settings')}
            sx={{ display: { xs: 'none', sm: 'flex', md: 'none' }, width: 36, height: 36, fontSize: 15, fontWeight: 800, cursor: 'pointer', background: GRADIENT }}>
            {(seller || 'S').charAt(0).toUpperCase()}
          </Avatar>
        </Stack>
        <Box sx={{ p: { xs: 2, md: 4 }, pl: { xs: 'max(16px, env(safe-area-inset-left))' }, pr: { xs: 'max(16px, env(safe-area-inset-right))' }, maxWidth: 1600, mx: 'auto' }}>
          <InstallBanner />
          {children}
        </Box>
      </Box>
    </Box>
  )
}
