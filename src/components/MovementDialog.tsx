import { useState } from 'react'
import {
  Alert, Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField,
  ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material'
import type { Warehouse } from '../store'
import type { MovementType } from '../types'
import { fmtMoney, fmtNum } from '../utils'

interface Props { wh: Warehouse; initialType: MovementType; initialProductId?: string; onClose: () => void }

export default function MovementDialog({ wh, initialType, initialProductId, onClose }: Props) {
  const { products } = wh.data
  const [type, setType] = useState<MovementType>(initialType)
  const [productId, setProductId] = useState(initialProductId ?? '')
  const prod = products.find((p) => p.id === productId) ?? null
  const defaultPrice = (t: MovementType, id: string) => {
    const p = products.find((x) => x.id === id)
    return p ? String(t === 'out' ? p.sellPrice : p.buyPrice) : ''
  }
  const [qty, setQty] = useState(initialType === 'adjust' && prod ? String(prod.qty) : '')
  const [price, setPrice] = useState(defaultPrice(initialType, initialProductId ?? ''))
  const [counterparty, setCounterparty] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')

  const num = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.'))
  const q = num(qty) || 0
  const pr = num(price) || 0

  const changeType = (t: MovementType | null) => {
    if (!t) return
    setType(t)
    setPrice(defaultPrice(t, productId))
    if (t === 'adjust' && prod) setQty(String(prod.qty))
    else if (type === 'adjust') setQty('')
  }
  const changeProduct = (id: string) => {
    setProductId(id)
    setPrice(defaultPrice(type, id))
    const p = products.find((x) => x.id === id)
    if (type === 'adjust' && p) setQty(String(p.qty))
  }

  const save = () => {
    if (!prod) return setErr('Mahsulotni tanlang')
    if (qty.trim() === '' || isNaN(num(qty))) return setErr("Miqdorni to'g'ri kiriting")
    // Inventarizatsiyada foydalanuvchi haqiqiy qoldiqni kiritadi, biz farqni saqlaymiz
    const amount = type === 'adjust' ? q - prod.qty : q
    if (type === 'adjust' && amount === 0) return setErr("Qoldiq o'zgarmadi")
    const e = wh.addMovement({ productId: prod.id, type, qty: amount, price: pr, counterparty: counterparty.trim(), note: note.trim() })
    if (e) return setErr(e)
    onClose()
  }

  const titles: Record<MovementType, string> = { in: 'Kirim (omborga qabul)', out: 'Chiqim / Sotuv', adjust: 'Inventarizatsiya' }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{titles[type]}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <ToggleButtonGroup exclusive fullWidth value={type} onChange={(_, v) => changeType(v)} size="small">
            <ToggleButton value="in" color="success">Kirim</ToggleButton>
            <ToggleButton value="out" color="primary">Chiqim</ToggleButton>
            <ToggleButton value="adjust">Inventarizatsiya</ToggleButton>
          </ToggleButtonGroup>
          <Autocomplete
            options={products}
            value={prod}
            onChange={(_, v) => changeProduct(v?.id ?? '')}
            getOptionLabel={(p) => `${p.name}${p.sku ? ' (' + p.sku + ')' : ''}`}
            renderOption={(props, p) => (
              <li {...props} key={p.id}>
                <Stack sx={{ width: '100%' }} direction="row" justifyContent="space-between">
                  <span>{p.name}</span>
                  <Typography variant="body2" color="text.secondary">{fmtNum(p.qty)} {p.unit}</Typography>
                </Stack>
              </li>
            )}
            renderInput={(params) => <TextField {...params} label="Mahsulot" autoFocus={!prod} />}
          />
          {prod && (
            <Typography variant="body2" color="text.secondary">
              Hozirgi qoldiq: <b>{fmtNum(prod.qty)} {prod.unit}</b> · Joyi: {prod.location || '—'}
            </Typography>
          )}
          <Stack direction="row" spacing={2}>
            <TextField label={type === 'adjust' ? `Haqiqiy qoldiq${prod ? ' (' + prod.unit + ')' : ''}` : `Miqdor${prod ? ' (' + prod.unit + ')' : ''}`}
              value={qty} onChange={(e) => setQty(e.target.value)} fullWidth inputMode="decimal" autoFocus={!!prod} />
            {type !== 'adjust' && (
              <TextField label={type === 'in' ? "Kelish narxi (so'm)" : "Sotuv narxi (so'm)"} value={price} onChange={(e) => setPrice(e.target.value)} fullWidth inputMode="decimal" />
            )}
          </Stack>
          {type !== 'adjust' && (
            <TextField label={type === 'in' ? 'Yetkazib beruvchi' : 'Mijoz / obyekt'} value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
          )}
          <TextField label="Izoh" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2}
            placeholder={type === 'adjust' ? "Masalan: sanoqda kam chiqdi, singan" : ''} />
          {prod && type !== 'adjust' && q > 0 && (
            <Alert severity="info" icon={false}>
              Jami summa: <b>{fmtMoney(q * pr)}</b>
              {type === 'out' && prod.buyPrice > 0 && <> · Foyda: <b>{fmtMoney(q * (pr - prod.buyPrice))}</b></>}
            </Alert>
          )}
          {prod && type === 'adjust' && qty.trim() !== '' && (
            <Alert severity={q - prod.qty < 0 ? 'warning' : 'info'} icon={false}>
              Farq: <b>{q - prod.qty > 0 ? '+' : ''}{fmtNum(q - prod.qty)} {prod.unit}</b>
            </Alert>
          )}
          {err && <Alert severity="error">{err}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Bekor qilish</Button>
        <Button variant="contained" onClick={save} color="primary">Saqlash</Button>
      </DialogActions>
    </Dialog>
  )
}
