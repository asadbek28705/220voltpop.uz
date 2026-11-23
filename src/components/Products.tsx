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
import { useIsAdmin } from '../auth'
import type { Currency, MovementType, Product } from '../types'
import { download, fmtDate, fmtMoney, fmtNum, fmtUsd, toCsv } from '../utils'
import RateDialog from './RateDialog'
import { Alert, Snackbar } from '@mui/material'
import ProductDialog from './ProductDialog'
import PageHeader from './PageHeader'

interface Props { wh: Warehouse; onMovement: (t: MovementType, id?: string) => void; currency?: Currency }

const TITLES = {
  all: { title: 'Tovarlar', subtitle: 'Ombordagi barcha tovarlar va qoldiqlar' },
  USD: { title: 'Dollarda olinadigan tovarlar', subtitle: "Dollarda sotib olinadi, so'mda sotiladi — tannarx kurs bo'yicha hisoblanadi" },
  UZS: { title: "So'mda olinadigan tovarlar", subtitle: "So'mda sotib olinadigan tovarlar" },
}

export default function Products({ wh, onMovement, currency }: Props) {
  const { categories, settings } = wh.data
  const products = useMemo(() => wh.data.products.filter((p) => !currency || (p.currency ?? 'UZS') === currency), [wh.data.products, currency])
  const [rateOpen, setRateOpen] = useState(false)
  const [toast, setToast] = useState('')
  const rate = settings.usdRate ?? 0
  const t = TITLES[currency ?? 'all']
  const usdCount = wh.data.products.filter((p) => p.currency === 'USD').length
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [editing, setEditing] = useState<Product | 'new' | null>(null)
  const admin = useIsAdmin()

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return products
      .filter((p) => !cat || p.category === cat)
      .filter((p) => !lowOnly || p.qty <= p.minQty)
      .filter((p) => !s || p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s) || p.location.toLowerCase().includes(s) || p.barcode.includes(s))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [products, q, cat, lowOnly])

  const exportCsv = () => {
    const rows: (string | number)[][] = [['Nomi', 'Artikul', 'Shtrix-kod', 'Kategoriya', 'Birlik', 'Qoldiq', 'Minimal', 'Valyuta', 'Kelish narxi ($)', "Kelish narxi (so'm)", 'Ustama %', 'Sotuv narxi', 'Joyi']]
    list.forEach((p) => rows.push([p.name, p.sku, p.barcode, p.category, p.unit, p.qty, p.minQty, p.currency === 'USD' ? 'USD' : "so'm",
      p.currency === 'USD' ? p.buyPriceUsd : '', p.buyPrice, p.markup || '', p.sellPrice, p.location]))
    download(`${currency === 'USD' ? 'dollar-' : currency === 'UZS' ? 'som-' : ''}mahsulotlar-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows), 'text/csv;charset=utf-8')
  }

  const remove = (p: Product) => {
    if (confirm(`"${p.name}" o'chirilsinmi? Tarixdagi yozuvlar saqlanib qoladi.`)) wh.deleteProduct(p.id).catch((e) => alert(e.message))
  }

  return (
    <Stack spacing={2}>
      <PageHeader title={t.title} subtitle={t.subtitle} actions={<>
        {admin && currency !== 'UZS' && (
          <Tooltip title={settings.rateDate ? `Yangilangan: ${fmtDate(settings.rateDate)}` : ''}>
            <Button variant="outlined" color={rate > 0 ? 'inherit' : 'warning'} onClick={() => setRateOpen(true)}>
              💵 {rate > 0 ? `1$ = ${fmtMoney(rate)}` : 'Dollar kursi'}
            </Button>
          </Tooltip>
        )}
        {admin && <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv}>Excel</Button>}
        {admin && <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>Yangi tovar</Button>}
      </>} />
      {admin && currency === 'USD' && !(rate > 0) && (
        <Alert severity="warning" action={<Button color="inherit" onClick={() => setRateOpen(true)}>Kiritish</Button>}>
          Dollar kursi kiritilmagan — dollardagi tovarlarning tannarxini hisoblab bo'lmaydi.
        </Alert>
      )}
      {admin && !currency && usdCount > 0 && rate > 0 && (
        <Typography variant="body2" color="text.secondary">
          {usdCount} ta tovar dollarda olinadi — «Dollarda olinadigan» bo'limida alohida ko'rish mumkin.
        </Typography>
      )}
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
              {admin && <TableCell align="right">Kelish narxi</TableCell>}
              <TableCell align="right">Sotuv narxi</TableCell>
              {admin && <TableCell align="right">Jami (tannarx)</TableCell>}
              <TableCell>Joyi</TableCell>
              <TableCell align="center">Amallar</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.map((p) => {
              const status = p.qty === 0 ? 'error' : p.qty <= p.minQty ? 'warning' : 'success'
              return (
                <TableRow key={p.id} hover>
                  <TableCell sx={{ fontWeight: 500 }}>
                    {p.name}
                    {!currency && p.currency === 'USD' && <Chip size="small" label="$" color="success" variant="outlined" sx={{ ml: 1, height: 20 }} />}
                  </TableCell>
                  <TableCell>{p.sku}{p.barcode && <Typography variant="caption" display="block" color="text.secondary">{p.barcode}</Typography>}</TableCell>
                  <TableCell><Typography variant="body2" color="text.secondary">{p.category}</Typography></TableCell>
                  <TableCell align="right"><Chip size="small" variant="outlined" color={status} label={`${fmtNum(p.qty)} ${p.unit}`} /></TableCell>
                  {admin && <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {p.currency === 'USD' ? <>
                      <b>{fmtUsd(p.buyPriceUsd)}</b>
                      <Typography variant="caption" display="block" color="text.secondary">{fmtMoney(p.buyPrice)}</Typography>
                    </> : fmtMoney(p.buyPrice)}
                  </TableCell>}
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {fmtMoney(p.sellPrice)}
                    {admin && p.markup > 0 && <Typography variant="caption" display="block" color="text.secondary">+{p.markup}%</Typography>}
                  </TableCell>
                  {admin && <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{fmtMoney(p.qty * p.buyPrice)}</TableCell>}
                  <TableCell>{p.location}</TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="Kirim"><IconButton size="small" color="success" onClick={() => onMovement('in', p.id)}><InIcon /></IconButton></Tooltip>
                    <Tooltip title="Chiqim / Sotuv"><IconButton size="small" color="primary" onClick={() => onMovement('out', p.id)}><OutIcon /></IconButton></Tooltip>
                    {admin && <>
                      <Tooltip title="Inventarizatsiya (qoldiqni tuzatish)"><IconButton size="small" onClick={() => onMovement('adjust', p.id)}><TuneIcon /></IconButton></Tooltip>
                      <Tooltip title="Tahrirlash"><IconButton size="small" onClick={() => setEditing(p)}><EditIcon /></IconButton></Tooltip>
                      <Tooltip title="O'chirish"><IconButton size="small" color="error" onClick={() => remove(p)}><DeleteIcon /></IconButton></Tooltip>
                    </>}
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
        Ko'rsatilgan: {list.length} ta{admin && <> · Jami tannarx: {fmtMoney(list.reduce((s, p) => s + p.qty * p.buyPrice, 0))}</>}
      </Typography>

      {editing && <ProductDialog wh={wh} product={editing === 'new' ? undefined : editing} defaultCurrency={currency} onClose={() => setEditing(null)} />}
      {rateOpen && <RateDialog wh={wh} onClose={() => setRateOpen(false)} onDone={setToast} />}
      <Snackbar open={!!toast} autoHideDuration={5000} onClose={() => setToast('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" onClose={() => setToast('')}>{toast}</Alert>
      </Snackbar>
    </Stack>
  )
}
