import { useEffect, useMemo, useState } from 'react'
import {
  Alert, Autocomplete, Box, Button, Card, Chip, Divider, IconButton, InputAdornment, Paper, Stack, TextField,
  ToggleButton, ToggleButtonGroup, Typography, useMediaQuery, useTheme,
} from '@mui/material'
import CameraIcon from '@mui/icons-material/QrCodeScanner'
import SearchIcon from '@mui/icons-material/Search'
import DeleteIcon from '@mui/icons-material/DeleteOutline'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import CartIcon from '@mui/icons-material/ShoppingCartOutlined'
import type { Warehouse } from '../store'
import type { SaleTabs } from '../hooks/useSaleTabs'
import { MAX_TABS } from '../hooks/useSaleTabs'
import CloseIcon from '@mui/icons-material/Close'
import ReturnIcon from '@mui/icons-material/AssignmentReturnOutlined'
import ReturnDialog from './ReturnDialog'
import QuickPanel from './QuickPanel'
import DebtPayDialog from './DebtPayDialog'
import MyReceiptsDialog from './MyReceiptsDialog'
import ReceiptsIcon from '@mui/icons-material/ReceiptLongOutlined'
import PayIcon from '@mui/icons-material/PaymentsOutlined'
import type { Customer, Payment, Product } from '../types'
import { SALE_PAYMENTS } from '../types'
import PersonIcon from '@mui/icons-material/PersonOutline'
import CustomerDialog from './CustomerDialog'
import { matchCustomer } from './Customers'
import { attempt } from '../api'
import { useIsAdmin } from '../auth'
import { beep } from '../device'
import { fmtMoney, fmtNum } from '../utils'
import PageHeader from './PageHeader'
import CameraScanner from './CameraScanner'
import ReceiptDialog from './ReceiptDialog'
import { t as tr } from '../i18n'

interface Props { wh: Warehouse; sale: SaleTabs; onUnknownCode: (code: string) => void }
type NewOption = { newName: string }

const num = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.'))

export default function Pos({ wh, sale, onUnknownCode }: Props) {
  const { cart, tab, patch } = sale
  // Har bir xaridor oynasining o'z mijozi, to'lov usuli va savati bor
  const customerId = tab.customerId
  const customer = tab.customerText // bazada yo'q, bir martalik mijoz nomi
  const payment = tab.payment
  const paidNow = tab.paidNow
  const onCustomerChange = (id: string) => patch({ customerId: id })
  const setCustomer = (v: string) => patch({ customerText: v })
  const setPayment = (v: Payment) => patch({ payment: v })
  const setPaidNow = (v: string) => patch({ paidNow: v })
  const [returning, setReturning] = useState(false)
  const [debtPay, setDebtPay] = useState(false)
  const [myReceipts, setMyReceipts] = useState(false)
  const [returnReceipt, setReturnReceipt] = useState<string | null>(null)
  const theme = useTheme()
  const mobile = useMediaQuery(theme.breakpoints.down('md'))
  const { products } = wh.data
  const [input, setInput] = useState('')
  const [camera, setCamera] = useState(false)
  const [newCustomer, setNewCustomer] = useState<string | null>(null)
  const selected = wh.data.customers.find((c) => c.id === customerId) ?? null

  // Shu mijoz oldin ko'p olgan tovarlar — bir bosishda savatga
  const usual = useMemo(() => {
    if (!selected) return []
    const map = new Map<string, number>()
    for (const m of wh.data.movements) if (m.type === 'out' && m.customerId === selected.id) map.set(m.productId, (map.get(m.productId) ?? 0) + 1)
    return [...map].sort((a, b) => b[1] - a[1]).map(([id]) => products.find((p) => p.id === id)).filter((p): p is Product => !!p).slice(0, 12)
  }, [selected, wh.data.movements, products])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [receipt, setReceipt] = useState<string | null>(null)
  useEffect(() => setError(''), [tab.id])

  const admin = useIsAdmin()
  const lines = cart.items
    .map((it) => { const product = products.find((p) => p.id === it.productId); return { ...it, product, price: !admin && product ? product.sellPrice : it.price } })
    .filter((l): l is typeof l & { product: Product } => !!l.product)
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0)
  const short = lines.filter((l) => l.qty > l.product.qty)

  const addProduct = (p: Product) => {
    if (p.qty <= 0) { beep(false); setError(tr("\"{0}\" omborda qolmagan", p.name)); return }
    cart.add(p)
    beep(true)
    setError('')
  }
  const addByCode = (code: string) => {
    const p = wh.findByCode(code)
    if (p) addProduct(p)
    else { beep(false); onUnknownCode(code) }
  }

  const checkout = async () => {
    setError('')
    if (!lines.length) return
    if (short.length) return setError(tr("Omborda yetarli bo'lmagan tovarlar bor"))
    if (payment === 'nasiya' && !selected) return setError(tr("Nasiya uchun mijozni tanlang yoki yangi mijoz qo'shing"))
    const paid = payment === 'nasiya' ? Math.round(num(paidNow) || 0) : 0
    if (paid >= total && paid > 0) return setError(tr("To'liq to'layapti — naqd yoki kartani tanlang"))
    const tabId = tab.id
    setBusy(true)
    const r = await attempt(() => wh.sell({
      items: lines.map((l) => ({ productId: l.productId, qty: l.qty, price: l.price })),
      counterparty: selected ? selected.name : customer.trim(), note: '', payment,
      customerId: selected?.id, paidNow: paid || undefined, paidNowPayment: 'naqd',
    }))
    setBusy(false)
    if (!r.ok) return setError(r.error)
    sale.close(tabId) // shu xaridor oynasi yopiladi, qolganlari turadi
    setReceipt(r.value.saleId)
  }

  const search = (
    <Stack direction="row" spacing={1}>
      <Autocomplete
        freeSolo fullWidth
        options={products}
        inputValue={input}
        onInputChange={(_, v, reason) => reason !== 'reset' && setInput(v)}
        value={null}
        onChange={(_, v) => {
          if (typeof v === 'string') { if (v.trim()) addByCode(v) }
          else if (v) addProduct(v)
          setInput('')
        }}
        filterOptions={(opts, { inputValue }) => {
          const s = inputValue.trim().toLowerCase()
          if (!s) return []
          return opts.filter((p) => p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s) || p.barcode.includes(s)).slice(0, 30)
        }}
        getOptionLabel={(p) => (typeof p === 'string' ? p : p.name)}
        renderOption={(props, p) => (
          <li {...props} key={p.id}>
            <Stack direction="row" justifyContent="space-between" sx={{ width: '100%' }} spacing={2}>
              <Box>
                <Typography>{p.name}</Typography>
                <Typography variant="caption" color="text.secondary">{p.sku} · {tr('{0} {1} bor', fmtNum(p.qty), tr(p.unit))}</Typography>
              </Box>
              <Typography sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtMoney(p.sellPrice)}</Typography>
            </Stack>
          </li>
        )}
        renderInput={(params) => (
          <TextField {...params} autoFocus={!mobile} placeholder={tr("Skaner qiling yoki tovar nomini yozing")}
            slotProps={{ input: { ...params.InputProps, startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }} />
        )}
      />
      <Button variant="contained" onClick={() => setCamera(true)} sx={{ minWidth: 56, px: mobile ? 1.5 : 2 }} startIcon={mobile ? undefined : <CameraIcon />}>
        {mobile ? <CameraIcon /> : tr("Kamera")}
      </Button>
    </Stack>
  )

  const cartList = (
    <Stack spacing={1.25}>
      {lines.length === 0 && (
        <Paper variant="outlined" sx={{ p: 5, textAlign: 'center', color: 'text.secondary' }}>
          <CartIcon sx={{ fontSize: 48, opacity: 0.4 }} />
          <Typography>{tr("Savat bo'sh. Tovarni skaner qiling yoki qidiring.")}</Typography>
        </Paper>
      )}
      {lines.map((l) => {
        const over = l.qty > l.product.qty
        return (
          <Card key={l.productId} sx={{ p: 1.5, borderColor: over ? 'error.main' : undefined }}>
            <Stack direction="row" alignItems="flex-start" spacing={1}>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 600 }}>{l.product.name}</Typography>
                <Typography variant="caption" color={over ? 'error' : 'text.secondary'}>
                  {tr("Omborda:")} {fmtNum(l.product.qty)} {tr(l.product.unit)}{over && tr(" — yetarli emas!")}
                </Typography>
              </Box>
              <IconButton size="small" onClick={() => cart.remove(l.productId)}><DeleteIcon fontSize="small" /></IconButton>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
              <Stack direction="row" alignItems="center" sx={{ border: 1, borderColor: 'divider', borderRadius: 2.5 }}>
                <IconButton size="small" onClick={() => l.qty > 1 ? cart.update(l.productId, { qty: l.qty - 1 }) : cart.remove(l.productId)}><RemoveIcon fontSize="small" /></IconButton>
                <TextField variant="standard" value={l.qty} inputMode="decimal"
                  onChange={(e) => { const v = num(e.target.value); if (!isNaN(v)) cart.update(l.productId, { qty: v }) }}
                  slotProps={{ input: { disableUnderline: true }, htmlInput: { style: { textAlign: 'center', width: 56, fontWeight: 700 } } }} />
                <IconButton size="small" onClick={() => cart.update(l.productId, { qty: l.qty + 1 })}><AddIcon fontSize="small" /></IconButton>
              </Stack>
              <Typography color="text.secondary">{tr(l.product.unit)} ×</Typography>
              {admin ? (
                <TextField size="small" value={l.price} inputMode="decimal" sx={{ width: 160 }}
                  onChange={(e) => { const v = num(e.target.value); if (!isNaN(v)) cart.update(l.productId, { price: v }) }}
                  slotProps={{ input: { endAdornment: <InputAdornment position="end">{tr("so'm")}</InputAdornment> } }} />
              ) : (
                // Sotuvchi narxni o'zgartira olmaydi — tovarning sotuv narxi
                <Typography sx={{ fontWeight: 600 }}>{fmtMoney(l.price)}</Typography>
              )}
              <Typography sx={{ ml: 'auto !important', fontWeight: 700 }}>{fmtMoney(l.qty * l.price)}</Typography>
            </Stack>
          </Card>
        )
      })}
    </Stack>
  )

  const summary = (
    <Card sx={{ p: 2.5, position: { md: 'sticky' }, top: { md: 88 } }}>
      <Stack spacing={2}>
        <Autocomplete<Customer | NewOption, false, false, true>
          freeSolo size="small"
          options={wh.data.customers as (Customer | NewOption)[]}
          value={selected}
          inputValue={selected ? selected.name : customer}
          onInputChange={(_, v, reason) => { if (reason === 'input') { setCustomer(v); if (selected) onCustomerChange('') } }}
          onChange={(_, v) => {
            if (v && typeof v === 'object' && 'newName' in v) { setNewCustomer(v.newName); return }
            if (v && typeof v === 'object') { onCustomerChange(v.id); setCustomer('') }
            else if (!v) { onCustomerChange(''); setCustomer('') }
          }}
          filterOptions={(opts, { inputValue }) => {
            const found = (opts as Customer[]).filter((c) => 'id' in c && matchCustomer(c, inputValue)).slice(0, 20) as (Customer | NewOption)[]
            const t = inputValue.trim()
            if (t && !found.some((c) => 'name' in c && c.name.toLowerCase() === t.toLowerCase())) found.push({ newName: t })
            return found
          }}
          getOptionLabel={(o) => (typeof o === 'string' ? o : 'newName' in o ? o.newName : o.name)}
          isOptionEqualToValue={(a, b) => 'id' in a && 'id' in b && a.id === b.id}
          renderOption={(props, o) => 'newName' in o ? (
            <li {...props} key="__new"><Typography color="primary" sx={{ fontWeight: 600 }}>{tr("➕ Yangi mijoz: «")}{o.newName}»</Typography></li>
          ) : (
            <li {...props} key={o.id}>
              <Stack direction="row" justifyContent="space-between" sx={{ width: '100%' }} spacing={1}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography noWrap>{o.name}</Typography>
                  {o.phone && <Typography variant="caption" color="text.secondary">{o.phone}</Typography>}
                </Box>
                {o.debt > 0 && <Typography variant="body2" color="error" sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{tr('qarz {0}', fmtMoney(o.debt))}</Typography>}
              </Stack>
            </li>
          )}
          renderInput={(params) => (
            <TextField {...params} label={tr("Mijoz")} placeholder={tr("Ism yoki telefon bilan qidiring")}
              slotProps={{ input: { ...params.InputProps, startAdornment: <><InputAdornment position="start"><PersonIcon fontSize="small" /></InputAdornment>{params.InputProps.startAdornment}</> } }} />
          )}
        />
        {selected && (
          <Box sx={{ mt: '8px !important' }}>
            {selected.debt > 0 && <Typography variant="body2" color="error" sx={{ fontWeight: 600 }}>{tr("Oldingi qarzi:")} {fmtMoney(selected.debt)}</Typography>}
            {usual.length > 0 && <>
              <Typography variant="caption" color="text.secondary">{tr("Odatda oladi — bosing, savatga tushadi:")}</Typography>
              <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75} sx={{ mt: 0.5 }}>
                {usual.map((p) => <Chip key={p.id} size="small" label={p.name} onClick={() => addProduct(p)} variant="outlined" disabled={p.qty <= 0} />)}
              </Stack>
            </>}
          </Box>
        )}
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>{tr("To'lov usuli")}</Typography>
          <ToggleButtonGroup exclusive fullWidth size="small" value={payment} onChange={(_, v) => v && setPayment(v)}>
            {SALE_PAYMENTS.map((p) => (
              <ToggleButton key={p.value} value={p.value} color={p.value === 'nasiya' ? 'error' : 'primary'} sx={{ px: 0.5 }}>
                {p.value === 'otkazma' ? tr("O'tkazma") : p.value === 'nasiya' ? tr("Nasiya") : p.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
        {payment === 'nasiya' && (
          <Stack spacing={1}>
            {!selected && <Alert severity="warning" sx={{ py: 0 }}>{tr("Nasiya uchun mijozni tanlang")}</Alert>}
            <TextField size="small" label={tr("Hozir to'lagani (ixtiyoriy)")} value={paidNow} onChange={(e) => setPaidNow(e.target.value)} inputMode="decimal"
              slotProps={{ input: { endAdornment: <InputAdornment position="end">{tr("so'm")}</InputAdornment> } }} />
            {selected && total > 0 && (
              <Typography variant="body2">
                {tr("Qarzga yoziladi:")} <b>{fmtMoney(total - (num(paidNow) || 0))}</b>
                {selected.debt > 0 && <> {tr("· Umumiy qarzi bo'ladi:")} <b style={{ color: '#E5533D' }}>{fmtMoney(selected.debt + total - (num(paidNow) || 0))}</b></>}
              </Typography>
            )}
          </Stack>
        )}
        <Divider />
        <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">{tr("Tovarlar")}</Typography><Typography>{tr('{0} xil', lines.length)}</Typography></Stack>
        <Stack direction="row" justifyContent="space-between" alignItems="baseline">
          <Typography variant="h6">{tr("Jami")}</Typography>
          <Typography variant="h5" sx={{ color: 'primary.main' }}>{fmtMoney(total)}</Typography>
        </Stack>
        {error && <Alert severity="error">{error}</Alert>}
        {!mobile && (
          <Button variant="contained" size="large" disabled={!lines.length || busy} onClick={checkout} sx={{ py: 1.5, fontSize: 17 }}>
            {busy ? tr("Saqlanmoqda...") : tr("Sotish")}
          </Button>
        )}
        {lines.length > 0 && <Button color="inherit" onClick={() => confirm(tr("Savat tozalansinmi?")) && cart.clear()}>{tr("Savatni tozalash")}</Button>}
      </Stack>
    </Card>
  )

  return (
    <Box sx={{ pb: mobile ? 'calc(80px + env(safe-area-inset-bottom))' : 0 }}>
      <PageHeader title={tr("Kassa")} subtitle={tr("Shtrix-kodni skaner qiling — tovar savatga tushadi")} actions={<>
        <Button variant="outlined" startIcon={<ReceiptsIcon />} onClick={() => setMyReceipts(true)}>{tr("Bugungi cheklarim")}</Button>
        <Button variant="outlined" startIcon={<PayIcon />} onClick={() => setDebtPay(true)}>{tr("Qarz to'lovi")}</Button>
        <Button color="warning" variant="outlined" startIcon={<ReturnIcon />} onClick={() => setReturning(true)}>{tr("Tovar qaytarish")}</Button>
      </>} />
      {/* Xaridor oynalari: bir xaridor bilan ishlayotganda ikkinchisi kelsa — yangi oyna */}
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1.5, overflowX: 'auto', pb: 0.5 }} className="no-print">
        {sale.tabs.map((x) => {
          const on = x.id === tab.id
          const c = x.customerId ? wh.data.customers.find((k) => k.id === x.customerId)?.name : x.customerText
          const sum = x.items.reduce((s, it) => s + it.qty * it.price, 0)
          const info = c || (sum > 0 ? fmtMoney(sum) : '')
          const closable = sale.tabs.length > 1 || x.items.length > 0
          return (
            <Box key={x.id} onClick={() => sale.select(x.id)} title={info || tr("bo'sh")}
              sx={{
                height: 30, pl: 1.25, pr: closable ? 0.25 : 1.25, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.5,
                borderRadius: 999, border: 1.5, borderColor: on ? 'primary.main' : 'divider',
                bgcolor: on ? 'primary.main' : 'background.paper', color: on ? 'primary.contrastText' : 'text.primary',
                fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
              }}>
              {tr("Xaridor {0}", x.n)}
              {x.items.length > 0 && (
                <Box component="span" sx={{ minWidth: 18, height: 18, px: 0.5, borderRadius: 999, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700,
                  bgcolor: on ? 'rgba(255,255,255,.25)' : 'action.selected' }}>{x.items.length}</Box>
              )}
              {info && <Box component="span" sx={{ fontSize: 12, fontWeight: 400, opacity: 0.8, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis' }}>· {info}</Box>}
              {closable && (
                <IconButton size="small" aria-label={tr("Oynani yopish")} sx={{ p: 0.25, color: 'inherit', opacity: 0.7 }} onClick={(e) => {
                  e.stopPropagation()
                  if (!x.items.length || confirm(tr("«Xaridor {0}» oynasi yopilsinmi? Savatdagi tovarlar o'chadi.", x.n))) sale.close(x.id)
                }}><CloseIcon sx={{ fontSize: 15 }} /></IconButton>
              )}
            </Box>
          )
        })}
        <Button size="small" variant="contained" color="secondary" disableElevation startIcon={<AddIcon sx={{ fontSize: '16px !important' }} />}
          onClick={() => sale.newTab()} disabled={sale.tabs.length >= MAX_TABS}
          sx={{ flexShrink: 0, whiteSpace: 'nowrap', borderRadius: 999, height: 30, px: 1.5, fontSize: 13, minWidth: 0 }}>
          {tr("Yangi xaridor")}
        </Button>
      </Stack>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
        <Stack spacing={2} sx={{ flex: 1, width: '100%', minWidth: 0 }}>
          {search}
          <QuickPanel wh={wh} admin={admin} onAdd={addProduct} />
          {cartList}
        </Stack>
        <Box sx={{ width: { xs: '100%', md: 360 }, flexShrink: 0 }}>{summary}</Box>
      </Stack>

      {mobile && (
        <Paper elevation={8} className="no-print"
          sx={{ position: 'fixed', left: 0, right: 0, bottom: 0, p: 1.5, pb: 'calc(12px + env(safe-area-inset-bottom))', zIndex: 20, borderRadius: 0, borderTop: 1, borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="caption" color="text.secondary">{tr("Jami")}</Typography>
              <Typography variant="h6" sx={{ lineHeight: 1.1 }}>{fmtMoney(total)}</Typography>
            </Box>
            <IconButton onClick={() => setCamera(true)} sx={{ border: 1, borderColor: 'divider' }}><CameraIcon /></IconButton>
            <Button variant="contained" size="large" disabled={!lines.length || busy} onClick={checkout} sx={{ px: 4, py: 1.25 }}>
              {busy ? '...' : tr("Sotish")}
            </Button>
          </Stack>
        </Paper>
      )}

      <CameraScanner open={camera} continuous title={tr("Kassa: skaner qiling")} onClose={() => setCamera(false)} onScan={addByCode} />
      {newCustomer != null && <CustomerDialog wh={wh} initialName={newCustomer} onClose={() => setNewCustomer(null)}
        onSaved={(c) => { onCustomerChange(c.id); setCustomer('') }} />}
      {receipt && <ReceiptDialog wh={wh} saleId={receipt} justSold onClose={() => setReceipt(null)} />}
      {debtPay && <DebtPayDialog wh={wh} onClose={() => setDebtPay(false)} />}
      {myReceipts && <MyReceiptsDialog wh={wh} onClose={() => setMyReceipts(false)} />}
      {returning && <ReturnDialog wh={wh} onClose={() => setReturning(false)} onDone={(id) => { setReturning(false); setReturnReceipt(id) }} />}
      {returnReceipt && <ReceiptDialog wh={wh} returnId={returnReceipt} justReturned onClose={() => setReturnReceipt(null)} />}
    </Box>
  )
}
