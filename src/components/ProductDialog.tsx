import { useState } from 'react'
import { Alert, Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from '@mui/material'
import type { Warehouse } from '../store'
import type { Product, Unit } from '../types'
import { UNITS } from '../types'

interface Props { wh: Warehouse; product?: Product; onClose: () => void }

export default function ProductDialog({ wh, product, onClose }: Props) {
  const isNew = !product
  const [f, setF] = useState({
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    category: product?.category ?? '',
    unit: (product?.unit ?? 'dona') as Unit,
    buyPrice: product ? String(product.buyPrice) : '',
    sellPrice: product ? String(product.sellPrice) : '',
    minQty: product ? String(product.minQty) : '0',
    location: product?.location ?? '',
    qty: '0',
  })
  const [err, setErr] = useState('')
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  const save = () => {
    if (!f.name.trim()) return setErr('Mahsulot nomini kiriting')
    if (!f.category.trim()) return setErr('Kategoriyani tanlang')
    const num = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.')) || 0
    const dup = wh.data.products.find((p) => p.sku && p.sku.toLowerCase() === f.sku.trim().toLowerCase() && p.id !== product?.id)
    if (dup) return setErr(`Bu artikul "${dup.name}" mahsulotida ishlatilgan`)
    wh.saveProduct({
      id: product?.id,
      name: f.name.trim(), sku: f.sku.trim(), category: f.category.trim(), unit: f.unit,
      buyPrice: num(f.buyPrice), sellPrice: num(f.sellPrice), minQty: num(f.minQty), location: f.location.trim(),
      qty: isNew ? num(f.qty) : undefined,
    })
    onClose()
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{isNew ? 'Yangi mahsulot' : 'Mahsulotni tahrirlash'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Nomi *" value={f.name} onChange={set('name')} autoFocus />
          <Stack direction="row" spacing={2}>
            <TextField label="Artikul / kod" value={f.sku} onChange={set('sku')} fullWidth />
            <TextField select label="O'lchov birligi" value={f.unit} onChange={set('unit')} sx={{ minWidth: 160 }}>
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
          <Stack direction="row" spacing={2}>
            {isNew && <TextField label="Boshlang'ich qoldiq" value={f.qty} onChange={set('qty')} fullWidth inputMode="decimal" />}
            <TextField label="Minimal qoldiq (ogohlantirish)" value={f.minQty} onChange={set('minQty')} fullWidth inputMode="decimal" />
            <TextField label="Joyi (javon/qator)" value={f.location} onChange={set('location')} fullWidth />
          </Stack>
          {err && <Alert severity="error">{err}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Bekor qilish</Button>
        <Button variant="contained" onClick={save}>Saqlash</Button>
      </DialogActions>
    </Dialog>
  )
}
