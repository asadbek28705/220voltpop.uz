import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, CircularProgress, CssBaseline, Fab, Snackbar, ThemeProvider } from '@mui/material'
import { useUpdateCheck } from './hooks/useUpdateCheck'
import DashboardIcon from '@mui/icons-material/SpaceDashboardOutlined'
import PosIcon from '@mui/icons-material/PointOfSaleOutlined'
import CartIcon from '@mui/icons-material/ShoppingCartOutlined'
import ReturnIcon from '@mui/icons-material/AssignmentReturnOutlined'
import BoxIcon from '@mui/icons-material/Inventory2Outlined'
import InIcon from '@mui/icons-material/MoveToInboxOutlined'
import ReceiveIcon from '@mui/icons-material/DocumentScannerOutlined'
import TuneIcon from '@mui/icons-material/FactCheckOutlined'
import ChartIcon from '@mui/icons-material/BarChartOutlined'
import HistoryIcon from '@mui/icons-material/ReceiptLongOutlined'
import SettingsIcon from '@mui/icons-material/SettingsOutlined'
import ExpenseIcon from '@mui/icons-material/MoneyOffOutlined'
import LabelIcon from '@mui/icons-material/QrCode2Outlined'
import ScanIcon from '@mui/icons-material/QrCodeScanner'
import PeopleIcon from '@mui/icons-material/PeopleAltOutlined'
import DebtIcon from '@mui/icons-material/MenuBookOutlined'
import Customers from './components/Customers'
import UsdIcon from '@mui/icons-material/AttachMoneyOutlined'
import UzsIcon from '@mui/icons-material/PaymentsOutlined'
import { useWarehouse } from './store'
import { api } from './api'
import { MeContext, useMe, type Me } from './auth'
import Login from './components/Login'
import type { MovementType, Product } from './types'
import { makeTheme } from './theme'
import { useCart } from './hooks/useCart'
import { useSaleTabs } from './hooks/useSaleTabs'
import { useHardwareScanner } from './hooks/useHardwareScanner'
import { beep, getSeller, isMobile } from './device'
import Layout, { type NavGroup } from './components/Layout'
import Dashboard from './components/Dashboard'
import Pos from './components/Pos'
import Receive from './components/Receive'
import Products from './components/Products'
import Movements from './components/Movements'
import Reports from './components/Reports'
import Expenses from './components/Expenses'
import Labels from './components/Labels'
import ExpenseDialog from './components/ExpenseDialog'
import Settings from './components/Settings'
import MovementDialog from './components/MovementDialog'
import ProductDialog from './components/ProductDialog'
import ScanResultDialog from './components/ScanResultDialog'
import CameraScanner from './components/CameraScanner'
import { t as tr } from './i18n'

const NAV: NavGroup[] = [
  { items: [{ key: 'home', admin: true, label: tr('Bosh sahifa'), icon: <DashboardIcon fontSize="small" /> }] },
  {
    title: tr('SOTUV'), items: [
      { key: 'pos', label: tr('Kassa'), icon: <PosIcon fontSize="small" /> },
      { key: 'sales', label: tr('Savdolar'), icon: <CartIcon fontSize="small" /> },
      { key: 'returns', label: tr('Qaytarilgan tovarlar'), icon: <ReturnIcon fontSize="small" /> },
      { key: 'customers', label: tr('Mijozlar'), icon: <PeopleIcon fontSize="small" /> },
      { key: 'debtors', label: tr('Qarzdorlar'), icon: <DebtIcon fontSize="small" /> },
    ],
  },
  {
    title: tr('OMBOR'), items: [
      { key: 'products', label: tr('Tovarlar'), icon: <BoxIcon fontSize="small" /> },
      { key: 'products-usd', label: tr('Dollarda olinadigan'), icon: <UsdIcon fontSize="small" /> },
      { key: 'products-uzs', label: tr("So'mda olinadigan"), icon: <UzsIcon fontSize="small" /> },
      { key: 'receive', label: tr('Skaner bilan qabul'), icon: <ReceiveIcon fontSize="small" /> },
      { key: 'incoming', label: tr('Kirim'), icon: <InIcon fontSize="small" /> },
      { key: 'audit', admin: true, label: tr('Inventarizatsiya'), icon: <TuneIcon fontSize="small" /> },
      { key: 'labels', label: tr('Shtrix-kod chop etish'), icon: <LabelIcon fontSize="small" /> },
    ],
  },
  {
    title: tr('MOLIYA'), items: [
      { key: 'reports', admin: true, label: tr('Hisobotlar'), icon: <ChartIcon fontSize="small" /> },
      { key: 'expenses', admin: true, label: tr('Xarajatlar'), icon: <ExpenseIcon fontSize="small" /> },
      { key: 'history', admin: true, label: tr('Barcha harakatlar'), icon: <HistoryIcon fontSize="small" /> },
    ],
  },
  { title: tr('SOZLAMALAR'), items: [{ key: 'settings', label: tr('Sozlamalar'), icon: <SettingsIcon fontSize="small" /> }] },
]
const buyPriceOf = (p: Product) => p.buyPrice
/** Sotuvchiga faqat kassa (va parol/chiqish uchun sozlamalar) */
const SELLER_PAGES = ['pos', 'settings']
const navFor = (admin: boolean) =>
  NAV.map((g) => ({ ...g, items: g.items.filter((i) => admin || SELLER_PAGES.includes(i.key)) })).filter((g) => g.items.length)

function useThemeMode() {
  const [mode, setMode] = useState<'light' | 'dark'>(() => (localStorage.getItem('ombor-mode') as 'dark') ?? 'light')
  const theme = useMemo(() => makeTheme(mode), [mode])
  const toggle = () => {
    const next = mode === 'light' ? 'dark' : 'light'
    setMode(next)
    localStorage.setItem('ombor-mode', next)
  }
  return { mode, theme, toggle }
}

/** Avval kim kirganini aniqlaymiz: login bo'lmasa — login sahifasi */
export default function App() {
  const { mode, theme, toggle } = useThemeMode()
  const [me, setMe] = useState<Me | null>(null)
  const [failed, setFailed] = useState(false)
  const load = useCallback(() => {
    api<Me>('GET', '/me').then((m) => { setMe(m); setFailed(false) }).catch(() => setFailed(true))
  }, [])
  useEffect(() => {
    load()
    const on = () => setMe((m) => (m ? { ...m, user: null } : m))
    window.addEventListener('ombor-unauthorized', on)
    return () => window.removeEventListener('ombor-unauthorized', on)
  }, [load])

  let body
  if (!me) {
    body = (
      <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh', p: 2 }}>
        {failed ? <Alert severity="error" action={<button onClick={load}>{tr("Qayta")}</button>}>{tr("Server bilan aloqa yo'q")}</Alert> : <CircularProgress />}
      </Box>
    )
  } else if (!me.user) {
    body = <Login me={me} onDone={() => location.reload()} />
  } else {
    body = <Main mode={mode} onToggleMode={toggle} />
  }
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MeContext.Provider value={me ?? { user: null, demo: false, needsSetup: false, canSetup: false }}>{body}</MeContext.Provider>
    </ThemeProvider>
  )
}

function Main({ mode, onToggleMode }: { mode: 'light' | 'dark'; onToggleMode: () => void }) {
  const me = useMe()
  const admin = me.user?.role === 'admin'
  const nav = useMemo(() => navFor(admin), [admin])
  const pageKeys = useMemo(() => nav.flatMap((g) => g.items.map((i) => i.key)), [nav])
  // Telefonda va sotuvchida dastur to'g'ridan-to'g'ri kassadan ochiladi
  const fromHash = useCallback(() => {
    const h = location.hash.slice(1)
    return pageKeys.includes(h) ? h : isMobile() || !admin ? 'pos' : 'home'
  }, [pageKeys, admin])
  const wh = useWarehouse()
  const sale = useSaleTabs() // kassadagi xaridor oynalari
  const cart = sale.cart
  const receiving = useCart('ombor-receive', buyPriceOf)
  const [page, setPageState] = useState(fromHash)
  const [seller, setSeller] = useState(me.demo ? getSeller() : me.user?.name ?? '')
  const [mv, setMv] = useState<{ type: MovementType; productId?: string } | null>(null)
  const [scan, setScan] = useState<{ code: string; product?: Product } | null>(null)
  const [newProduct, setNewProduct] = useState<{ barcode: string; forReceive?: boolean } | null>(null)
  const [camera, setCamera] = useState(false)
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [toast, setToast] = useState('')

  const setPage = (p: string) => { location.hash = p; setPageState(p); window.scrollTo(0, 0) }
  useEffect(() => {
    const on = () => setPageState(fromHash())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [fromHash])

  // Skaner qilingan kod: kassada — savatga, boshqa joyda — tovar ma'lumoti
  const handleCode = useCallback((code: string) => {
    const product = wh.findByCode(code)
    if (page === 'pos' && product && product.qty > 0) {
      cart.add(product)
      beep(true)
      setToast(tr("Savatga qo'shildi: {0}", product.name))
      return
    }
    if (page === 'receive') {
      if (product) {
        receiving.add(product)
        beep(true)
        setToast(tr("Qabul ro'yxatiga: {0}", product.name))
      } else {
        beep(false)
        if (admin) setNewProduct({ barcode: code, forReceive: true })
        else setScan({ code })
      }
      return
    }
    beep(!!product)
    setScan({ code, product })
  }, [wh, page, cart, receiving, admin])

  const modalOpen = !!(mv || scan || newProduct || camera || expenseOpen)
  useHardwareScanner(handleCode, !modalOpen)
  // Yangi versiya: savat bo'sh bo'lsa — o'zi yangilanadi, aks holda tugma ko'rsatiladi
  const updateReady = useUpdateCheck()
  useEffect(() => { if (updateReady && sale.itemCount === 0 && !modalOpen) location.reload() }, [updateReady, sale.itemCount, modalOpen])

  if (wh.loading) {
    return <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}><CircularProgress /></Box>
  }

  return (
    <>
      <Layout groups={nav} active={page} onNavigate={setPage} mode={mode} onToggleMode={onToggleMode}
        online={wh.online} seller={seller} role={me.demo ? 'demo' : admin ? 'admin' : 'seller'} cartCount={sale.itemCount}>
        {page === 'home' && <Dashboard wh={wh} onMovement={(t, id) => setMv({ type: t, productId: id })} navigate={setPage} onExpense={() => setExpenseOpen(true)} />}
        {page === 'pos' && <Pos wh={wh} sale={sale} onUnknownCode={(code) => setScan({ code })} />}
        {(page === 'customers' || page === 'debtors') && (
          <Customers key={page} wh={wh} debtorsOnly={page === 'debtors'} onSell={(c) => { sale.openForCustomer(c.id); setPage('pos') }} />
        )}
        {page === 'sales' && (
          <Movements key="sales" wh={wh} fixedType="out" title={tr("Savdolar")} subtitle={tr("Sotilgan tovarlar va cheklar")} newLabel={tr("Kassaga o'tish")} onNew={() => setPage('pos')} />
        )}
        {page === 'returns' && (
          <Movements key="returns" wh={wh} fixedType="return" title={tr("Qaytarilgan tovarlar")} subtitle={tr("Mijoz qaytargan tovarlar omborga tushadi, pul qaytarilgani yoziladi")} />
        )}
        {page === 'receive' && (
          <Receive wh={wh} list={receiving} onUnknownCode={(code) => (admin ? setNewProduct({ barcode: code, forReceive: true }) : setScan({ code }))} onDone={setToast} />
        )}
        {page === 'products' && <Products wh={wh} onMovement={(t, id) => setMv({ type: t, productId: id })} />}
        {page === 'products-usd' && <Products key="usd" wh={wh} currency="USD" onMovement={(t, id) => setMv({ type: t, productId: id })} />}
        {page === 'products-uzs' && <Products key="uzs" wh={wh} currency="UZS" onMovement={(t, id) => setMv({ type: t, productId: id })} />}
        {page === 'incoming' && (
          <Movements key="incoming" wh={wh} fixedType="in" title={tr("Kirim")} subtitle={tr("Ta'minotchilardan qabul qilingan tovarlar")} newLabel={tr("Yangi kirim")} onNew={() => setMv({ type: 'in' })} />
        )}
        {page === 'audit' && (
          <Movements key="audit" wh={wh} fixedType="adjust" title={tr("Inventarizatsiya")} subtitle={tr("Sanoq natijasida qoldiqqa kiritilgan tuzatishlar")} newLabel={tr("Qoldiqni tuzatish")} onNew={() => setMv({ type: 'adjust' })} />
        )}
        {page === 'reports' && <Reports wh={wh} />}
        {page === 'expenses' && <Expenses wh={wh} />}
        {page === 'labels' && <Labels wh={wh} />}
        {page === 'history' && <Movements key="history" wh={wh} title={tr("Barcha harakatlar")} subtitle={tr("Kirim, chiqim va inventarizatsiya tarixi")} />}
        {page === 'settings' && <Settings wh={wh} onSellerChange={setSeller} />}
      </Layout>

      {/* Telefonda istalgan sahifadan kamera bilan tovarni tekshirish */}
      {page !== 'pos' && page !== 'receive' && (
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
          onCreate={admin ? (code) => { setScan(null); setNewProduct({ barcode: code }) } : undefined} />
      )}
      {newProduct && (
        <ProductDialog wh={wh} initialBarcode={newProduct.barcode} noInitialQty={newProduct.forReceive} onClose={() => setNewProduct(null)}
          onSaved={(p) => {
            if (newProduct.forReceive) { receiving.add(p); setToast(tr("Yangi tovar qabul ro'yxatiga qo'shildi: {0}", p.name)) }
            else setToast(tr("Qo'shildi: {0}", p.name))
          }} />
      )}
      {expenseOpen && <ExpenseDialog wh={wh} onClose={() => setExpenseOpen(false)} />}
      {mv && <MovementDialog wh={wh} initialType={mv.type} initialProductId={mv.productId} onClose={() => setMv(null)} />}
      <Snackbar open={updateReady && sale.itemCount > 0} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="info" variant="filled" action={<Button color="inherit" size="small" onClick={() => location.reload()}>{tr("Yangilash")}</Button>}>
          {tr("Dasturning yangi versiyasi chiqdi")}
        </Alert>
      </Snackbar>
      <Snackbar open={!!toast} autoHideDuration={1800} onClose={() => setToast('')} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" onClose={() => setToast('')}>{toast}</Alert>
      </Snackbar>
    </>
  )
}
