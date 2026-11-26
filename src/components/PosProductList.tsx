import { useDeferredValue, useMemo, useState } from 'react'
import {
  Box, Button, ButtonBase, Card, Chip, IconButton, InputAdornment, MenuItem, Stack, TextField, Typography, alpha,
} from '@mui/material'
import ListIcon from '@mui/icons-material/ListAltRounded'
import ExpandIcon from '@mui/icons-material/ExpandMore'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import ClearIcon from '@mui/icons-material/Close'
import type { Product } from '../types'
import { fmtMoney, fmtNum } from '../utils'
import { GREEN } from '../theme'
import { t as tr } from '../i18n'

const PAGE = 60

/**
 * Kassadagi tovarlar ro'yxati (tezkor panel ostida): qidirib, kategoriya bo'yicha ko'rib,
 * bosib savatga qo'shish. Savatdagi soni ham ko'rinadi.
 */
export default function PosProductList({ products, cart, onAdd, onRemoveOne }: {
  products: Product[]
  cart: Map<string, { qty: number; price: number }>
  onAdd: (p: Product) => void
  onRemoveOne: (p: Product) => void
}) {
  const [open, setOpen] = useState(() => localStorage.getItem('ombor-poslist-open') !== '0')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [inStock, setInStock] = useState(() => localStorage.getItem('ombor-poslist-stock') === '1')
  const [limit, setLimit] = useState(PAGE)
  const dq = useDeferredValue(q)

  const toggle = () => { setOpen(!open); localStorage.setItem('ombor-poslist-open', open ? '0' : '1') }
  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [products])
  const sorted = useMemo(() => [...products].sort((a, b) => a.name.localeCompare(b.name)), [products])

  const list = useMemo(() => {
    const s = dq.trim().toLowerCase()
    let r = sorted
    if (cat) r = r.filter((p) => p.category === cat)
    if (inStock) r = r.filter((p) => p.qty > 0)
    if (s) {
      // Artikul yoki shtrix-kod aynan mos kelsa — faqat o'sha tovar
      const exact = r.filter((p) => p.sku.toLowerCase() === s || p.barcode.toLowerCase() === s)
      r = exact.length ? exact : r.filter((p) => p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s) || p.barcode.includes(s))
    }
    return r
  }, [sorted, dq, cat, inStock])

  const shown = list.slice(0, limit)

  return (
    <Card sx={{ p: 1.5 }} className="no-print">
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: open ? 1.25 : 0 }}>
        <ButtonBase onClick={toggle} sx={{ borderRadius: 2, px: 0.5, py: 0.25, gap: 0.75, flexGrow: 1, justifyContent: 'flex-start' }}>
          <ListIcon sx={{ color: GREEN }} />
          <Typography sx={{ fontWeight: 800 }}>{tr("Tovarlar ro'yxati")}</Typography>
          <Typography variant="body2" color="text.secondary">({fmtNum(list.length)})</Typography>
          <ExpandIcon sx={{ fontSize: 20, color: 'text.secondary', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
        </ButtonBase>
      </Stack>
      {open && (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1 }}>
            <TextField size="small" fullWidth value={q} placeholder={tr("Nomi, artikul yoki shtrix-kod")}
              onChange={(e) => { setQ(e.target.value); setLimit(PAGE) }}
              slotProps={{ input: {
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                endAdornment: q ? <IconButton size="small" onClick={() => setQ('')}><ClearIcon fontSize="small" /></IconButton> : undefined,
              } }} />
            <TextField select size="small" value={cat} onChange={(e) => { setCat(e.target.value); setLimit(PAGE) }} sx={{ minWidth: { sm: 220 } }}
              slotProps={{ select: { displayEmpty: true, MenuProps: { slotProps: { paper: { sx: { maxHeight: 420 } } } } } }}>
              <MenuItem value="">{tr("Barcha kategoriyalar")}</MenuItem>
              {categories.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
            <Chip label={tr("Faqat bori")} color={inStock ? 'primary' : 'default'} variant={inStock ? 'filled' : 'outlined'}
              onClick={() => { setInStock(!inStock); localStorage.setItem('ombor-poslist-stock', inStock ? '0' : '1'); setLimit(PAGE) }}
              sx={{ alignSelf: 'center', height: 36, borderRadius: 2, fontWeight: 600 }} />
          </Stack>
          <Box sx={{ maxHeight: 420, overflowY: 'auto', border: 1, borderColor: 'divider', borderRadius: 2 }}>
            {shown.length === 0 && <Typography color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>{tr("Tovar topilmadi")}</Typography>}
            {shown.map((p) => {
              const inC = cart.get(p.id)?.qty ?? 0
              const out = p.qty <= 0
              return (
                <Stack key={p.id} direction="row" alignItems="center" spacing={1}
                  sx={{
                    px: 1.25, py: 0.75, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 },
                    bgcolor: inC ? alpha(GREEN, 0.08) : undefined, opacity: out ? 0.5 : 1,
                  }}>
                  <ButtonBase onClick={() => onAdd(p)} disabled={out}
                    sx={{ flex: 1, minWidth: 0, justifyContent: 'flex-start', textAlign: 'left', borderRadius: 1, py: 0.25 }}>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography sx={{ fontWeight: 600, fontSize: 14, lineHeight: 1.25, overflowWrap: 'anywhere' }}>{p.name}</Typography>
                      <Typography variant="caption" color={out ? 'error' : 'text.secondary'}>
                        {p.sku && <>{p.sku} · </>}{out ? tr("qolmagan") : tr('{0} {1} bor', fmtNum(p.qty), tr(p.unit))}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontWeight: 800, whiteSpace: 'nowrap', ml: 1, fontSize: 14 }}>{fmtMoney(p.sellPrice)}</Typography>
                  </ButtonBase>
                  {inC > 0 && (
                    <>
                      <IconButton size="small" aria-label={tr("Bittaga kamaytirish")} onClick={() => onRemoveOne(p)} sx={{ border: 1, borderColor: 'divider' }}><RemoveIcon fontSize="small" /></IconButton>
                      <Box sx={{ minWidth: 28, textAlign: 'center', fontWeight: 800, color: GREEN }}>{fmtNum(inC)}</Box>
                    </>
                  )}
                  <IconButton size="small" aria-label={tr("Savatga qo'shish")} color="primary" disabled={out || inC >= p.qty} onClick={() => onAdd(p)}
                    sx={{ border: 1, borderColor: out || inC >= p.qty ? 'divider' : 'primary.main' }}><AddIcon fontSize="small" /></IconButton>
                </Stack>
              )
            })}
            {list.length > limit && (
              <Box sx={{ p: 1, textAlign: 'center' }}>
                <Button size="small" onClick={() => setLimit(limit + PAGE * 2)}>{tr("Yana ko'rsatish ({0} ta qoldi)", fmtNum(list.length - limit))}</Button>
              </Box>
            )}
          </Box>
        </>
      )}
    </Card>
  )
}
