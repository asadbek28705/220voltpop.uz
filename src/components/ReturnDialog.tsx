import { useMemo, useState } from 'react'
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField,
  ToggleButton, ToggleButtonGroup, Typography, useMediaQuery, useTheme,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import SearchIcon from '@mui/icons-material/Search'
import type { Warehouse } from '../store'
import type { Payment } from '../types'
import { attempt } from '../api'
import { fmtDate, fmtMoney, fmtNum } from '../utils'
import { t as tr } from '../i18n'

interface Props { wh: Warehouse; saleId?: string; onClose: () => void; onDone: (returnId: string) => void }

const num = (s: string) => Number(s.replace(/\s/g, '').replace(',', '.'))
const r3 = (n: number) => Math.round(n * 1000) / 1000

/**
 * Tovar qaytarish: chek raqami bo'yicha qaysi tovar va qancha qaytganini belgilaymiz.
 * Tovar omborga qaytadi, pul qaytarilgani (yoki mijoz qarzidan ayrilgani) yoziladi.
 */
export default function ReturnDialog({ wh, saleId: initial, onClose, onDone }: Props) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down('sm'))
  const [code, setCode] = useState(initial ?? '')
  const [saleId, setSaleId] = useState(initial ?? '')
  const [qty, setQty] = useState<Record<string, string>>({})
  const [payment, setPayment] = useState<Payment | ''>('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  // Chekdagi tovarlar: sotilgan − oldin qaytarilgan
  const sale = useMemo(() => {
    const out = wh.data.movements.filter((m) => m.type === 'out' && m.saleId === saleId)
    if (!out.length) return null
    const back = wh.data.movements.filter((m) => m.type === 'return' && m.saleId === saleId)
    const map = new Map<string, { productId: string; name: string; sold: number; returned: number; sum: number; unit: string }>()
    for (const m of out) {
      const x = map.get(m.productId) ?? { productId: m.productId, name: m.productName, sold: 0, returned: 0, sum: 0, unit: wh.data.products.find((p) => p.id === m.productId)?.unit ?? '' }
      x.sold += m.qty; x.sum += m.qty * m.price
      map.set(m.productId, x)
    }
    for (const m of back) { const x = map.get(m.productId); if (x) x.returned += m.qty }
    const items = [...map.values()].map((x) => ({ ...x, price: x.sum / x.sold, left: r3(x.sold - x.returned) }))
    return { first: out[0], items }
  }, [wh.data.movements, wh.data.products, saleId])

  const find = () => {
    setErr('')
    const c = code.trim().replace(/^№/, '')
    if (!wh.data.movements.some((m) => m.type === 'out' && m.saleId === c)) return setErr(tr("№{0} chek topilmadi", c))
    setSaleId(c); setQty({}); setPayment('')
  }

  const pay: Payment = payment || (sale?.first.payment === 'nasiya' ? 'nasiya' : (sale?.first.payment as Payment) || 'naqd')
  const chosen = (sale?.items ?? []).map((it) => ({ ...it, q: Math.min(it.left, Math.max(0, num(qty[it.productId] ?? '') || 0)) })).filter((it) => it.q > 0)
  const total = chosen.reduce((s, it) => s + it.q * it.price, 0)
  const set = (id: string, v: number) => setQty({ ...qty, [id]: String(r3(Math.max(0, v))) })

  const save = async () => {
    if (!sale) return
    if (!chosen.length) return setErr(tr("Qaytariladigan tovar miqdorini kiriting"))
    setBusy(true)
    const r = await attempt(() => wh.returnSale({ saleId, items: chosen.map((it) => ({ productId: it.productId, qty: it.q })), payment: pay, note: note.trim() }))
    setBusy(false)
    if (!r.ok) return setErr(r.error)
    onDone(r.value.returnId)
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <DialogTitle>{tr("Tovar qaytarish")}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={1}>
            <TextField fullWidth label={tr("Chek raqami")} value={code} onChange={(e) => setCode(e.target.value)} autoFocus={!initial} inputMode="numeric"
              onKeyDown={(e) => e.key === 'Enter' && find()} placeholder={tr("Masalan: 125")} />
            <Button variant="outlined" onClick={find} startIcon={<SearchIcon />}>{tr("Topish")}</Button>
          </Stack>

          {sale && <>
            <Typography variant="body2" color="text.secondary">
              {tr("Chek №")}{saleId} · {fmtDate(sale.first.date)}{sale.first.counterparty && <> · <b>{sale.first.counterparty}</b></>}
            </Typography>
            <Stack spacing={1}>
              {sale.items.map((it) => {
                const q = num(qty[it.productId] ?? '') || 0
                return (
                  <Box key={it.productId} sx={{ p: 1.25, border: 1, borderColor: q > 0 ? 'warning.main' : 'divider', borderRadius: 2, opacity: it.left > 0 ? 1 : 0.5 }}>
                    <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
                      <Box sx={{ flexGrow: 1, minWidth: 160 }}>
                        <Typography sx={{ fontWeight: 600 }}>{it.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {tr("Sotilgan: {0} × {1}", fmtNum(it.sold), fmtMoney(it.price))}
                          {it.returned > 0 && <> · {tr("oldin qaytgan: {0}", fmtNum(it.returned))}</>}
                        </Typography>
                      </Box>
                      {it.left > 0 ? (
                        <Stack direction="row" alignItems="center" spacing={0.5}>
                          <Stack direction="row" alignItems="center" sx={{ border: 1, borderColor: 'divider', borderRadius: 2.5 }}>
                            <IconButton size="small" onClick={() => set(it.productId, q - 1)}><RemoveIcon fontSize="small" /></IconButton>
                            <TextField variant="standard" value={qty[it.productId] ?? '0'} inputMode="decimal"
                              onChange={(e) => setQty({ ...qty, [it.productId]: e.target.value })}
                              slotProps={{ input: { disableUnderline: true }, htmlInput: { style: { textAlign: 'center', width: 48, fontWeight: 700 } } }} />
                            <IconButton size="small" onClick={() => set(it.productId, Math.min(it.left, q + 1))}><AddIcon fontSize="small" /></IconButton>
                          </Stack>
                          <Button size="small" onClick={() => set(it.productId, it.left)}>{tr("Hammasi ({0})", fmtNum(it.left))}</Button>
                        </Stack>
                      ) : <Typography variant="body2" color="text.secondary">{tr("To'liq qaytarilgan")}</Typography>}
                    </Stack>
                    {q > it.left && <Typography variant="caption" color="error">{tr("Ko'pi bilan {0}", fmtNum(it.left))}</Typography>}
                  </Box>
                )
              })}
            </Stack>

            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>{tr("Pul qanday qaytariladi")}</Typography>
              <ToggleButtonGroup exclusive fullWidth size="small" value={pay} onChange={(_, v) => v && setPayment(v)}>
                <ToggleButton value="naqd">{tr("Naqd")}</ToggleButton>
                <ToggleButton value="karta">{tr("Karta")}</ToggleButton>
                <ToggleButton value="otkazma">{tr("O'tkazma")}</ToggleButton>
                {sale.first.customerId && <ToggleButton value="nasiya" color="error">{tr("Qarzidan ayirish")}</ToggleButton>}
              </ToggleButtonGroup>
            </Box>
            <TextField label={tr("Qaytarish sababi")} value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("Masalan: o'lchami to'g'ri kelmadi")} />
            {total > 0 && (
              <Alert severity="warning" icon={false}>
                {tr("Omborga qaytadi: {0} xil tovar", chosen.length)}<br />
                {pay === 'nasiya' ? tr("Mijoz qarzidan ayriladi:") : tr("Mijozga qaytariladigan pul:")} <b style={{ fontSize: 18 }}>{fmtMoney(total)}</b>
              </Alert>
            )}
          </>}
          {err && <Alert severity="error">{err}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{tr("Bekor qilish")}</Button>
        <Button variant="contained" color="warning" onClick={save} disabled={busy || !sale || !chosen.length}>
          {tr("Qaytarishni tasdiqlash")}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
