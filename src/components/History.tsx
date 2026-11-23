import { useMemo, useState } from 'react'
import {
  Button, Chip, IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Tooltip, Typography,
} from '@mui/material'
import UndoIcon from '@mui/icons-material/Undo'
import DownloadIcon from '@mui/icons-material/Download'
import type { Warehouse } from '../store'
import type { Movement } from '../types'
import { download, fmtDate, fmtMoney, fmtNum, toCsv } from '../utils'

const label = { in: 'Kirim', out: 'Chiqim', adjust: 'Inventarizatsiya' } as const
const color = { in: 'success', out: 'secondary', adjust: 'default' } as const

export default function History({ wh }: { wh: Warehouse }) {
  const { movements } = wh.data
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = today.slice(0, 8) + '01'
  const [type, setType] = useState('')
  const [from, setFrom] = useState(monthStart)
  const [to, setTo] = useState(today)
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return movements.filter((m) => {
      const d = m.date.slice(0, 10)
      return (!type || m.type === type) && (!from || d >= from) && (!to || d <= to) &&
        (!s || m.productName.toLowerCase().includes(s) || m.counterparty.toLowerCase().includes(s) || m.note.toLowerCase().includes(s))
    })
  }, [movements, type, from, to, q])

  const sum = (t: Movement['type']) => list.filter((m) => m.type === t).reduce((s, m) => s + m.qty * m.price, 0)
  const profit = list.filter((m) => m.type === 'out').reduce((s, m) => {
    const p = wh.data.products.find((x) => x.id === m.productId)
    return s + (p ? m.qty * (m.price - p.buyPrice) : 0)
  }, 0)

  const undo = (m: Movement) => {
    if (confirm(`Bu yozuv bekor qilinsinmi? "${m.productName}" qoldig'i qayta hisoblanadi.`)) wh.deleteMovement(m.id)
  }

  const exportCsv = () => {
    const rows: (string | number)[][] = [['Sana', 'Turi', 'Mahsulot', 'Miqdor', 'Narx', 'Summa', 'Kontragent', 'Izoh']]
    list.forEach((m) => rows.push([fmtDate(m.date), label[m.type], m.productName, m.qty, m.price, m.type === 'adjust' ? '' : m.qty * m.price, m.counterparty, m.note]))
    download(`harakatlar-${from}_${to}.csv`, toCsv(rows), 'text/csv;charset=utf-8')
  }

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
        <TextField size="small" label="Qidirish" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Mahsulot, mijoz, izoh" sx={{ minWidth: 240 }} />
        <TextField size="small" select label="Turi" value={type} onChange={(e) => setType(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">Barchasi</MenuItem>
          <MenuItem value="in">Kirim</MenuItem>
          <MenuItem value="out">Chiqim</MenuItem>
          <MenuItem value="adjust">Inventarizatsiya</MenuItem>
        </TextField>
        <TextField size="small" type="date" label="Dan" value={from} onChange={(e) => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField size="small" type="date" label="Gacha" value={to} onChange={(e) => setTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <Button startIcon={<DownloadIcon />} onClick={exportCsv} sx={{ ml: { md: 'auto !important' } }}>Excel (CSV)</Button>
      </Stack>

      <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
        <Typography>Kirim: <b>{fmtMoney(sum('in'))}</b></Typography>
        <Typography>Sotuv: <b>{fmtMoney(sum('out'))}</b></Typography>
        <Typography>Taxminiy foyda: <b style={{ color: profit >= 0 ? '#2e7d32' : '#d32f2f' }}>{fmtMoney(profit)}</b></Typography>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Sana</TableCell>
              <TableCell>Turi</TableCell>
              <TableCell>Mahsulot</TableCell>
              <TableCell align="right">Miqdor</TableCell>
              <TableCell align="right">Narx</TableCell>
              <TableCell align="right">Summa</TableCell>
              <TableCell>Kontragent</TableCell>
              <TableCell>Izoh</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {list.map((m) => (
              <TableRow key={m.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{fmtDate(m.date)}</TableCell>
                <TableCell><Chip size="small" label={label[m.type]} color={color[m.type]} /></TableCell>
                <TableCell>{m.productName}</TableCell>
                <TableCell align="right">{m.type === 'adjust' && m.qty > 0 ? '+' : ''}{fmtNum(m.qty)}</TableCell>
                <TableCell align="right">{m.type === 'adjust' ? '' : fmtMoney(m.price)}</TableCell>
                <TableCell align="right">{m.type === 'adjust' ? '' : fmtMoney(m.qty * m.price)}</TableCell>
                <TableCell>{m.counterparty}</TableCell>
                <TableCell>{m.note}</TableCell>
                <TableCell>
                  <Tooltip title="Bekor qilish"><IconButton size="small" onClick={() => undo(m)}><UndoIcon fontSize="small" /></IconButton></Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {list.length === 0 && (
              <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>Tanlangan davrda yozuv yo'q</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  )
}
