import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Box, CircularProgress, CssBaseline, Fab, Snackbar, ThemeProvider } from '@mui/material'
import DashboardIcon from '@mui/icons-material/SpaceDashboardOutlined'
import PosIcon from '@mui/icons-material/PointOfSaleOutlined'
import CartIcon from '@mui/icons-material/ShoppingCartOutlined'
import BoxIcon from '@mui/icons-material/Inventory2Outlined'
import InIcon from '@mui/icons-material/MoveToInboxOutlined'
import TuneIcon from '@mui/icons-material/FactCheckOutlined'
import ChartIcon from '@mui/icons-material/BarChartOutlined'
import HistoryIcon from '@mui/icons-material/ReceiptLongOutlined'
import SettingsIcon from '@mui/icons-material/SettingsOutlined'
import ScanIcon from '@mui/icons-material/QrCodeScanner'
import { useWarehouse } from './store'
import type { MovementType, Product } from './types'
import { makeTheme } from './theme'
import { useCart } from './hooks/useCart'
import { useHardwareScanner } from './hooks/useHardwareScanner'
import { beep, getSeller, isMobile } from './device'
import Layout, { type NavGroup } from './components/Layout'
import Dashboard from './components/Dashboard'
import Pos from './components/Pos'
import Products from './components/Products'
import Movements from './components/Movements'
import Reports from './components/Reports'
import Settings from './components/Settings'
import MovementDialog from './components/MovementDialog'
import ProductDialog from './components/ProductDialog'
import ScanResultDialog from './components/ScanResultDialog'
import CameraScanner from './components/CameraScanner'

const NAV: NavGroup[] = [
  { items: [{ key: 'home', label: 'Bosh sahifa', icon: <DashboardIcon fontSize="small" /> }] },
  {
    title: 'SOTUV', items: [
      { key: 'pos', label: 'Kassa', icon: <PosIcon fontSize="small" /> },
      { key: 'sales', label: 'Savdolar', icon: <CartIcon fontSize="small" /> },
    ],
  },
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
const PAGE_KEYS = NAV.flatMap((g) => g.items.map((i) => i.key))
// Telefonda dastur to'g'ridan-to'g'ri kassadan ochiladi
const fromHash = () => { const h = location.hash.slice(1); return PAGE_KEYS.includes(h) ? h : isMobile() ? 'pos' : 'home' }

export default function App() {
  const wh = useWarehouse()
  const cart = useCart()
  const [page, setPageState] = useState(fromHash)
  const [mode, setMode] = useState<'light' | 'dark'>(() => (localStorage.getItem('ombor-mode') as 'dark') ?? 'light')
  const theme = useMemo(() => makeTheme(mode), [mode])
  const [seller, setSeller] = useState(getSeller())
  const [mv, setMv] = useState<{ type: MovementType; productId?: string } | null>(null)
  const [scan, setScan] = useState<{ code: string; product?: Product } | null>(null)
  const [newProduct, setNewProduct] = useState<{ barcode: string } | null>(null)
  const [camera, setCamera] = useState(false)
  const [toast, setToast] = useState('')

  const setPage = (p: string) => { location.hash = p; setPageState(p); window.scrollTo(0, 0) }
  useEffect(() => {
    const on = () => setPageState(fromHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  const toggleMode = () => {
    const next = mode === 'light' ? 'dark' : 'light'
    setMode(next)
    localStorage.setItem('ombor-mode', next)
  }

  // Skaner qilingan kod: kassada — savatga, boshqa joyda — tovar ma'lumoti
  const handleCode = useCallback((code: string) => {
    const product = wh.findByCode(code)
    if (page === 'pos' && product && product.qty > 0) {
      cart.add(product)
      beep(true)
      setToast(`Savatga qo'shildi: ${product.name}`)
      return
    }
    beep(!!product)
    setScan({ code, product })
  }, [wh, page, cart])

  const modalOpen = !!(mv || scan || newProduct || camera)
  useHardwareScanner(handleCode, !modalOpen)

  if (wh.loading) {
    return (
      <ThemeProvider theme={theme}><CssBaseline />
        <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}><CircularProgress /></Box>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Layout groups={NAV} active={page} onNavigate={setPage} mode={mode} onToggleMode={toggleMode}
        online={wh.online} seller={seller} cartCount={cart.items.length}>
        {page === 'home' && <Dashboard wh={wh} onMovement={(t, id) => setMv({ type: t, productId: id })} navigate={setPage} />}
        {page === 'pos' && <Pos wh={wh} cart={cart} onUnknownCode={(code) => setScan({ code })} />}
        {page === 'sales' && (
          <Movements wh={wh} fixedType="out" title="Savdolar" subtitle="Sotilgan tovarlar va cheklar" newLabel="Kassaga o'tish" onNew={() => setPage('pos')} />
        )}
        {page === 'products' && <Products wh={wh} onMovement={(t, id) => setMv({ type: t, productId: id })} />}
        {page === 'incoming' && (
          <Movements wh={wh} fixedType="in" title="Kirim" subtitle="Ta'minotchilardan qabul qilingan tovarlar" newLabel="Yangi kirim" onNew={() => setMv({ type: 'in' })} />
        )}
        {page === 'audit' && (
          <Movements wh={wh} fixedType="adjust" title="Inventarizatsiya" subtitle="Sanoq natijasida qoldiqqa kiritilgan tuzatishlar" newLabel="Qoldiqni tuzatish" onNew={() => setMv({ type: 'adjust' })} />
        )}
        {page === 'reports' && <Reports wh={wh} />}
        {page === 'history' && <Movements wh={wh} title="Barcha harakatlar" subtitle="Kirim, chiqim va inventarizatsiya tarixi" />}
        {page === 'settings' && <Settings wh={wh} onSellerChange={setSeller} />}
      </Layout>

      {/* Telefonda istalgan sahifadan kamera bilan tovarni tekshirish */}
      {page !== 'pos' && (
        <Fab color="primary" onClick={() => setCamera(true)} className="no-print"
          sx={{ position: 'fixed', right: 20, bottom: 20, display: { md: 'none' }, '&:hover': { bgcolor: 'secondary.main', color: '#1a1a1a' } }}>
          <ScanIcon />
        </Fab>
      )}

      <CameraScanner open={camera} onClose={() => setCamera(false)} onScan={handleCode} />
      {scan && (
        <ScanResultDialog code={scan.code} product={scan.product} onClose={() => setScan(null)}
          onAddToCart={(p) => { cart.add(p); setScan(null); setPage('pos') }}
          onIncoming={(p) => { setScan(null); setMv({ type: 'in', productId: p.id }) }}
          onCreate={(code) => { setScan(null); setNewProduct({ barcode: code }) }} />
      )}
      {newProduct && (
        <ProductDialog wh={wh} initialBarcode={newProduct.barcode} onClose={() => setNewProduct(null)}
          onSaved={(p) => setToast(`Qo'shildi: ${p.name}`)} />
      )}
      {mv && <MovementDialog wh={wh} initialType={mv.type} initialProductId={mv.productId} onClose={() => setMv(null)} />}
      <Snackbar open={!!toast} autoHideDuration={1800} onClose={() => setToast('')} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" onClose={() => setToast('')}>{toast}</Alert>
      </Snackbar>
    </ThemeProvider>
  )
}
