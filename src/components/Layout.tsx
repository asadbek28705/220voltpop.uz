import { useState, type ReactNode } from 'react'
import {
  Avatar, Box, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, ListSubheader, Stack, Typography,
  alpha, useMediaQuery, useTheme,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import DarkIcon from '@mui/icons-material/DarkModeOutlined'
import LightIcon from '@mui/icons-material/LightModeOutlined'
import WarehouseIcon from '@mui/icons-material/WarehouseRounded'
import { GOLD_GRADIENT, GRADIENT, GREEN, INK, YELLOW } from '../theme'
import { t as tr } from '../i18n'
import LangSwitcher from './LangSwitcher'

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
  return (
    <Stack direction="row" alignItems="center" spacing={1.5}>
      <Box sx={{
        width: compact ? 34 : 42, height: compact ? 34 : 42, borderRadius: compact ? 2.5 : 3, display: 'grid', placeItems: 'center', flexShrink: 0,
        background: GOLD_GRADIENT, boxShadow: `0 6px 18px ${alpha(YELLOW, 0.35)}`,
      }}>
        <WarehouseIcon sx={{ color: '#1a1300', fontSize: compact ? 20 : 24 }} />
      </Box>
      <Box sx={{ lineHeight: 1 }}>
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <Typography sx={{ fontWeight: 800, letterSpacing: 1.5, fontSize: compact ? 16 : 18, color: compact ? 'text.primary' : '#fff' }}>OMBOR</Typography>
          <Box component="span" sx={{ px: 0.6, py: 0.1, borderRadius: 1, fontSize: 9.5, fontWeight: 800, letterSpacing: 1, color: '#1a1300', background: GOLD_GRADIENT }}>PRO</Box>
        </Stack>
        {!compact && <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,.5)', mt: 0.3 }}>{tr("Qurilish & Santexnika")}</Typography>}
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

  // Yon menyu har doim to'q rangda — premium ko'rinish
  const sidebar = (
    <Box sx={{
      width: WIDTH, height: '100%', display: 'flex', flexDirection: 'column', color: 'rgba(255,255,255,.72)',
      background: `radial-gradient(120% 60% at 0% 0%, ${alpha(GREEN, 0.22)} 0%, transparent 60%), linear-gradient(180deg, #0E1626 0%, ${INK} 100%)`,
    }}>
      <Box sx={{ px: 2.5, pt: 3, pb: 2.5 }}><Brand /></Box>
      <Box sx={{ mx: 2.5, mb: 1, height: '1px', background: 'linear-gradient(90deg, rgba(255,255,255,.12), transparent)' }} />
      <Box sx={{ px: 1.5, pb: 2, overflowY: 'auto', flexGrow: 1, '&::-webkit-scrollbar': { width: 6 }, '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,.1)', borderRadius: 3 } }}>
        {groups.map((g, i) => (
          <List key={i} dense disablePadding
            subheader={g.title ? (
              <ListSubheader disableSticky sx={{ bgcolor: 'transparent', color: 'rgba(255,255,255,.35)', fontSize: 10.5, fontWeight: 800, letterSpacing: 1.4, lineHeight: '30px', mt: 1.5, px: 1.5 }}>
                {g.title}
              </ListSubheader>
            ) : undefined}>
            {g.items.map((it) => {
              const on = active === it.key
              return (
                <ListItemButton key={it.key} selected={on} onClick={() => { onNavigate(it.key); setOpen(false) }}
                  sx={{
                    mb: 0.4, py: 0.95, px: 1.5, position: 'relative', color: on ? '#fff' : 'inherit',
                    '&:hover': { bgcolor: 'rgba(255,255,255,.06)', color: '#fff' },
                    '&:hover .MuiListItemIcon-root': { color: '#fff' },
                    '&.Mui-selected, &.Mui-selected:hover': {
                      background: `linear-gradient(90deg, ${alpha(GREEN, 0.35)} 0%, ${alpha(GREEN, 0.08)} 100%)`, color: '#fff',
                      boxShadow: `inset 0 0 0 1px ${alpha(GREEN, 0.35)}`,
                    },
                    '&.Mui-selected::before': {
                      content: '""', position: 'absolute', left: -12, top: 8, bottom: 8, width: 4, borderRadius: 4, background: GOLD_GRADIENT,
                    },
                  }}>
                  <ListItemIcon sx={{ minWidth: 34, color: on ? YELLOW : 'rgba(255,255,255,.45)', '&.MuiListItemIcon-root': on ? { color: `${YELLOW} !important` } : {} }}>{it.icon}</ListItemIcon>
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
          sx={{ p: 1.25, borderRadius: 3, cursor: 'pointer', bgcolor: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.07)', '&:hover': { bgcolor: 'rgba(255,255,255,.09)' } }}>
          <Box sx={{ position: 'relative' }}>
            <Avatar sx={{ width: 38, height: 38, fontSize: 16, fontWeight: 800, background: GRADIENT }}>{(seller || 'S').charAt(0).toUpperCase()}</Avatar>
            <Box sx={{ position: 'absolute', right: -1, bottom: -1, width: 11, height: 11, borderRadius: '50%', bgcolor: online ? '#22C55E' : '#E5484D', border: `2px solid ${INK}` }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap sx={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>{seller || tr("Ism kiritilmagan")}</Typography>
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>{roleLabel} · {online ? tr("Onlayn") : tr("Aloqa yo'q")}</Typography>
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
      backgroundAttachment: 'fixed',
    }}>
      <Drawer
        variant={desktop ? 'permanent' : 'temporary'}
        open={desktop || open}
        onClose={() => setOpen(false)}
        className="no-print"
        sx={{ width: desktop ? WIDTH : 0, flexShrink: 0, '& .MuiDrawer-paper': { width: WIDTH, border: 0, bgcolor: INK } }}
      >
        {sidebar}
      </Drawer>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        {/* Yuqori panel: shaffof, orqasi xiralashgan */}
        <Stack direction="row" alignItems="center" spacing={1.25} className="no-print"
          sx={{
            height: 68, px: { xs: 2, md: 4 }, position: 'sticky', top: 0, zIndex: 10,
            bgcolor: alpha(theme.palette.background.paper, dark ? 0.7 : 0.75), backdropFilter: 'saturate(180%) blur(14px)',
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
        <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1600, mx: 'auto' }}>{children}</Box>
      </Box>
    </Box>
  )
}
