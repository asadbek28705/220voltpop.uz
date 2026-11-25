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
import { useIsAdmin } from '../auth'
import type { Cart } from '../hooks/useCart'
import type { Product } from '../types'
import { attempt } from '../api'
import { beep } from '../device'
import { fmtMoney, fmtNum, fmtUsd, sellFrom, toUzs } from '../utils'
import RateDialog from './RateDialog'
import PageHeader from './PageHeader'
import CameraScanner from './CameraScanner'
import { t as tr } from '../i18n'

interface Props { wh: Warehouse; list: Cart; onUnknownCode: (code: string) => void; onDone: (msg: string) => void }

const num = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.'))

/** Kelgan tovarlarni ketma-ket skaner qilib, bitta nakladnoy bilan omborga kiritish */
export default function Receive({ wh, list, onUnknownCode, onDone }: Props) {
  const mobile = useMediaQuery(useTheme().breakpoints.down('md'))
  const admin = useIsAdmin()
  const { products } = wh.data
  const [input, setInput] = useState('')
  const [camera, setCamera] = useState(false)
  const [supplier, setSupplier] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const [rateOpen, setRateOpen] = useState(false)
  const rate = wh.data.settings.usdRate ?? 0
  const lines = list.items
    .map((it) => ({ ...it, product: products.find((p) => p.id === it.productId) }))
    .filter((l): l is typeof l & { product: Product } => !!l.product)
    .map((l) => {
      // Dollar tovar: $ narx × kurs = so'mdagi tannarx; ustama bo'lsa sotuv narxi shundan
      const usd = l.product.currency === 'USD'
      const priceUsd = usd ? Number(l.priceUsd ?? l.product.buyPriceUsd) || 0 : 0  // yozish paytida "12." satr bo'lishi mumkin
      const cost = usd ? toUzs(priceUsd, rate) : l.price
      const autoSell = usd && l.product.markup > 0 && cost > 0 ? sellFrom(cost, l.product.markup) : 0
      return { ...l, usd, priceUsd, cost, autoSell }
    })
  const total = lines.reduce((s, l) => s + l.qty * l.cost, 0)
  const totalUsd = lines.reduce((s, l) => s + (l.usd ? l.qty * l.priceUsd : 0), 0)
  const needRate = admin && lines.some((l) => l.usd) && !(rate > 0)
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
    if (lines.some((l) => !(l.qty > 0))) return setError(tr("Miqdor 0 dan katta bo'lishi kerak"))
    if (needRate) return setError(tr("Avval dollar kursini kiriting"))
    setBusy(true)
    const r = await attempt(() => wh.receive({
      items: lines.map((l) => ({ productId: l.productId, qty: l.qty, price: l.cost, priceUsd: l.usd ? l.priceUsd : undefined, sellPrice: l.sellPrice })),
      counterparty: supplier.trim(), note: note.trim(),
    }))
    setBusy(false)
    if (!r.ok) return setError(r.error)
    list.clear()
    setNote('')
    onDone(tr("Nakladnoy №{0}: {1} xil tovar omborga kiritildi", r.value.batchId, lines.length))
  }

  return (
    <Box sx={{ pb: mobile ? 10 : 0 }}>
      <PageHeader title={tr("Skaner bilan qabul")} subtitle={tr("Kelgan tovarlarni skaner qiling — oxirida bitta tugma bilan omborga kiriting")} />
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
                      <Typography variant="caption" color="text.secondary">{p.sku} {tr("· omborda")} {fmtNum(p.qty)} {tr(p.unit)}</Typography>
                    </Box>
                    {admin && <Typography color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>{p.currency === 'USD' ? fmtUsd(p.buyPriceUsd) : fmtMoney(p.buyPrice)}</Typography>}
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

          {lines.length === 0 && (
            <Paper variant="outlined" sx={{ p: 5, textAlign: 'center', color: 'text.secondary' }}>
              <InboxIcon sx={{ fontSize: 48, opacity: 0.4 }} />
              <Typography>{tr("Ro'yxat bo'sh. Kelgan tovarlarni skaner qiling.")}</Typography>
              <Typography variant="body2">{tr("Noma'lum shtrix-kod chiqsa — yangi tovar qo'shish oynasi ochiladi.")}</Typography>
            </Paper>
          )}
          {lines.map((l) => (
            <Card key={l.productId} sx={{ p: 1.5 }}>
              <Stack direction="row" alignItems="flex-start" spacing={1}>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }}>
                    {l.product.name}
                    {l.usd && <Box component="span" sx={{ ml: 1, px: 0.75, borderRadius: 1, fontSize: 12, bgcolor: 'success.main', color: '#fff' }}>$</Box>}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {tr("Hozir omborda:")} {fmtNum(l.product.qty)} {tr(l.product.unit)} {tr("→ qabuldan keyin:")} <b>{fmtNum(l.product.qty + l.qty)}</b>
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
                <Typography color="text.secondary">{tr(l.product.unit)}</Typography>
                {admin && (l.usd
                  ? <TextField size="small" label={tr("Kelish narxi ($)")} value={l.priceUsd ?? (l.product.buyPriceUsd || '')} inputMode="decimal" sx={{ width: 150 }}
                      helperText={rate > 0 ? `= ${fmtMoney(l.cost)}` : tr("kurs yo'q")} error={!(rate > 0)}
                      onChange={(e) => { const s = e.target.value.replace(',', '.'); if (/^\d*\.?\d*$/.test(s)) list.update(l.productId, { priceUsd: s as unknown as number }) }}
                      onBlur={() => list.update(l.productId, { priceUsd: Number(l.priceUsd) || 0 })} />
                  : <TextField size="small" label={tr("Kelish narxi")} value={l.price} inputMode="decimal" sx={{ width: 150 }}
                      onChange={(e) => { const v = num(e.target.value); if (!isNaN(v)) list.update(l.productId, { price: v }) }} />)}
                {admin && <TextField size="small" label={tr("Sotuv narxi (so'm)")} value={l.sellPrice ?? (l.autoSell || l.product.sellPrice)} inputMode="decimal" sx={{ width: 150 }}
                  helperText={l.autoSell && l.sellPrice == null ? tr("+{0}% avtomatik", l.product.markup) : l.usd ? ' ' : undefined}
                  onChange={(e) => { const v = num(e.target.value); if (!isNaN(v)) list.update(l.productId, { sellPrice: v }) }} />}
                {admin && <Box sx={{ ml: 'auto !important', textAlign: 'right' }}>
                  <Typography sx={{ fontWeight: 700 }}>{fmtMoney(l.qty * l.cost)}</Typography>
                  {l.usd && <Typography variant="caption" color="text.secondary">{fmtUsd(l.qty * l.priceUsd)}</Typography>}
                </Box>}
              </Stack>
            </Card>
          ))}
        </Stack>

        <Box sx={{ width: { xs: '100%', md: 360 }, flexShrink: 0 }}>
          <Card sx={{ p: 2.5, position: { md: 'sticky' }, top: { md: 88 } }}>
            <Stack spacing={2}>
              <Autocomplete freeSolo options={suppliers} inputValue={supplier} onInputChange={(_, v) => setSupplier(v)}
                renderInput={(params) => <TextField {...params} size="small" label={tr("Ta'minotchi")} slotProps={{ inputLabel: { ...params.InputLabelProps, shrink: true } }} />} />
              <TextField size="small" label={tr("Izoh (nakladnoy raqami va h.k.)")} value={note} onChange={(e) => setNote(e.target.value)} />
              <Divider />
              <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">{tr("Tovar turlari")}</Typography><Typography>{lines.length}</Typography></Stack>
              {admin && lines.some((l) => l.usd) && (
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography color="text.secondary">{tr("Dollar kursi")}</Typography>
                  <Button size="small" color={rate > 0 ? 'inherit' : 'warning'} variant="outlined" onClick={() => setRateOpen(true)}>
                    {rate > 0 ? `1$ = ${fmtMoney(rate)}` : tr("Kiritish")}
                  </Button>
                </Stack>
              )}
              {admin && totalUsd > 0 && (
                <Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">{tr("Shundan dollarda")}</Typography><Typography sx={{ fontWeight: 600 }}>{fmtUsd(totalUsd)}</Typography></Stack>
              )}
              {admin && <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                <Typography variant="h6">{tr("Jami")}</Typography>
                <Typography variant="h5" sx={{ color: 'primary.main' }}>{fmtMoney(total)}</Typography>
              </Stack>}
              {error && <Alert severity="error">{error}</Alert>}
              {!mobile && (
                <Button variant="contained" size="large" disabled={!lines.length || busy} onClick={submit} sx={{ py: 1.5, fontSize: 17 }}>
                  {busy ? tr("Saqlanmoqda...") : tr("Omborga qabul qilish")}
                </Button>
              )}
              {lines.length > 0 && <Button color="inherit" onClick={() => confirm(tr("Ro'yxat tozalansinmi?")) && list.clear()}>{tr("Ro'yxatni tozalash")}</Button>}
            </Stack>
          </Card>
        </Box>
      </Stack>

      {mobile && (
        <Paper elevation={8} className="no-print"
          sx={{ position: 'fixed', left: 0, right: 0, bottom: 0, p: 1.5, pb: 'calc(12px + env(safe-area-inset-bottom))', zIndex: 20, borderRadius: 0, borderTop: 1, borderColor: 'divider' }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="caption" color="text.secondary">{admin ? tr("Jami ({0} xil)", lines.length) : tr("Tovar turlari")}</Typography>
              <Typography variant="h6" sx={{ lineHeight: 1.1 }}>{admin ? fmtMoney(total) : lines.length}</Typography>
            </Box>
            <IconButton onClick={() => setCamera(true)} sx={{ border: 1, borderColor: 'divider' }}><CameraIcon /></IconButton>
            <Button variant="contained" size="large" disabled={!lines.length || busy} onClick={submit} sx={{ px: 3, py: 1.25 }}>
              {busy ? '...' : tr("Qabul qilish")}
            </Button>
          </Stack>
        </Paper>
      )}

      {rateOpen && <RateDialog wh={wh} onClose={() => setRateOpen(false)} />}
      <CameraScanner open={camera} continuous title={tr("Qabul: skaner qiling")} onClose={() => setCamera(false)} onScan={addByCode} />
    </Box>
  )
}
