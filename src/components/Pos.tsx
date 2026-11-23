import { useState } from 'react'
import {
  Alert, Autocomplete, Box, Button, Card, Divider, IconButton, InputAdornment, Paper, Stack, TextField,
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
import type { Payment, Product } from '../types'
import { PAYMENTS } from '../types'
import { attempt } from '../api'
import { beep } from '../device'
import { fmtMoney, fmtNum } from '../utils'
import PageHeader from './PageHeader'
import CameraScanner from './CameraScanner'
import ReceiptDialog from './ReceiptDialog'

interface Props { wh: Warehouse; cart: Cart; onUnknownCode: (code: string) => void }

const num = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.'))

export default function Pos({ wh, cart, onUnknownCode }: Props) {
  const theme = useTheme()
  const mobile = useMediaQuery(theme.breakpoints.down('md'))
  const { products } = wh.data
  const [input, setInput] = useState('')
  const [camera, setCamera] = useState(false)
  const [customer, setCustomer] = useState('')
  const [payment, setPayment] = useState<Payment>('naqd')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [receipt, setReceipt] = useState<string | null>(null)

  const lines = cart.items
    .map((it) => ({ ...it, product: products.find((p) => p.id === it.productId) }))
    .filter((l): l is typeof l & { product: Product } => !!l.product)
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0)
  const short = lines.filter((l) => l.qty > l.product.qty)

  const addProduct = (p: Product) => {
    if (p.qty <= 0) { beep(false); setError(`"${p.name}" omborda qolmagan`); return }
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
    if (short.length) return setError('Omborda yetarli bo\'lmagan tovarlar bor')
    setBusy(true)
    const r = await attempt(() => wh.sell({
      items: lines.map((l) => ({ productId: l.productId, qty: l.qty, price: l.price })),
      counterparty: customer.trim(), note: '', payment,
    }))
    setBusy(false)
    if (!r.ok) return setError(r.error)
    cart.clear()
    setCustomer('')
    setPayment('naqd')
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
                <Typography variant="caption" color="text.secondary">{p.sku} · {fmtNum(p.qty)} {p.unit} bor</Typography>
              </Box>
              <Typography sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtMoney(p.sellPrice)}</Typography>
            </Stack>
          </li>
        )}
        renderInput={(params) => (
          <TextField {...params} autoFocus={!mobile} placeholder="Skaner qiling yoki tovar nomini yozing"
            slotProps={{ input: { ...params.InputProps, startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }} />
        )}
      />
      <Button variant="contained" onClick={() => setCamera(true)} sx={{ minWidth: 56, px: mobile ? 1.5 : 2 }} startIcon={mobile ? undefined : <CameraIcon />}>
        {mobile ? <CameraIcon /> : 'Kamera'}
      </Button>
    </Stack>
  )

  const cartList = (
    <Stack spacing={1.25}>
      {lines.length === 0 && (
        <Paper variant="outlined" sx={{ p: 5, textAlign: 'center', color: 'text.secondary' }}>
          <CartIcon sx={{ fontSize: 48, opacity: 0.4 }} />
          <Typography>Savat bo'sh. Tovarni skaner qiling yoki qidiring.</Typography>
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
                  Omborda: {fmtNum(l.product.qty)} {l.product.unit}{over && ' — yetarli emas!'}
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
              <Typography color="text.secondary">{l.product.unit} ×</Typography>
              <TextField size="small" value={l.price} inputMode="decimal" sx={{ width: 160 }}
                onChange={(e) => { const v = num(e.target.value); if (!isNaN(v)) cart.update(l.productId, { price: v }) }}
                slotProps={{ input: { endAdornment: <InputAdornment position="end">so'm</InputAdornment> } }} />
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
        <TextField size="small" label="Mijoz (ixtiyoriy)" value={customer} onChange={(e) => setCustomer(e.target.value)} />
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>To'lov usuli</Typography>
          <ToggleButtonGroup exclusive fullWidth size="small" value={payment} onChange={(_, v) => v && setPayment(v)}>
            {PAYMENTS.map((p) => <ToggleButton key={p.value} value={p.value}>{p.value === 'otkazma' ? "O'tkazma" : p.label}</ToggleButton>)}
          </ToggleButtonGroup>
        </Box>
        <Divider />
        <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Tovarlar</Typography><Typography>{lines.length} xil</Typography></Stack>
        <Stack direction="row" justifyContent="space-between" alignItems="baseline">
          <Typography variant="h6">Jami</Typography>
          <Typography variant="h5" sx={{ color: 'primary.main' }}>{fmtMoney(total)}</Typography>
        </Stack>
        {error && <Alert severity="error">{error}</Alert>}
        {!mobile && (
          <Button variant="contained" size="large" disabled={!lines.length || busy} onClick={checkout} sx={{ py: 1.5, fontSize: 17 }}>
            {busy ? 'Saqlanmoqda...' : 'Sotish'}
          </Button>
        )}
        {lines.length > 0 && <Button color="inherit" onClick={() => confirm('Savat tozalansinmi?') && cart.clear()}>Savatni tozalash</Button>}
      </Stack>
    </Card>
  )

  return (
    <Box sx={{ pb: mobile ? 10 : 0 }}>
      <PageHeader title="Kassa" subtitle="Shtrix-kodni skaner qiling — tovar savatga tushadi" />
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
              <Typography variant="caption" color="text.secondary">Jami</Typography>
              <Typography variant="h6" sx={{ lineHeight: 1.1 }}>{fmtMoney(total)}</Typography>
            </Box>
            <IconButton onClick={() => setCamera(true)} sx={{ border: 1, borderColor: 'divider' }}><CameraIcon /></IconButton>
            <Button variant="contained" size="large" disabled={!lines.length || busy} onClick={checkout} sx={{ px: 4, py: 1.25 }}>
              {busy ? '...' : 'Sotish'}
            </Button>
          </Stack>
        </Paper>
      )}

      <CameraScanner open={camera} continuous title="Kassa: skaner qiling" onClose={() => setCamera(false)} onScan={addByCode} />
      {receipt && <ReceiptDialog wh={wh} saleId={receipt} justSold onClose={() => setReceipt(null)} />}
    </Box>
  )
}
