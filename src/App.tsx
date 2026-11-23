import { useEffect, useMemo, useState } from 'react'
import { CssBaseline, ThemeProvider } from '@mui/material'
import DashboardIcon from '@mui/icons-material/SpaceDashboardOutlined'
import CartIcon from '@mui/icons-material/ShoppingCartOutlined'
import BoxIcon from '@mui/icons-material/Inventory2Outlined'
import InIcon from '@mui/icons-material/MoveToInboxOutlined'
import TuneIcon from '@mui/icons-material/FactCheckOutlined'
import ChartIcon from '@mui/icons-material/BarChartOutlined'
import HistoryIcon from '@mui/icons-material/ReceiptLongOutlined'
import SettingsIcon from '@mui/icons-material/SettingsOutlined'
import { useWarehouse } from './store'
import type { MovementType } from './types'
import { makeTheme } from './theme'
import Layout, { type NavGroup } from './components/Layout'
import Dashboard from './components/Dashboard'
import Products from './components/Products'
import Movements from './components/Movements'
import Reports from './components/Reports'
import Settings from './components/Settings'
import MovementDialog from './components/MovementDialog'

const NAV: NavGroup[] = [
  { items: [{ key: 'home', label: 'Bosh sahifa', icon: <DashboardIcon fontSize="small" /> }] },
  { title: 'SOTUV', items: [{ key: 'sales', label: 'Savdo', icon: <CartIcon fontSize="small" /> }] },
  {
    title: 'OMBOR', items: [
      { key: 'products', label: 'Tovarlar', icon: <BoxIcon fontSize="small" /> },
      { key: 'incoming', label: 'Kirim', icon: <InIcon fontSize="small" /> },
      { key: 'audit', label: 'Inventarizatsiya', icon: <TuneIcon fontSize="small" /> },
    ],
  },
  {
    title: 'MOLIYA', items: [
      { key: 'reports', label: 'Hisobotlar', icon: <ChartIcon fontSize="small" /> },
      { key: 'history', label: 'Barcha harakatlar', icon: <HistoryIcon fontSize="small" /> },
    ],
  },
  { title: 'SOZLAMALAR', items: [{ key: 'settings', label: 'Sozlamalar', icon: <SettingsIcon fontSize="small" /> }] },
]

export default function App() {
  const wh = useWarehouse()
  const pageKeys = NAV.flatMap((g) => g.items.map((i) => i.key))
  const fromHash = () => { const h = location.hash.slice(1); return pageKeys.includes(h) ? h : 'home' }
  const [page, setPageState] = useState(fromHash)
  const setPage = (p: string) => { location.hash = p; setPageState(p); window.scrollTo(0, 0) }
  useEffect(() => {
    const on = () => setPageState(fromHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  })
  const [mode, setMode] = useState<'light' | 'dark'>(() => (localStorage.getItem('ombor-mode') as 'dark') ?? 'light')
  const theme = useMemo(() => makeTheme(mode), [mode])
  const [mv, setMv] = useState<{ type: MovementType; productId?: string } | null>(null)
  const openMv = (type: MovementType, productId?: string) => setMv({ type, productId })

  const toggleMode = () => {
    const next = mode === 'light' ? 'dark' : 'light'
    setMode(next)
    localStorage.setItem('ombor-mode', next)
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Layout groups={NAV} active={page} onNavigate={setPage} mode={mode} onToggleMode={toggleMode}>
        {page === 'home' && <Dashboard wh={wh} onMovement={openMv} navigate={setPage} />}
        {page === 'sales' && (
          <Movements wh={wh} fixedType="out" title="Savdo" subtitle="Sotilgan va chiqim qilingan tovarlar" newLabel="Yangi savdo" onNew={() => openMv('out')} />
        )}
        {page === 'products' && <Products wh={wh} onMovement={openMv} />}
        {page === 'incoming' && (
          <Movements wh={wh} fixedType="in" title="Kirim" subtitle="Ta'minotchilardan qabul qilingan tovarlar" newLabel="Yangi kirim" onNew={() => openMv('in')} />
        )}
        {page === 'audit' && (
          <Movements wh={wh} fixedType="adjust" title="Inventarizatsiya" subtitle="Sanoq natijasida qoldiqqa kiritilgan tuzatishlar" newLabel="Qoldiqni tuzatish" onNew={() => openMv('adjust')} />
        )}
        {page === 'reports' && <Reports wh={wh} />}
        {page === 'history' && <Movements wh={wh} title="Barcha harakatlar" subtitle="Kirim, chiqim va inventarizatsiya tarixi" />}
        {page === 'settings' && <Settings wh={wh} />}
      </Layout>
      {mv && <MovementDialog wh={wh} initialType={mv.type} initialProductId={mv.productId} onClose={() => setMv(null)} />}
    </ThemeProvider>
  )
}
