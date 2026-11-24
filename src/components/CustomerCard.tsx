import { useMemo, useState } from 'react'
import {
  Box, Button, Chip, Dialog, DialogContent, DialogTitle, IconButton, List, ListItem, ListItemButton, ListItemText, Stack, Tab, Tabs,
  Tooltip, Typography, useMediaQuery, useTheme,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import CartIcon from '@mui/icons-material/AddShoppingCartOutlined'
import PayIcon from '@mui/icons-material/PaymentsOutlined'
import EditIcon from '@mui/icons-material/EditOutlined'
import UndoIcon from '@mui/icons-material/Undo'
import PhoneIcon from '@mui/icons-material/PhoneOutlined'
import type { Warehouse } from '../store'
import type { Customer } from '../types'
import { paymentLabel } from '../types'
import { useIsAdmin } from '../auth'
import { fmtDate, fmtMoney, fmtNum } from '../utils'
import ReceiptDialog from './ReceiptDialog'
import { t as tr } from '../i18n'

interface Props {
  wh: Warehouse
  customer: Customer
  onClose: () => void
  onSell: (c: Customer) => void
  onPay: (c: Customer, type: 'pay' | 'debt') => void
  onEdit: (c: Customer) => void
}

/** Mijoz kartasi: qarz, xaridlar va to'lovlar tarixi */
export default function CustomerCard({ wh, customer: initial, onClose, onSell, onPay, onEdit }: Props) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down('sm'))
  const admin = useIsAdmin()
  const c = wh.data.customers.find((x) => x.id === initial.id) ?? initial
  const [tab, setTab] = useState(c.debt > 0 ? 1 : 0)
  const [receipt, setReceipt] = useState<string | null>(null)

  const sales = useMemo(() => {
    const map = new Map<string, { saleId: string; date: string; sum: number; payment: string; items: string[] }>()
    for (const m of wh.data.movements) {
      if (m.type !== 'out' || m.customerId !== c.id || !m.saleId) continue
      const s = map.get(m.saleId) ?? { saleId: m.saleId, date: m.date, sum: 0, payment: m.payment ?? '', items: [] }
      s.sum += m.qty * m.price
      s.items.push(`${m.productName} × ${fmtNum(m.qty)}`)
      map.set(m.saleId, s)
    }
    return [...map.values()].sort((a, b) => b.date.localeCompare(a.date))
  }, [wh.data.movements, c.id])

  // Qarz daftari: nasiya savdolar (+), qo'lda qarzlar (+), to'lovlar (−)
  const ledger = useMemo(() => {
    const rows: { key: string; date: string; title: string; sub: string; amount: number; txId?: string; saleId?: string }[] = []
    for (const s of sales) if (s.payment === 'nasiya') rows.push({ key: 's' + s.saleId, date: s.date, title: tr("Nasiya — chek №{0}", s.saleId), sub: s.items.join(', '), amount: s.sum, saleId: s.saleId })
    // Nasiya chekdan qaytarilgan tovar — qarzdan ayriladi
    const back = new Map<string, { date: string; sum: number; saleId: string; items: string[] }>()
    for (const m of wh.data.movements) {
      if (m.type !== 'return' || m.customerId !== c.id || m.payment !== 'nasiya' || !m.batchId) continue
      const r = back.get(m.batchId) ?? { date: m.date, sum: 0, saleId: m.saleId ?? '', items: [] }
      r.sum += m.qty * m.price
      r.items.push(`${m.productName} × ${fmtNum(m.qty)}`)
      back.set(m.batchId, r)
    }
    for (const [id, r] of back) rows.push({ key: 'r' + id, date: r.date, title: tr("Qaytarildi — chek №{0}", r.saleId), sub: r.items.join(', '), amount: -r.sum, saleId: r.saleId })
    for (const t of wh.data.customerTx) {
      if (t.customerId !== c.id) continue
      rows.push({
        key: t.id, date: t.date, txId: t.id, amount: t.type === 'pay' ? -t.amount : t.amount,
        title: t.type === 'pay' ? tr("To'lov · {0}", paymentLabel(t.payment)) : tr("Qarz yozildi"),
        sub: [t.note, t.seller].filter(Boolean).join(' · '),
      })
    }
    return rows.sort((a, b) => b.date.localeCompare(a.date))
  }, [sales, wh.data.customerTx, wh.data.movements, c.id])

  const undoTx = (id: string) => {
    if (confirm(tr("Bu yozuv bekor qilinsinmi? Qarz qayta hisoblanadi."))) wh.deleteCustomerTx(id).catch((e) => alert(e.message))
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" fullScreen={fullScreen}>
      <DialogTitle sx={{ pr: 6 }}>
        {c.name}
        <IconButton onClick={onClose} sx={{ position: 'absolute', right: 12, top: 12 }}><CloseIcon /></IconButton>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
          {c.phone && <Chip size="small" icon={<PhoneIcon />} label={c.phone} component="a" href={`tel:${c.phone.replace(/\s/g, '')}`} clickable />}
          {c.note && <Typography variant="body2" color="text.secondary">{c.note}</Typography>}
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <Box sx={{ flex: 1, p: 1.5, borderRadius: 2, bgcolor: c.debt > 0 ? 'rgba(229,83,61,0.08)' : 'action.hover' }}>
            <Typography variant="caption" color="text.secondary">{c.debt < 0 ? tr("Oldindan to'lagan") : tr("Qarzi")}</Typography>
            <Typography variant="h5" sx={{ color: c.debt > 0 ? 'error.main' : 'primary.main' }}>{fmtMoney(Math.abs(c.debt))}</Typography>
          </Box>
          <Box sx={{ flex: 1, p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
            <Typography variant="caption" color="text.secondary">{tr("Jami xaridlari (")}{c.receipts} {tr("chek)")}</Typography>
            <Typography variant="h5">{fmtMoney(c.bought)}</Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
          <Button variant="contained" startIcon={<CartIcon />} onClick={() => onSell(c)}>{tr("Sotuv")}</Button>
          <Button variant="outlined" startIcon={<PayIcon />} onClick={() => onPay(c, 'pay')}>{tr("To'lov qabul qilish")}</Button>
          {admin && <Button color="warning" onClick={() => onPay(c, 'debt')}>{tr("Qarz qo'shish")}</Button>}
          {admin && <Button color="inherit" startIcon={<EditIcon />} onClick={() => onEdit(c)}>{tr("Tahrirlash")}</Button>}
        </Stack>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label={tr("Xaridlar ({0})", sales.length)} />
          <Tab label={tr("Qarz daftari ({0})", ledger.length)} />
        </Tabs>
        {tab === 0 && (
          <List dense>
            {sales.length === 0 && <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>{tr("Hali xarid yo'q")}</Typography>}
            {sales.map((s) => (
              <ListItemButton key={s.saleId} onClick={() => setReceipt(s.saleId)} sx={{ borderRadius: 2 }}>
                <ListItemText primary={<>{tr("Chek №")}{s.saleId} · {fmtDate(s.date)}</>} secondary={s.items.join(', ')}
                  slotProps={{ secondary: { noWrap: true } }} sx={{ minWidth: 0, mr: 2 }} />
                <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                  <Typography sx={{ fontWeight: 700 }}>{fmtMoney(s.sum)}</Typography>
                  <Typography variant="caption" color={s.payment === 'nasiya' ? 'error' : 'text.secondary'}>{paymentLabel(s.payment)}</Typography>
                </Box>
              </ListItemButton>
            ))}
          </List>
        )}
        {tab === 1 && (
          <List dense>
            {ledger.length === 0 && <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>{tr("Qarz yozuvlari yo'q")}</Typography>}
            {ledger.map((r) => (
              <ListItem key={r.key} disableGutters sx={{ px: 1 }}
                secondaryAction={admin && r.txId ? <Tooltip title={tr("Bekor qilish")}><IconButton size="small" onClick={() => undoTx(r.txId!)}><UndoIcon fontSize="small" /></IconButton></Tooltip> : undefined}>
                <ListItemText primary={<>{r.title} · <Typography component="span" variant="body2" color="text.secondary">{fmtDate(r.date)}</Typography></>}
                  secondary={r.sub} slotProps={{ secondary: { noWrap: true } }} sx={{ minWidth: 0, mr: 2 }} />
                <Typography sx={{ fontWeight: 700, whiteSpace: 'nowrap', mr: admin && r.txId ? 4 : 0, color: r.amount > 0 ? 'error.main' : 'primary.main' }}>
                  {r.amount > 0 ? '+' : '−'}{fmtMoney(Math.abs(r.amount))}
                </Typography>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      {receipt && <ReceiptDialog wh={wh} saleId={receipt} onClose={() => setReceipt(null)} />}
    </Dialog>
  )
}
