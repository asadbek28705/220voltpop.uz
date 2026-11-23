import { useState } from 'react'
import {
  useMediaQuery, useTheme, Alert, Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField,
  ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material'
import type { Warehouse } from '../store'
import { useIsAdmin } from '../auth'
import type { MovementType } from '../types'
import { fmtMoney, fmtNum, fmtUsd, toUzs } from '../utils'
import { attempt } from '../api'

interface Props { wh: Warehouse; initialType: MovementType; initialProductId?: string; onClose: () => void }

export default function MovementDialog({ wh, initialType, initialProductId, onClose }: Props) {
  const { products } = wh.data
  const fullScreen = useMediaQuery(useTheme().breakpoints.down('sm'))
  const admin = useIsAdmin()
  const [type, setType] = useState<MovementType>(initialType)
  const [productId, setProductId] = useState(initialProductId ?? '')
  const prod = products.find((p) => p.id === productId) ?? null
  const defaultPrice = (t: MovementType, id: string) => {
    const p = products.find((x) => x.id === id)
    return p ? String(t === 'out' ? p.sellPrice : p.buyPrice) : ''
  }
  const [qty, setQty] = useState(initialType === 'adjust' && prod ? String(prod.qty) : '')
  const [price, setPrice] = useState(defaultPrice(initialType, initialProductId ?? ''))
  const [priceUsd, setPriceUsd] = useState(() => {
    const p = products.find((x) => x.id === initialProductId)
    return p?.currency === 'USD' && p.buyPriceUsd ? String(p.buyPriceUsd) : ''
  })
  const rate = wh.data.settings.usdRate ?? 0
  const [counterparty, setCounterparty] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')

  const num = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.'))
  const q = num(qty) || 0
  // Dollar tovar kirimi: $ narx kurs bo'yicha so'mga o'giriladi
  const usdIn = type === 'in' && prod?.currency === 'USD' && admin
  const pu = num(priceUsd) || 0
  const pr = usdIn ? toUzs(pu, rate) : num(price) || 0

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
    setPriceUsd(p?.currency === 'USD' && p.buyPriceUsd ? String(p.buyPriceUsd) : '')
    if (type === 'adjust' && p) setQty(String(p.qty))
  }

  const [busy, setBusy] = useState(false)
  const save = async () => {
    if (!prod) return setErr('Mahsulotni tanlang')
    if (qty.trim() === '' || isNaN(num(qty))) return setErr("Miqdorni to'g'ri kiriting")
    // Inventarizatsiyada foydalanuvchi haqiqiy qoldiqni kiritadi, biz farqni saqlaymiz
    const amount = type === 'adjust' ? q - prod.qty : q
    if (type === 'adjust' && amount === 0) return setErr("Qoldiq o'zgarmadi")
    if (usdIn && !(rate > 0)) return setErr("Avval dollar kursini kiriting (Tovarlar → Dollar kursi)")
    setBusy(true)
    const r = await attempt(() => wh.addMovement({ productId: prod.id, type, qty: amount, price: pr, priceUsd: usdIn ? pu : undefined, counterparty: counterparty.trim(), note: note.trim() }))
    setBusy(false)
    if (!r.ok) return setErr(r.error)
    onClose()
  }

  const titles: Record<MovementType, string> = { in: 'Kirim (omborga qabul)', out: 'Chiqim / Sotuv', adjust: 'Inventarizatsiya' }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <DialogTitle>{titles[type]}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <ToggleButtonGroup exclusive fullWidth value={type} onChange={(_, v) => changeType(v)} size="small">
            <ToggleButton value="in" color="success">Kirim</ToggleButton>
            <ToggleButton value="out" color="primary">Chiqim</ToggleButton>
            {admin && <ToggleButton value="adjust">Inventarizatsiya</ToggleButton>}
          </ToggleButtonGroup>
          <Autocomplete
            options={products}
            value={prod}
            onChange={(_, v) => changeProduct(v?.id ?? '')}
            getOptionLabel={(p) => `${p.name}${p.sku ? ' (' + p.sku + ')' : ''}`}
            filterOptions={(opts, { inputValue }) => { const q = inputValue.trim().toLowerCase(); return opts.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.includes(q)) }}
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
            {usdIn && (
              <TextField label="Kelish narxi ($)" value={priceUsd} onChange={(e) => setPriceUsd(e.target.value)} fullWidth inputMode="decimal"
                error={!(rate > 0)} helperText={rate > 0 ? `= ${fmtMoney(pr)} (1$ = ${fmtMoney(rate)})` : 'Dollar kursi kiritilmagan'} />
            )}
            {!usdIn && type !== 'adjust' && (admin || type === 'out') && (
              <TextField label={type === 'in' ? "Kelish narxi (so'm)" : "Sotuv narxi (so'm)"} value={price} onChange={(e) => setPrice(e.target.value)} fullWidth inputMode="decimal" />
            )}
          </Stack>
          {type !== 'adjust' && (
            <TextField label={type === 'in' ? 'Yetkazib beruvchi' : 'Mijoz / obyekt'} value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
          )}
          <TextField label="Izoh" value={note} onChange={(e) => setNote(e.target.value)} multiline minRows={2}
            placeholder={type === 'adjust' ? "Masalan: sanoqda kam chiqdi, singan" : ''} />
          {prod && type !== 'adjust' && q > 0 && (admin || type === 'out') && (
            <Alert severity="info" icon={false}>
              Jami summa: <b>{fmtMoney(q * pr)}</b>{usdIn && <> ({fmtUsd(q * pu)})</>}
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
        <Button variant="contained" onClick={save} color="primary" disabled={busy}>Saqlash</Button>
      </DialogActions>
    </Dialog>
  )
}
