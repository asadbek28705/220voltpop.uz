import { useMemo, useState } from 'react'
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItemButton, Stack, Typography,
} from '@mui/material'
import ReceiptIcon from '@mui/icons-material/ReceiptLongOutlined'
import type { Warehouse } from '../store'
import { paymentLabel } from '../types'
import { useMe } from '../auth'
import { fmtMoney } from '../utils'
import { dayKey, today } from '../stats'
import ReceiptDialog from './ReceiptDialog'
import { t as tr } from '../i18n'

const hm = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }

/**
 * Bugungi cheklar: sotuvchi faqat o'zinikini, admin — hammanikini ko'radi.
 * Bosilsa chek ochiladi — qayta chop etish yoki qaytarish mumkin.
 */
export default function MyReceiptsDialog({ wh, onClose }: { wh: Warehouse; onClose: () => void }) {
  const me = useMe()
  const admin = me.user?.role === 'admin' || me.demo
  const name = me.user?.name ?? ''
  const [open, setOpen] = useState<string | null>(null)

  const list = useMemo(() => {
    const t = today()
    const map = new Map<string, { saleId: string; date: string; sum: number; returned: number; payment: string; customer: string; seller: string; items: number }>()
    for (const m of wh.data.movements) {
      if (m.type !== 'out' || !m.saleId || dayKey(m.date) !== t) continue
      if (!admin && m.seller !== name) continue
      const r = map.get(m.saleId) ?? { saleId: m.saleId, date: m.date, sum: 0, returned: 0, payment: m.payment ?? '', customer: m.counterparty, seller: m.seller ?? '', items: 0 }
      r.sum += m.qty * m.price; r.items++
      map.set(m.saleId, r)
    }
    for (const m of wh.data.movements) if (m.type === 'return' && m.saleId && map.has(m.saleId)) map.get(m.saleId)!.returned += m.qty * m.price
    return [...map.values()].sort((a, b) => b.date.localeCompare(a.date))
  }, [wh.data.movements, admin, name])

  const total = list.reduce((s, r) => s + r.sum - r.returned, 0)
  const byPay = new Map<string, number>()
  for (const r of list) byPay.set(r.payment, (byPay.get(r.payment) ?? 0) + r.sum - r.returned)

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{admin ? tr("Bugungi cheklar") : tr("Bugungi cheklarim")}</DialogTitle>
      <DialogContent>
        <Box sx={{ p: 2, mb: 2, borderRadius: 3, bgcolor: 'action.selected' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="baseline">
            <Typography color="text.secondary">{tr("{0} ta chek", list.length)}</Typography>
            <Typography sx={{ fontSize: 22, fontWeight: 800, color: 'primary.main' }}>{fmtMoney(total)}</Typography>
          </Stack>
          {byPay.size > 0 && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
              {[...byPay].map(([p, v]) => <Chip key={p} size="small" variant="outlined" color={p === 'nasiya' ? 'error' : 'default'} label={`${paymentLabel(p)}: ${fmtMoney(v)}`} />)}
            </Stack>
          )}
        </Box>
        {list.length === 0 ? (
          <Stack alignItems="center" sx={{ py: 5, color: 'text.secondary' }}>
            <ReceiptIcon sx={{ fontSize: 44, opacity: 0.4 }} />
            <Typography>{tr("Bugun hali savdo yo'q")}</Typography>
          </Stack>
        ) : (
          <List disablePadding>
            {list.map((r) => (
              <ListItemButton key={r.saleId} onClick={() => setOpen(r.saleId)} sx={{ mb: 0.75, border: 1, borderColor: 'divider', borderRadius: 3, py: 1.25 }}>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ width: '100%' }}>
                  <Box sx={{ minWidth: 54 }}>
                    <Typography sx={{ fontWeight: 800 }}>№{r.saleId}</Typography>
                    <Typography variant="caption" color="text.secondary">{hm(r.date)}</Typography>
                  </Box>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: 600 }}>{r.customer || tr("Mijoz ko'rsatilmagan")}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap component="div">
                      {tr('{0} xil', r.items)} · {paymentLabel(r.payment)}{admin && r.seller ? ` · ${r.seller}` : ''}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>{fmtMoney(r.sum)}</Typography>
                    {r.returned > 0 && <Typography variant="caption" color="error" sx={{ whiteSpace: 'nowrap' }}>↩ −{fmtMoney(r.returned)}</Typography>}
                  </Box>
                </Stack>
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>{tr("Yopish")}</Button></DialogActions>
      {open && <ReceiptDialog wh={wh} saleId={open} onClose={() => setOpen(null)} />}
    </Dialog>
  )
}
