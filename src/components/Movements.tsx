import { useMemo, useState } from 'react'
import {
  Button, Chip, IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Tooltip,
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
import type { Movement, MovementType } from '../types'
import { download, fmtDate, fmtMoney, fmtNum, toCsv } from '../utils'
import { daysAgo, inRange, profitOf, today } from '../stats'
import PageHeader from './PageHeader'
import ReceiptDialog from './ReceiptDialog'
import { paymentLabel } from '../types'
import StatCard from './StatCard'

const label = { in: 'Kirim', out: 'Chiqim', adjust: 'Inventarizatsiya' } as const
const color = { in: 'success', out: 'warning', adjust: 'default' } as const

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
  const [receipt, setReceipt] = useState<string | null>(null)
  const t = fixedType ?? type

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return movements.filter((m) => (!t || m.type === t) && inRange(m, from, to) &&
      (!s || m.productName.toLowerCase().includes(s) || m.counterparty.toLowerCase().includes(s) || m.note.toLowerCase().includes(s)))
  }, [movements, t, from, to, q])

  const total = (tp: MovementType) => list.filter((m) => m.type === tp).reduce((s, m) => s + m.qty * m.price, 0)
  const profit = list.filter((m) => m.type === 'out').reduce((s, m) => s + profitOf(m, products), 0)

  const undo = (m: Movement) => {
    if (confirm(`Bu yozuv bekor qilinsinmi? "${m.productName}" qoldig'i qayta hisoblanadi.`)) wh.deleteMovement(m.id).catch((e) => alert(e.message))
  }

  const exportCsv = () => {
    const rows: (string | number)[][] = [['Sana', 'Turi', 'Mahsulot', 'Miqdor', 'Narx', 'Summa', 'Kontragent', 'Izoh']]
    list.forEach((m) => rows.push([fmtDate(m.date), label[m.type], m.productName, m.qty, m.price, m.type === 'adjust' ? '' : m.qty * m.price, m.counterparty, m.note]))
    download(`${title.toLowerCase().replace(/\s+/g, '-')}-${from}_${to}.csv`, toCsv(rows), 'text/csv;charset=utf-8')
  }

  const showMoney = t !== 'adjust'

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} actions={<>
        <TextField size="small" type="date" label="Dan" value={from} onChange={(e) => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField size="small" type="date" label="Gacha" value={to} onChange={(e) => setTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv}>Excel</Button>
        {onNew && <Button variant="contained" startIcon={<AddIcon />} onClick={onNew}>{newLabel}</Button>}
      </>} />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {(!t || t === 'out') && <>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><StatCard icon={<CartIcon />} title="Jami savdo" value={fmtMoney(total('out'))} /></Grid>
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><StatCard icon={<TrendIcon />} title="Foyda" value={fmtMoney(profit)} valueColor={profit >= 0 ? 'primary.main' : 'error.main'} /></Grid>
        </>}
        {(!t || t === 'in') && (
          <Grid size={{ xs: 12, sm: 6, lg: 3 }}><StatCard icon={<InboxIcon />} title="Jami kirim" value={fmtMoney(total('in'))} color="#3B82F6" /></Grid>
        )}
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><StatCard icon={<ReceiptIcon />} title="Yozuvlar soni" value={String(list.length)} color="#C9A227" /></Grid>
      </Grid>

      <Paper variant="outlined">
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ p: 2 }}>
          <TextField size="small" label="Qidirish" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mahsulot, mijoz, izoh" sx={{ minWidth: 260 }} />
          {!fixedType && (
            <TextField size="small" select label="Turi" value={type} onChange={(e) => setType(e.target.value)} sx={{ minWidth: 180 }}>
              <MenuItem value="">Barchasi</MenuItem>
              <MenuItem value="in">Kirim</MenuItem>
              <MenuItem value="out">Chiqim</MenuItem>
              <MenuItem value="adjust">Inventarizatsiya</MenuItem>
            </TextField>
          )}
        </Stack>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Sana</TableCell>
                {t === 'out' && <TableCell>Chek</TableCell>}
                {!fixedType && <TableCell>Turi</TableCell>}
                <TableCell>Mahsulot</TableCell>
                <TableCell align="right">Miqdor</TableCell>
                {showMoney && <TableCell align="right">Narx</TableCell>}
                {showMoney && <TableCell align="right">Summa</TableCell>}
                {showMoney && <TableCell>{t === 'in' ? "Ta'minotchi" : t === 'out' ? 'Mijoz' : 'Kontragent'}</TableCell>}
                {t === 'out' && <TableCell>To'lov</TableCell>}
                <TableCell>{t === 'out' ? 'Sotuvchi' : 'Izoh'}</TableCell>
                <TableCell className="no-print" />
              </TableRow>
            </TableHead>
            <TableBody>
              {list.map((m) => (
                <TableRow key={m.id} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{fmtDate(m.date)}</TableCell>
                  {t === 'out' && (
                    <TableCell>
                      {m.saleId && <Chip size="small" clickable label={`№${m.saleId}`} onClick={() => setReceipt(m.saleId!)} />}
                    </TableCell>
                  )}
                  {!fixedType && <TableCell><Chip size="small" variant="outlined" label={label[m.type]} color={color[m.type]} /></TableCell>}
                  <TableCell sx={{ fontWeight: 500 }}>{m.productName}</TableCell>
                  <TableCell align="right">{m.type === 'adjust' && m.qty > 0 ? '+' : ''}{fmtNum(m.qty)}</TableCell>
                  {showMoney && <TableCell align="right">{m.type === 'adjust' ? '' : fmtMoney(m.price)}</TableCell>}
                  {showMoney && <TableCell align="right" sx={{ fontWeight: 600 }}>{m.type === 'adjust' ? '' : fmtMoney(m.qty * m.price)}</TableCell>}
                  {showMoney && <TableCell>{m.counterparty}</TableCell>}
                  {t === 'out' && <TableCell>{paymentLabel(m.payment)}</TableCell>}
                  <TableCell>{t === 'out' ? m.seller : m.note}</TableCell>
                  <TableCell className="no-print">
                    <Tooltip title="Bekor qilish (qoldiq qaytariladi)"><IconButton size="small" onClick={() => undo(m)}><UndoIcon fontSize="small" /></IconButton></Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow><TableCell colSpan={11} align="center" sx={{ py: 5, color: 'text.secondary' }}>Tanlangan davrda yozuv yo'q</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      {receipt && <ReceiptDialog wh={wh} saleId={receipt} onClose={() => setReceipt(null)} />}
    </>
  )
}
