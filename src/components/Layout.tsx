import { useState, type ReactNode } from 'react'
import {
  Avatar, Badge, Box, Chip, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText, ListSubheader, Stack, Typography,
  useMediaQuery, useTheme,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import DarkIcon from '@mui/icons-material/DarkModeOutlined'
import LightIcon from '@mui/icons-material/LightModeOutlined'
import WarehouseIcon from '@mui/icons-material/WarehouseOutlined'
import { GREEN, YELLOW } from '../theme'

export interface NavItem { key: string; label: string; icon: ReactNode; admin?: boolean }
export interface NavGroup { title?: string; items: NavItem[] }

const WIDTH = 248

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

export default function Layout({ groups, active, onNavigate, mode, onToggleMode, online, seller, role, cartCount, children }: Props) {
  const theme = useTheme()
  const desktop = useMediaQuery(theme.breakpoints.up('md'))
  const [open, setOpen] = useState(false)

  const sidebar = (
    <Box sx={{ width: WIDTH, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack alignItems="center" spacing={0.5} sx={{ py: 3 }}>
        <WarehouseIcon sx={{ fontSize: 34, color: YELLOW }} />
        <Typography sx={{ fontWeight: 800, letterSpacing: 2, color: '#C9A227', fontSize: 18 }}>OMBOR</Typography>
        <Typography variant="caption" color="text.secondary">Qurilish & Santexnika</Typography>
      </Stack>
      <Box sx={{ px: 1.5, pb: 2, overflowY: 'auto' }}>
        {groups.map((g, i) => (
          <List key={i} dense disablePadding
            subheader={g.title ? (
              <ListSubheader disableSticky sx={{ bgcolor: 'transparent', fontSize: 11, fontWeight: 700, letterSpacing: 1, lineHeight: '32px', mt: 1.5 }}>
                {g.title}
              </ListSubheader>
            ) : undefined}>
            {g.items.map((it) => (
              <ListItemButton key={it.key} selected={active === it.key} sx={{ mb: 0.25, py: 0.9 }}
                onClick={() => { onNavigate(it.key); setOpen(false) }}>
                <ListItemIcon sx={{ minWidth: 34, color: 'text.secondary' }}>{it.icon}</ListItemIcon>
                <ListItemText primary={it.label} slotProps={{ primary: { fontSize: 14.5, fontWeight: 'inherit' } }} />
                {it.key === 'pos' && cartCount > 0 && <Badge badgeContent={cartCount} color="secondary" sx={{ mr: 1 }} />}
              </ListItemButton>
            ))}
          </List>
        ))}
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Drawer
        variant={desktop ? 'permanent' : 'temporary'}
        open={desktop || open}
        onClose={() => setOpen(false)}
        className="no-print"
        sx={{ width: desktop ? WIDTH : 0, flexShrink: 0, '& .MuiDrawer-paper': { width: WIDTH, borderRight: 1, borderColor: 'divider' } }}
      >
        {sidebar}
      </Drawer>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} className="no-print"
          sx={{ height: 64, px: { xs: 2, md: 4 }, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider', position: 'sticky', top: 0, zIndex: 10 }}>
          {!desktop && <IconButton onClick={() => setOpen(true)}><MenuIcon /></IconButton>}
          {!desktop && <Typography sx={{ fontWeight: 800, letterSpacing: 1.5, color: '#C9A227' }}>OMBOR</Typography>}
          <Box sx={{ flexGrow: 1 }} />
          <Chip size="small" variant="outlined" color={online ? 'success' : 'error'} label={online ? 'Onlayn' : "Aloqa yo'q"}
            sx={{ '& .MuiChip-label': { px: 1 } }} />
          <IconButton onClick={onToggleMode} sx={{ border: 1, borderColor: 'divider' }} title="Rejimni almashtirish">
            {mode === 'dark' ? <LightIcon fontSize="small" /> : <DarkIcon fontSize="small" />}
          </IconButton>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ pl: 1 }}>
            <Avatar sx={{ bgcolor: GREEN, width: 36, height: 36, fontSize: 16, cursor: 'pointer' }} onClick={() => onNavigate('settings')}>
              {(seller || 'S').charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{seller || 'Ism kiritilmagan'}</Typography>
              <Typography variant="caption" color="text.secondary">{role === 'admin' ? 'egasi' : role === 'demo' ? 'demo' : 'sotuvchi'}</Typography>
            </Box>
          </Stack>
        </Stack>
        <Box sx={{ p: { xs: 2, md: 4 } }}>{children}</Box>
      </Box>
    </Box>
  )
}
