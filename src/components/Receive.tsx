import { useState } from 'react'
import {
  Alert, Autocomplete, Box, Button, Card, Divider, IconButton, InputAdornment, Paper, Stack, TextField, Typography,
  useMediaQuery, useTheme,
} from '@mui/material'
import CameraIcon from '@mui/icons-material/QrCodeScanner'
import SearchIcon from '@mui/icons-material/Search'
import DeleteIcon from '@mui/icons-material/DeleteOutline'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import InboxIcon from '@mui/icons-material/MoveToInboxOutlined'
import type { Warehouse } from '../store'
import type { Cart } from '../hooks/useCart'
import type { Product } from '../types'
import { attempt } from '../api'
import { beep } from '../device'
import { fmtMoney, fmtNum } from '../utils'
import PageHeader from './PageHeader'
import CameraScanner from './CameraScanner'

interface Props { wh: Warehouse; list: Cart; onUnknownCode: (code: string) => void; onDone: (msg: string) => void }

const num = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.'))

/** Kelgan tovarlarni ketma-ket skaner qilib, bitta nakladnoy bilan omborga kiritish */
export default function Receive({ wh, list, onUnknownCode, onDone }: Props) {
  const mobile = useMediaQuery(useTheme().breakpoints.down('md'))
  const { products } = wh.data
  const [input, setInput] = useState('')
  const [camera, setCamera] = useState(false)
  const [supplier, setSupplier] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const lines = list.items
    .map((it) => ({ ...it, product: products.find((p) => p.id === it.productId) }))
    .filter((l): l is typeof l & { product: Product } => !!l.product)
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0)
  const suppliers = [...new Set(wh.data.movements.filter((m) => m.type === 'in' && m.counterparty).map((m) => m.counterparty))]

  const addProduct = (p: Product) => { list.add(p); beep(true); setError('') }
  const addByCode = (code: string) => {
    const p = wh.findByCode(code)
    if (p) addProduct(p)
    else { beep(false); onUnknownCode(code) }
  }

  const submit = async () => {
    setError('')
    if (!lines.length) return
    if (lines.some((l) => !(l.qty > 0))) return setError("Miqdor 0 dan katta bo'lishi kerak")
    setBusy(true)
    const r = await attempt(() => wh.receive({
      items: lines.map((l) => ({ productId: l.productId, qty: l.qty, price: l.price, sellPrice: l.sellPrice })),
      counterparty: supplier.trim(), note: note.trim(),
    }))
    setBusy(false)
    if (!r.ok) return setError(r.error)
    list.clear()
    setNote('')
    onDone(`Nakladnoy №${r.value.batchId}: ${lines.length} xil tovar omborga kiritildi`)
  }

  return (
    <Box sx={{ pb: mobile ? 10 : 0 }}>
      <PageHeader title="Skaner bilan qabul" subtitle="Kelgan tovarlarni skaner qiling — oxirida bitta tugma bilan omborga kiriting" />
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
        <Stack spacing={2} sx={{ flex: 1, width: '100%', minWidth: 0 }}>
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
                      <Typography variant="caption" color="text.secondary">{p.sku} · omborda {fmtNum(p.qty)} {p.unit}</Typography>
                    </Box>
                    <Typography color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>{fmtMoney(p.buyPrice)}</Typography>
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

          {lines.length === 0 && (
            <Paper variant="outlined" sx={{ p: 5, textAlign: 'center', color: 'text.secondary' }}>
              <InboxIcon sx={{ fontSize: 48, opacity: 0.4 }} />
              <Typography>Ro'yxat bo'sh. Kelgan tovarlarni skaner qiling.</Typography>
              <Typography variant="body2">Noma'lum shtrix-kod chiqsa — yangi tovar qo'shish oynasi ochiladi.</Typography>
            </Paper>
          )}
          {lines.map((l) => (
            <Card key={l.productId} sx={{ p: 1.5 }}>
              <Stack direction="row" alignItems="flex-start" spacing={1}>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }}>{l.product.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Hozir omborda: {fmtNum(l.product.qty)} {l.product.unit} → qabuldan keyin: <b>{fmtNum(l.product.qty + l.qty)}</b>
                  </Typography>
                </Box>
                <IconButton size="small" onClick={() => list.remove(l.productId)}><DeleteIcon fontSize="small" /></IconButton>
              </Stack>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
                <Stack direction="row" alignItems="center" sx={{ border: 1, borderColor: 'divider', borderRadius: 2.5 }}>
                  <IconButton size="small" onClick={() => l.qty > 1 ? list.update(l.productId, { qty: l.qty - 1 }) : list.remove(l.productId)}><RemoveIcon fontSize="small" /></IconButton>
                  <TextField variant="standard" value={l.qty} inputMode="decimal"
                    onChange={(e) => { const v = num(e.target.value); if (!isNaN(v)) list.update(l.productId, { qty: v }) }}
                    slotProps={{ input: { disableUnderline: true }, htmlInput: { style: { textAlign: 'center', width: 64, fontWeight: 700 } } }} />
                  <IconButton size="small" onClick={() => list.update(l.productId, { qty: l.qty + 1 })}><AddIcon fontSize="small" /></IconButton>
                </Stack>
                <Typography color="text.secondary">{l.product.unit}</Typography>
                <TextField size="small" label="Kelish narxi" value={l.price} inputMode="decimal" sx={{ width: 150 }}
                  onChange={(e) => { const v = num(e.target.value); if (!isNaN(v)) list.update(l.productId, { price: v }) }} />
                <TextField size="small" label="Sotuv narxi" value={l.sellPrice ?? l.product.sellPrice} inputMode="decimal" sx={{ width: 150 }}
                  onChange={(e) => { const v = num(e.target.value); if (!isNaN(v)) list.update(l.productId, { sellPrice: v }) }} />
                <Typography sx={{ ml: 'auto !important', fontWeight: 700 }}>{fmtMoney(l.qty * l.price)}</Typography>
              </Stack>
            </Card>
          ))}
        </Stack>

        <Box sx={{ width: { xs: '100%', md: 360 }, flexShrink: 0 }}>
          <Card sx={{ p: 2.5, position: { md: 'sticky' }, top: { md: 88 } }}>
            <Stack spacing={2}>
              <Autocomplete freeSolo options={suppliers} inputValue={supplier} onInputChange={(_, v) => setSupplier(v)}
                renderInput={(params) => <TextField {...params} size="small" label="Ta'minotchi" slotProps={{ inputLabel: { ...params.InputLabelProps, shrink: true } }} />} />
              <TextField size="small" label="Izoh (nakladnoy raqami va h.k.)" value={note} onChange={(e) => setNote(e.target.value)} />
              <Divider />
              <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Tovar turlari</Typography><Typography>{lines.length}</Typography></Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                <Typography variant="h6">Jami</Typography>
                <Typography variant="h5" sx={{ color: 'primary.main' }}>{fmtMoney(total)}</Typography>
              </Stack>
              {error && <Alert severity="error">{error}</Alert>}
              {!mobile && (
                <Button variant="contained" size="large" disabled={!lines.length || busy} onClick={submit} sx={{ py: 1.5, fontSize: 17 }}>
                  {busy ? 'Saqlanmoqda...' : 'Omborga qabul qilish'}
                </Button>
              )}
              {lines.length > 0 && <Button color="inherit" onClick={() => confirm("Ro'yxat tozalansinmi?") && list.clear()}>Ro'yxatni tozalash</Button>}
            </Stack>
          </Card>
        </Box>
      </Stack>

      {mobile && (
        <Paper elevation={8} className="no-print"
          sx={{ position: 'fixed', left: 0, right: 0, bottom: 0, p: 1.5, zIndex: 20, borderRadius: 0, borderTop: 1, borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="caption" color="text.secondary">Jami ({lines.length} xil)</Typography>
              <Typography variant="h6" sx={{ lineHeight: 1.1 }}>{fmtMoney(total)}</Typography>
            </Box>
            <IconButton onClick={() => setCamera(true)} sx={{ border: 1, borderColor: 'divider' }}><CameraIcon /></IconButton>
            <Button variant="contained" size="large" disabled={!lines.length || busy} onClick={submit} sx={{ px: 3, py: 1.25 }}>
              {busy ? '...' : 'Qabul qilish'}
            </Button>
          </Stack>
        </Paper>
      )}

      <CameraScanner open={camera} continuous title="Qabul: skaner qiling" onClose={() => setCamera(false)} onScan={addByCode} />
    </Box>
  )
}
