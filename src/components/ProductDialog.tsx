import { useState } from 'react'
import {
  Alert, Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, MenuItem, Stack, TextField,
  useMediaQuery, useTheme,
} from '@mui/material'
import CameraIcon from '@mui/icons-material/QrCodeScanner'
import AutoIcon from '@mui/icons-material/AutoFixHighOutlined'
import { Tooltip } from '@mui/material'
import type { Warehouse } from '../store'
import type { Product, Unit } from '../types'
import { UNITS } from '../types'
import { attempt } from '../api'
import CameraScanner from './CameraScanner'

interface Props { wh: Warehouse; product?: Product; initialBarcode?: string; noInitialQty?: boolean; onClose: () => void; onSaved?: (p: Product) => void }

export default function ProductDialog({ wh, product, initialBarcode, noInitialQty, onClose, onSaved }: Props) {
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
  })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [camera, setCamera] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  const save = async () => {
    if (!f.name.trim()) return setErr('Tovar nomini kiriting')
    if (!f.category.trim()) return setErr('Kategoriyani tanlang')
    const num = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.')) || 0
    setBusy(true)
    const r = await attempt(() => wh.saveProduct({
      id: product?.id,
      name: f.name.trim(), sku: f.sku.trim(), barcode: f.barcode.trim(), category: f.category.trim(), unit: f.unit,
      buyPrice: num(f.buyPrice), sellPrice: num(f.sellPrice), minQty: num(f.minQty), location: f.location.trim(),
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
          <Stack direction="row" spacing={2}>
            <TextField label="Kelish narxi (so'm)" value={f.buyPrice} onChange={set('buyPrice')} fullWidth inputMode="decimal" />
            <TextField label="Sotuv narxi (so'm)" value={f.sellPrice} onChange={set('sellPrice')} fullWidth inputMode="decimal" />
          </Stack>
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
