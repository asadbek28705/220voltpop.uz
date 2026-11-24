import { useMemo, useState } from 'react'
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
import type { Cart } from '../hooks/useCart'
import type { Customer, Payment, Product } from '../types'
import { SALE_PAYMENTS } from '../types'
import PersonIcon from '@mui/icons-material/PersonOutline'
import CustomerDialog from './CustomerDialog'
import { matchCustomer } from './Customers'
import { attempt } from '../api'
import { beep } from '../device'
import { fmtMoney, fmtNum } from '../utils'
import PageHeader from './PageHeader'
import CameraScanner from './CameraScanner'
import ReceiptDialog from './ReceiptDialog'
import { t as tr } from '../i18n'

interface Props {
  wh: Warehouse; cart: Cart; onUnknownCode: (code: string) => void
  customerId: string; onCustomerChange: (id: string) => void
}
type NewOption = { newName: string }

const num = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.'))

export default function Pos({ wh, cart, onUnknownCode, customerId, onCustomerChange }: Props) {
  const theme = useTheme()
  const mobile = useMediaQuery(theme.breakpoints.down('md'))
  const { products } = wh.data
  const [input, setInput] = useState('')
  const [camera, setCamera] = useState(false)
  const [customer, setCustomer] = useState('') // bazada yo'q, bir martalik mijoz nomi
  const [newCustomer, setNewCustomer] = useState<string | null>(null)
  const [payment, setPayment] = useState<Payment>('naqd')
  const [paidNow, setPaidNow] = useState('')
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

  const lines = cart.items
    .map((it) => ({ ...it, product: products.find((p) => p.id === it.productId) }))
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
    setBusy(true)
    const r = await attempt(() => wh.sell({
      items: lines.map((l) => ({ productId: l.productId, qty: l.qty, price: l.price })),
      counterparty: selected ? selected.name : customer.trim(), note: '', payment,
      customerId: selected?.id, paidNow: paid || undefined, paidNowPayment: 'naqd',
    }))
    setBusy(false)
    if (!r.ok) return setError(r.error)
    cart.clear()
    setCustomer('')
    onCustomerChange('')
    setPayment('naqd')
    setPaidNow('')
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
              <TextField size="small" value={l.price} inputMode="decimal" sx={{ width: 160 }}
                onChange={(e) => { const v = num(e.target.value); if (!isNaN(v)) cart.update(l.productId, { price: v }) }}
                slotProps={{ input: { endAdornment: <InputAdornment position="end">{tr("so'm")}</InputAdornment> } }} />
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
    <Box sx={{ pb: mobile ? 10 : 0 }}>
      <PageHeader title={tr("Kassa")} subtitle={tr("Shtrix-kodni skaner qiling — tovar savatga tushadi")} />
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
        <Stack spacing={2} sx={{ flex: 1, width: '100%', minWidth: 0 }}>
          {search}
          {cartList}
        </Stack>
        <Box sx={{ width: { xs: '100%', md: 360 }, flexShrink: 0 }}>{summary}</Box>
      </Stack>

      {mobile && (
        <Paper elevation={8} className="no-print"
          sx={{ position: 'fixed', left: 0, right: 0, bottom: 0, p: 1.5, zIndex: 20, borderRadius: 0, borderTop: 1, borderColor: 'divider' }}>
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
    </Box>
  )
}
