import { useState } from 'react'
import {
  Alert, Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, MenuItem, Stack, TextField,
  useMediaQuery, useTheme,
} from '@mui/material'
import CameraIcon from '@mui/icons-material/QrCodeScanner'
import AutoIcon from '@mui/icons-material/AutoFixHighOutlined'
import { Tooltip, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import type { Warehouse } from '../store'
import type { Currency, Product, Unit } from '../types'
import { UNITS } from '../types'
import { attempt } from '../api'
import CameraScanner from './CameraScanner'
import { fmtMoney, sellFrom, toUzs } from '../utils'

interface Props { wh: Warehouse; product?: Product; initialBarcode?: string; noInitialQty?: boolean; defaultCurrency?: Currency; onClose: () => void; onSaved?: (p: Product) => void }

export default function ProductDialog({ wh, product, initialBarcode, noInitialQty, defaultCurrency, onClose, onSaved }: Props) {
  const isNew = !product
  const fullScreen = useMediaQuery(useTheme().breakpoints.down('sm'))
  const [f, setF] = useState({
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    barcode: product?.barcode ?? initialBarcode ?? '',
    category: product?.category ?? '',
    unit: (product?.unit ?? 'dona') as Unit,
    buyPrice: product ? String(product.buyPrice) : '',
    sellPrice: product ? String(product.sellPrice) : '',
    minQty: product ? String(product.minQty) : '0',
    location: product?.location ?? '',
    qty: '0',
    currency: (product?.currency ?? defaultCurrency ?? 'UZS') as Currency,
    buyPriceUsd: product?.buyPriceUsd ? String(product.buyPriceUsd) : '',
    markup: product?.markup ? String(product.markup) : '',
  })
  const rate = wh.data.settings.usdRate ?? 0
  const usd = f.currency === 'USD'
  const n = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.')) || 0
  const costUzs = usd ? toUzs(n(f.buyPriceUsd), rate) : n(f.buyPrice)
  const suggested = n(f.markup) > 0 && costUzs > 0 ? sellFrom(costUzs, n(f.markup)) : 0
  /** $ narx yoki ustama o'zgarsa — sotuv narxini avtomatik hisoblaymiz */
  const setAuto = (k: 'buyPriceUsd' | 'markup' | 'buyPrice') => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => {
    const next = { ...s, [k]: e.target.value }
    const cost = next.currency === 'USD' ? toUzs(n(next.buyPriceUsd), rate) : n(next.buyPrice)
    if (n(next.markup) > 0 && cost > 0) next.sellPrice = String(sellFrom(cost, n(next.markup)))
    return next
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [camera, setCamera] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  const save = async () => {
    if (!f.name.trim()) return setErr('Tovar nomini kiriting')
    if (!f.category.trim()) return setErr('Kategoriyani tanlang')
    const num = n
    if (usd && !(rate > 0)) return setErr("Avval dollar kursini kiriting (Tovarlar sahifasida «Dollar kursi»)")
    setBusy(true)
    const r = await attempt(() => wh.saveProduct({
      id: product?.id,
      name: f.name.trim(), sku: f.sku.trim(), barcode: f.barcode.trim(), category: f.category.trim(), unit: f.unit,
      buyPrice: usd ? costUzs : num(f.buyPrice), sellPrice: num(f.sellPrice),
      currency: f.currency, buyPriceUsd: usd ? num(f.buyPriceUsd) : 0, markup: num(f.markup), minQty: num(f.minQty), location: f.location.trim(),
      qty: isNew && !noInitialQty ? num(f.qty) : undefined,
    }))
    setBusy(false)
    if (!r.ok) return setErr(r.error)
    onSaved?.(r.value)
    onClose()
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <DialogTitle>{isNew ? 'Yangi tovar' : 'Tovarni tahrirlash'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Nomi *" value={f.name} onChange={set('name')} autoFocus />
          <TextField label="Shtrix-kod" value={f.barcode} onChange={set('barcode')} inputMode="numeric"
            helperText="Skaner qiling, kamerani bosing yoki kodi bo'lmasa ✨ — dastur o'zi yaratadi"
            slotProps={{ input: { endAdornment: (
              <InputAdornment position="end">
                {!f.barcode && (
                  <Tooltip title="Ichki shtrix-kod yaratish">
                    <IconButton onClick={async () => { const r = await attempt(() => wh.nextBarcode()); if (r.ok) setF((s) => ({ ...s, barcode: r.value.barcode })); else setErr(r.error) }}>
                      <AutoIcon />
                    </IconButton>
                  </Tooltip>
                )}
                <IconButton onClick={() => setCamera(true)} edge="end"><CameraIcon /></IconButton>
              </InputAdornment>
            ) } }} />
          <Stack direction="row" spacing={2}>
            <TextField label="Artikul / kod" value={f.sku} onChange={set('sku')} fullWidth />
            <TextField select label="Birlik" value={f.unit} onChange={set('unit')} sx={{ minWidth: 130 }}>
              {UNITS.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
            </TextField>
          </Stack>
          <Autocomplete freeSolo options={wh.data.categories} value={f.category}
            onInputChange={(_, v) => setF((s) => ({ ...s, category: v }))}
            renderInput={(params) => <TextField {...params} label="Kategoriya *" helperText="Ro'yxatdan tanlang yoki yangisini yozing" />} />
          <ToggleButtonGroup exclusive fullWidth size="small" value={f.currency} onChange={(_, v) => v && setF((s) => ({ ...s, currency: v }))}>
            <ToggleButton value="UZS">So'mda sotib olinadi</ToggleButton>
            <ToggleButton value="USD">💵 Dollarda sotib olinadi</ToggleButton>
          </ToggleButtonGroup>
          <Stack direction="row" spacing={2}>
            {usd
              ? <TextField label="Kelish narxi ($)" value={f.buyPriceUsd} onChange={setAuto('buyPriceUsd')} fullWidth inputMode="decimal"
                  helperText={rate > 0 ? `= ${fmtMoney(costUzs)} (1$ = ${fmtMoney(rate)})` : 'Dollar kursi kiritilmagan'} error={!(rate > 0)} />
              : <TextField label="Kelish narxi (so'm)" value={f.buyPrice} onChange={setAuto('buyPrice')} fullWidth inputMode="decimal" />}
            <TextField label="Ustama %" value={f.markup} onChange={setAuto('markup')} sx={{ width: 120, flexShrink: 0 }} inputMode="decimal"
              helperText="ixtiyoriy" />
          </Stack>
          <TextField label="Sotuv narxi (so'm)" value={f.sellPrice} onChange={set('sellPrice')} fullWidth inputMode="decimal"
            helperText={suggested ? `Tannarx ${fmtMoney(costUzs)} + ${n(f.markup)}% = ${fmtMoney(suggested)}` : usd ? "Ustama % kiritsangiz — avtomatik hisoblanadi va kurs o'zgarganda yangilanadi" : ' '} />
          {usd && <Typography variant="caption" color="text.secondary" sx={{ mt: '-8px !important' }}>
            Tovarni dollarda olasiz, kassada so'mda sotiladi. Kirimda $ narxni kiritasiz — dastur kurs bo'yicha so'mga o'giradi.
          </Typography>}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            {isNew && !noInitialQty && <TextField label="Boshlang'ich qoldiq" value={f.qty} onChange={set('qty')} fullWidth inputMode="decimal" />}
            <TextField label="Minimal qoldiq" value={f.minQty} onChange={set('minQty')} fullWidth inputMode="decimal" />
            <TextField label="Joyi (javon)" value={f.location} onChange={set('location')} fullWidth />
          </Stack>
          {err && <Alert severity="error">{err}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Bekor qilish</Button>
        <Button variant="contained" onClick={save} disabled={busy}>Saqlash</Button>
      </DialogActions>
      <CameraScanner open={camera} onClose={() => setCamera(false)} onScan={(code) => setF((s) => ({ ...s, barcode: code }))} />
    </Dialog>
  )
}
