import { useMemo, useState } from 'react'
import {
  Button, Chip, IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Tooltip, Typography,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import UndoIcon from '@mui/icons-material/Undo'
import AddIcon from '@mui/icons-material/Add'
import DownloadIcon from '@mui/icons-material/FileDownloadOutlined'
import CartIcon from '@mui/icons-material/ShoppingCartOutlined'
import TrendIcon from '@mui/icons-material/TrendingUp'
import InboxIcon from '@mui/icons-material/MoveToInboxOutlined'
import ReceiptIcon from '@mui/icons-material/ReceiptLongOutlined'
import type { Warehouse } from '../store'
import { useIsAdmin } from '../auth'
import type { Movement, MovementType } from '../types'
import { download, fmtDate, fmtMoney, fmtNum, fmtUsd, toCsv } from '../utils'
import { daysAgo, inRange, profitOf, saleLines, today } from '../stats'
import PageHeader from './PageHeader'
import ReceiptDialog from './ReceiptDialog'
import ReturnDialog from './ReturnDialog'
import ReturnIcon from '@mui/icons-material/AssignmentReturnOutlined'
import { paymentLabel } from '../types'
import StatCard from './StatCard'
import { t as tr } from '../i18n'

const label = { in: tr("Kirim"), out: tr("Chiqim"), adjust: tr("Inventarizatsiya"), return: tr("Qaytarish") } as const
const color = { in: 'success', out: 'warning', adjust: 'default', return: 'error' } as const

interface Props {
  wh: Warehouse
  title: string
  subtitle?: string
  fixedType?: MovementType
  newLabel?: string
  onNew?: () => void
}

export default function Movements({ wh, title, subtitle, fixedType, newLabel, onNew }: Props) {
  const { movements, products } = wh.data
  const [type, setType] = useState<string>(fixedType ?? '')
  const [from, setFrom] = useState(daysAgo(29))
  const [to, setTo] = useState(today())
  const [q, setQ] = useState('')
  const [receipt, setReceipt] = useState<{ saleId?: string; returnId?: string } | null>(null)
  const t = fixedType ?? type
  const isSale = t === 'out' || t === 'return'
  const admin = useIsAdmin()
  const [returning, setReturning] = useState(false)

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return movements.filter((m) => (!t || m.type === t) && inRange(m, from, to) &&
      (!s || m.productName.toLowerCase().includes(s) || m.counterparty.toLowerCase().includes(s) || m.note.toLowerCase().includes(s)))
  }, [movements, t, from, to, q])

  const total = (tp: MovementType) => list.filter((m) => m.type === tp).reduce((s, m) => s + m.qty * m.price, 0)
  const profit = saleLines(list).reduce((s, m) => s + profitOf(m, products), 0)

  const undo = (m: Movement) => {
    if (confirm(tr("Bu yozuv bekor qilinsinmi? \"{0}\" qoldig'i qayta hisoblanadi.", m.productName))) wh.deleteMovement(m.id).catch((e) => alert(e.message))
  }

  const exportCsv = () => {
    const rows: (string | number)[][] = [[tr("Sana"), tr("Turi"), tr("Mahsulot"), tr("Miqdor"), tr("Narx"), tr("Summa"), tr("Kontragent"), tr("Izoh")]]
    list.forEach((m) => rows.push([fmtDate(m.date), label[m.type], m.productName, m.qty, m.price, m.type === 'adjust' ? '' : m.qty * m.price, m.counterparty, m.note]))
    download(`${title.toLowerCase().replace(/\s+/g, '-')}-${from}_${to}.csv`, toCsv(rows), 'text/csv;charset=utf-8')
  }

  const showMoney = t !== 'adjust' && (admin || isSale)

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} actions={<>
        <TextField size="small" type="date" label={tr("Dan")} value={from} onChange={(e) => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField size="small" type="date" label={tr("Gacha")} value={to} onChange={(e) => setTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv}>{tr("Excel")}</Button>
        {isSale && <Button variant={t === 'return' ? 'contained' : 'outlined'} color="warning" startIcon={<ReturnIcon />} onClick={() => setReturning(true)}>{tr("Tovar qaytarish")}</Button>}
        {onNew && <Button variant="contained" startIcon={<AddIcon />} onClick={onNew}>{newLabel}</Button>}
      </>} />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {(!t || t === 'out') && <>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><StatCard icon={<CartIcon />} title={tr("Jami savdo")} value={fmtMoney(total('out'))} /></Grid>
          {total('return') > 0 && <Grid size={{ xs: 12, sm: 6, lg: 3 }}><StatCard icon={<ReturnIcon />} title={tr("Qaytarilgan")} value={'−' + fmtMoney(total('return'))} color="#E5533D" /></Grid>}
          {admin && <Grid size={{ xs: 12, sm: 6, lg: 3 }}><StatCard icon={<TrendIcon />} title={tr("Foyda")} value={fmtMoney(profit)} valueColor={profit >= 0 ? 'primary.main' : 'error.main'} /></Grid>}
        </>}
        {t === 'return' && (
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><StatCard icon={<ReturnIcon />} title={tr("Jami qaytarilgan")} value={fmtMoney(total('return'))} color="#E5533D" /></Grid>
        )}
        {(!t || t === 'in') && admin && (
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><StatCard icon={<InboxIcon />} title={tr("Jami kirim")} value={fmtMoney(total('in'))} color="#3B82F6" /></Grid>
        )}
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><StatCard icon={<ReceiptIcon />} title={tr("Yozuvlar soni")} value={String(list.length)} color="#C9A227" /></Grid>
      </Grid>

      <Paper variant="outlined">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ p: 2 }}>
          <TextField size="small" label={tr("Qidirish")} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Mahsulot, mijoz, izoh")} sx={{ minWidth: 260 }} />
          {!fixedType && (
            <TextField size="small" select label={tr("Turi")} value={type} onChange={(e) => setType(e.target.value)} sx={{ minWidth: 180 }}>
              <MenuItem value="">{tr("Barchasi")}</MenuItem>
              <MenuItem value="in">{tr("Kirim")}</MenuItem>
              <MenuItem value="out">{tr("Chiqim")}</MenuItem>
              <MenuItem value="return">{tr("Qaytarish")}</MenuItem>
              <MenuItem value="adjust">{tr("Inventarizatsiya")}</MenuItem>
            </TextField>
          )}
        </Stack>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{tr("Sana")}</TableCell>
                {isSale && <TableCell>{tr("Chek")}</TableCell>}
                {!fixedType && <TableCell>{tr("Turi")}</TableCell>}
                <TableCell>{tr("Mahsulot")}</TableCell>
                <TableCell align="right">{tr("Miqdor")}</TableCell>
                {showMoney && <TableCell align="right">{tr("Narx")}</TableCell>}
                {showMoney && <TableCell align="right">{tr("Summa")}</TableCell>}
                {showMoney && <TableCell>{t === 'in' ? tr("Ta'minotchi") : isSale ? tr("Mijoz") : tr("Kontragent")}</TableCell>}
                {isSale && <TableCell>{t === 'return' ? tr("Qanday qaytarildi") : tr("To'lov")}</TableCell>}
                <TableCell>{isSale ? tr("Sotuvchi") : tr("Izoh")}</TableCell>
                {t === 'return' && <TableCell>{tr("Sabab")}</TableCell>}
                {admin && <TableCell className="no-print" />}
              </TableRow>
            </TableHead>
            <TableBody>
              {list.map((m) => (
                <TableRow key={m.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{fmtDate(m.date)}</TableCell>
                  {isSale && (
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {m.type === 'return' ? <>
                        <Chip size="small" clickable color="error" variant="outlined" label={`↩ №${m.batchId}`} onClick={() => setReceipt({ returnId: m.batchId! })} />
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>{tr("chek")} №{m.saleId}</Typography>
                      </> : m.saleId && <Chip size="small" clickable label={`№${m.saleId}`} onClick={() => setReceipt({ saleId: m.saleId! })} />}
                    </TableCell>
                  )}
                  {!fixedType && <TableCell><Chip size="small" variant="outlined" label={label[m.type]} color={color[m.type]} /></TableCell>}
                  <TableCell sx={{ fontWeight: 500 }}>{m.productName}</TableCell>
                  <TableCell align="right">{m.type === 'adjust' && m.qty > 0 ? '+' : ''}{fmtNum(m.qty)}</TableCell>
                  {showMoney && <TableCell align="right">{m.type === 'adjust' ? '' : fmtMoney(m.price)}
                    {m.priceUsd ? <Typography variant="caption" display="block" color="text.secondary">{fmtUsd(m.priceUsd)} × {fmtNum(m.rate ?? 0)}</Typography> : null}</TableCell>}
                  {showMoney && <TableCell align="right" sx={{ fontWeight: 600 }}>{m.type === 'adjust' ? '' : fmtMoney(m.qty * m.price)}</TableCell>}
                  {showMoney && <TableCell>{m.counterparty}</TableCell>}
                  {isSale && <TableCell>{m.type === 'return' && m.payment === 'nasiya' ? tr("Qarzidan ayrildi") : paymentLabel(m.payment)}</TableCell>}
                  <TableCell>{isSale ? m.seller : m.note}</TableCell>
                  {t === 'return' && <TableCell>{m.note}</TableCell>}
                  {admin && <TableCell className="no-print">
                    <Tooltip title={tr("Bekor qilish (qoldiq qaytariladi)")}><IconButton size="small" onClick={() => undo(m)}><UndoIcon fontSize="small" /></IconButton></Tooltip>
                  </TableCell>}
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow><TableCell colSpan={11} align="center" sx={{ py: 5, color: 'text.secondary' }}>{tr("Tanlangan davrda yozuv yo'q")}</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      {receipt && <ReceiptDialog wh={wh} saleId={receipt.saleId} returnId={receipt.returnId} onClose={() => setReceipt(null)} />}
      {returning && <ReturnDialog wh={wh} onClose={() => setReturning(false)} onDone={(id) => { setReturning(false); setReceipt({ returnId: id }) }} />}
    </>
  )
}
