import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Alert, Box, Button, Card, Checkbox, FormControlLabel, InputAdornment, MenuItem, Paper, Stack, Switch, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import PrintIcon from '@mui/icons-material/PrintOutlined'
import AutoIcon from '@mui/icons-material/AutoFixHighOutlined'
import type { Warehouse } from '../store'
import { useIsAdmin } from '../auth'
import type { Product } from '../types'
import { attempt } from '../api'
import { fmtMoney, fmtNum } from '../utils'
import PageHeader from './PageHeader'
import { LABEL_FORMATS, Label, type LabelFormat } from './Label'

/** Chop etish: etiketkalarni maxsus joyga chiqarib, sahifa o'lchamini etiketkaga moslaymiz */
function printLabels(onDone: () => void) {
  document.body.classList.add('printing-receipt')
  const done = () => {
    document.body.classList.remove('printing-receipt')
    document.getElementById('label-page-style')?.remove()
    window.removeEventListener('afterprint', done)
    onDone()
  }
  window.addEventListener('afterprint', done)
  setTimeout(() => window.print(), 150)
}

function LabelSheets({ items, format, showPrice, shopName }: { items: Product[]; format: LabelFormat; showPrice: boolean; shopName?: string }) {
  if (!format.sheet) {
    return (
      <div className="labels-roll">
        {items.map((p, i) => <Label key={i} product={p} format={format} showPrice={showPrice} shopName={shopName} />)}
      </div>
    )
  }
  const per = format.sheet.cols * format.sheet.rows
  const pages: Product[][] = []
  for (let i = 0; i < items.length; i += per) pages.push(items.slice(i, i + per))
  return (
    <>
      {pages.map((page, i) => (
        <div key={i} className="labels-sheet" style={{
          gridTemplateColumns: `repeat(${format.sheet!.cols}, ${format.width}mm)`,
          gridAutoRows: `${format.height}mm`,
          width: '210mm', height: '297mm', breakAfter: 'page', pageBreakAfter: 'always',
        }}>
          {page.map((p, j) => <Label key={j} product={p} format={format} showPrice={showPrice} shopName={shopName} />)}
        </div>
      ))}
    </>
  )
}

export default function Labels({ wh }: { wh: Warehouse }) {
  const { products, settings } = wh.data
  const [q, setQ] = useState('')
  const [onlyMissing, setOnlyMissing] = useState(false)
  const [copies, setCopies] = useState<Record<string, number>>({})
  const [formatKey, setFormatKey] = useState(() => localStorage.getItem('ombor-label-format') ?? 't58x40')
  const [showPrice, setShowPrice] = useState(true)
  const [showShop, setShowShop] = useState(false)
  const [printing, setPrinting] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const admin = useIsAdmin()
  const format = LABEL_FORMATS.find((f) => f.key === formatKey) ?? LABEL_FORMATS[0]

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return products
      .filter((p) => !onlyMissing || !p.barcode)
      .filter((p) => !s || p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s) || p.barcode.includes(s))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [products, q, onlyMissing])

  const selected = products.filter((p) => (copies[p.id] ?? 0) > 0)
  const missing = selected.filter((p) => !p.barcode)
  const printable = selected.filter((p) => p.barcode)
  const items = printable.flatMap((p) => Array.from({ length: Math.min(copies[p.id], 500) }, () => p))
  const missingTotal = products.filter((p) => !p.barcode).length

  const toggle = (p: Product, on: boolean) => setCopies((c) => ({ ...c, [p.id]: on ? Math.max(1, c[p.id] ?? 1) : 0 }))
  const allOn = list.length > 0 && list.every((p) => (copies[p.id] ?? 0) > 0)
  const toggleAll = (on: boolean) => setCopies((c) => {
    const next = { ...c }
    for (const p of list) next[p.id] = on ? Math.max(1, c[p.id] ?? 1) : 0
    return next
  })

  const generate = async (ids?: string[]) => {
    const r = await attempt(() => wh.generateBarcodes(ids))
    setMsg(r.ok ? { ok: true, text: `${r.value.count} ta tovarga shtrix-kod yaratildi` } : { ok: false, text: r.error })
  }

  const print = () => {
    localStorage.setItem('ombor-label-format', format.key)
    const style = document.createElement('style')
    style.id = 'label-page-style'
    style.textContent = format.sheet
      ? '@page { size: A4; margin: 0; }'
      : `@page { size: ${format.width}mm ${format.height}mm; margin: 0; }`
    document.head.appendChild(style)
    setPrinting(true)
    printLabels(() => setPrinting(false))
  }

  return (
    <>
      <PageHeader title="Shtrix-kod etiketkalari" subtitle="Shtrix-kodi yo'q tovarlarga kod yaratib, etiketka chop eting" />

      {missingTotal > 0 && admin && (
        <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" startIcon={<AutoIcon />} onClick={() => generate()}>Hammasiga yaratish</Button>}>
          {missingTotal} ta tovarda shtrix-kod yo'q.
        </Alert>
      )}
      {msg && <Alert severity={msg.ok ? 'success' : 'error'} sx={{ mb: 2 }} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="flex-start">
        <Paper variant="outlined" sx={{ flex: 1, width: '100%', minWidth: 0 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ p: 2 }} alignItems={{ sm: 'center' }}>
            <TextField size="small" placeholder="Qidirish" value={q} onChange={(e) => setQ(e.target.value)} sx={{ minWidth: 240 }}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }} />
            <FormControlLabel control={<Switch checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />} label="Faqat kodi yo'qlar" />
          </Stack>
          <TableContainer sx={{ maxHeight: 620 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox"><Checkbox checked={allOn} onChange={(e) => toggleAll(e.target.checked)} /></TableCell>
                  <TableCell>Tovar</TableCell>
                  <TableCell>Shtrix-kod</TableCell>
                  <TableCell align="right">Narx</TableCell>
                  <TableCell align="right">Qoldiq</TableCell>
                  <TableCell align="center">Nechta</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {list.map((p) => {
                  const n = copies[p.id] ?? 0
                  return (
                    <TableRow key={p.id} hover selected={n > 0}>
                      <TableCell padding="checkbox"><Checkbox checked={n > 0} onChange={(e) => toggle(p, e.target.checked)} /></TableCell>
                      <TableCell sx={{ fontWeight: 500 }}>{p.name}</TableCell>
                      <TableCell>
                        {p.barcode ? <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{p.barcode}</Typography> : admin ? (
                          <Button size="small" startIcon={<AutoIcon />} onClick={() => generate([p.id])}>Yaratish</Button>
                        ) : <Typography variant="body2" color="text.secondary">yo'q</Typography>}
                      </TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{fmtMoney(p.sellPrice)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{fmtNum(p.qty)} {p.unit}</TableCell>
                      <TableCell align="center">
                        <TextField size="small" value={n || ''} placeholder="0" inputMode="numeric" sx={{ width: 72 }}
                          onChange={(e) => { const v = parseInt(e.target.value.replace(/\D/g, '') || '0', 10); setCopies((c) => ({ ...c, [p.id]: v })) }}
                          slotProps={{ htmlInput: { style: { textAlign: 'center' } } }} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Card sx={{ p: 2.5, width: { xs: '100%', lg: 380 }, flexShrink: 0, position: { lg: 'sticky' }, top: { lg: 88 } }}>
          <Stack spacing={2}>
            <TextField select size="small" label="Etiketka o'lchami" value={format.key} onChange={(e) => setFormatKey(e.target.value)}>
              {LABEL_FORMATS.map((f) => <MenuItem key={f.key} value={f.key}>{f.label}</MenuItem>)}
            </TextField>
            <Stack direction="row" flexWrap="wrap">
              <FormControlLabel control={<Switch size="small" checked={showPrice} onChange={(e) => setShowPrice(e.target.checked)} />} label="Narx" />
              <FormControlLabel control={<Switch size="small" checked={showShop} onChange={(e) => setShowShop(e.target.checked)} />} label="Do'kon nomi" />
            </Stack>

            <Typography variant="body2" color="text.secondary">Namuna:</Typography>
            <Box className="labels-preview" sx={{ bgcolor: '#eef0f3', borderRadius: 2, p: 2, display: 'grid', placeItems: 'center', minHeight: 140, overflow: 'auto' }}>
              {printable[0] ? (
                <Label product={printable[0]} format={format} showPrice={showPrice} shopName={showShop ? settings.shopName : undefined} />
              ) : <Typography variant="body2" color="text.secondary">Chapdan tovar tanlang</Typography>}
            </Box>

            {missing.length > 0 && (
              <Alert severity="warning" action={admin ? <Button color="inherit" size="small" onClick={() => generate(missing.map((p) => p.id))}>Yaratish</Button> : undefined}>
                {missing.length} ta tanlangan tovarda kod yo'q — ular chop etilmaydi.
              </Alert>
            )}
            <Stack direction="row" justifyContent="space-between">
              <Typography color="text.secondary">Jami etiketka</Typography>
              <Typography sx={{ fontWeight: 700 }}>
                {items.length}{format.sheet ? ` (${Math.ceil(items.length / (format.sheet.cols * format.sheet.rows))} varaq)` : ''}
              </Typography>
            </Stack>
            <Button variant="contained" size="large" startIcon={<PrintIcon />} disabled={!items.length || printing} onClick={print}>
              Chop etish
            </Button>
            {selected.length > 0 && <Button color="inherit" onClick={() => setCopies({})}>Tanlovni tozalash</Button>}
            <Typography variant="caption" color="text.secondary">
              Chop etish oynasida printeringizni tanlang, "Masshtab" 100% va "Chekkalar" — "Yo'q" bo'lsin.
            </Typography>
          </Stack>
        </Card>
      </Stack>

      {printing && createPortal(
        <LabelSheets items={items} format={format} showPrice={showPrice} shopName={showShop ? settings.shopName : undefined} />,
        document.getElementById('print-root')!,
      )}
    </>
  )
}
