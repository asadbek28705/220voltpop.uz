import { useMemo, useState } from 'react'
import {
  Button, Chip, IconButton, InputAdornment, MenuItem, Paper, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Tooltip, Typography, FormControlLabel, Switch,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/DeleteOutline'
import InIcon from '@mui/icons-material/AddCircleOutline'
import OutIcon from '@mui/icons-material/RemoveCircleOutline'
import TuneIcon from '@mui/icons-material/Tune'
import DownloadIcon from '@mui/icons-material/FileDownloadOutlined'
import type { Warehouse } from '../store'
import type { MovementType, Product } from '../types'
import { download, fmtMoney, fmtNum, toCsv } from '../utils'
import ProductDialog from './ProductDialog'
import PageHeader from './PageHeader'

interface Props { wh: Warehouse; onMovement: (t: MovementType, id?: string) => void }

export default function Products({ wh, onMovement }: Props) {
  const { products, categories } = wh.data
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [editing, setEditing] = useState<Product | 'new' | null>(null)

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return products
      .filter((p) => !cat || p.category === cat)
      .filter((p) => !lowOnly || p.qty <= p.minQty)
      .filter((p) => !s || p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s) || p.location.toLowerCase().includes(s) || p.barcode.includes(s))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [products, q, cat, lowOnly])

  const exportCsv = () => {
    const rows: (string | number)[][] = [['Nomi', 'Artikul', 'Shtrix-kod', 'Kategoriya', 'Birlik', 'Qoldiq', 'Minimal', 'Kelish narxi', 'Sotuv narxi', 'Joyi']]
    list.forEach((p) => rows.push([p.name, p.sku, p.barcode, p.category, p.unit, p.qty, p.minQty, p.buyPrice, p.sellPrice, p.location]))
    download(`mahsulotlar-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows), 'text/csv;charset=utf-8')
  }

  const remove = (p: Product) => {
    if (confirm(`"${p.name}" o'chirilsinmi? Tarixdagi yozuvlar saqlanib qoladi.`)) wh.deleteProduct(p.id).catch((e) => alert(e.message))
  }

  return (
    <Stack spacing={2}>
      <PageHeader title="Tovarlar" subtitle="Ombordagi barcha tovarlar va qoldiqlar" actions={<>
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv}>Excel</Button>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>Yangi tovar</Button>
      </>} />
      <Paper variant="outlined">
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} sx={{ p: 2 }}>
        <TextField size="small" placeholder="Qidirish: nomi, artikul, shtrix-kod" value={q} onChange={(e) => setQ(e.target.value)} sx={{ minWidth: 300 }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }} />
        <TextField size="small" select label="Kategoriya" value={cat} onChange={(e) => setCat(e.target.value)} sx={{ minWidth: 240 }}>
          <MenuItem value="">Barchasi</MenuItem>
          {categories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
        </TextField>
        <FormControlLabel control={<Switch checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />} label="Faqat kam qolganlar" />
      </Stack>
      <TableContainer>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Nomi</TableCell>
              <TableCell>Artikul</TableCell>
              <TableCell>Kategoriya</TableCell>
              <TableCell align="right">Qoldiq</TableCell>
              <TableCell align="right">Kelish narxi</TableCell>
              <TableCell align="right">Sotuv narxi</TableCell>
              <TableCell align="right">Jami (tannarx)</TableCell>
              <TableCell>Joyi</TableCell>
              <TableCell align="center">Amallar</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.map((p) => {
              const status = p.qty === 0 ? 'error' : p.qty <= p.minQty ? 'warning' : 'success'
              return (
                <TableRow key={p.id} hover>
                  <TableCell sx={{ fontWeight: 500 }}>{p.name}</TableCell>
                  <TableCell>{p.sku}{p.barcode && <Typography variant="caption" display="block" color="text.secondary">{p.barcode}</Typography>}</TableCell>
                  <TableCell><Typography variant="body2" color="text.secondary">{p.category}</Typography></TableCell>
                  <TableCell align="right"><Chip size="small" variant="outlined" color={status} label={`${fmtNum(p.qty)} ${p.unit}`} /></TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{fmtMoney(p.buyPrice)}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{fmtMoney(p.sellPrice)}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{fmtMoney(p.qty * p.buyPrice)}</TableCell>
                  <TableCell>{p.location}</TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="Kirim"><IconButton size="small" color="success" onClick={() => onMovement('in', p.id)}><InIcon /></IconButton></Tooltip>
                    <Tooltip title="Chiqim / Sotuv"><IconButton size="small" color="primary" onClick={() => onMovement('out', p.id)}><OutIcon /></IconButton></Tooltip>
                    <Tooltip title="Inventarizatsiya (qoldiqni tuzatish)"><IconButton size="small" onClick={() => onMovement('adjust', p.id)}><TuneIcon /></IconButton></Tooltip>
                    <Tooltip title="Tahrirlash"><IconButton size="small" onClick={() => setEditing(p)}><EditIcon /></IconButton></Tooltip>
                    <Tooltip title="O'chirish"><IconButton size="small" color="error" onClick={() => remove(p)}><DeleteIcon /></IconButton></Tooltip>
                  </TableCell>
                </TableRow>
              )
            })}
            {list.length === 0 && (
              <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>Mahsulot topilmadi</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      </Paper>
      <Typography variant="body2" color="text.secondary">
        Ko'rsatilgan: {list.length} ta · Jami tannarx: {fmtMoney(list.reduce((s, p) => s + p.qty * p.buyPrice, 0))}
      </Typography>

      {editing && <ProductDialog wh={wh} product={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </Stack>
  )
}
