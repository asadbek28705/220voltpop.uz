import { useMemo, useState } from 'react'
import {
  Alert, Autocomplete, Box, Button, ButtonBase, Card, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, List, ListItem,
  ListItemButton, ListItemText, Stack, TextField, Tooltip, Typography, alpha, useMediaQuery, useTheme,
} from '@mui/material'
import BoltIcon from '@mui/icons-material/BoltRounded'
import BackIcon from '@mui/icons-material/ArrowBackRounded'
import EditIcon from '@mui/icons-material/EditOutlined'
import FolderIcon from '@mui/icons-material/FolderOutlined'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/DeleteOutline'
import UpIcon from '@mui/icons-material/KeyboardArrowUp'
import DownIcon from '@mui/icons-material/KeyboardArrowDown'
import ExpandIcon from '@mui/icons-material/ExpandMore'
import type { Warehouse } from '../store'
import type { Product, QuickGroup } from '../types'
import { attempt } from '../api'
import { fmtMoney, fmtNum } from '../utils'
import { GREEN } from '../theme'
import { t as tr } from '../i18n'

const uid = () => Math.random().toString(36).slice(2, 10)
const match = (p: Product, q: string) => {
  const s = q.trim().toLowerCase()
  return !!s && (p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s) || p.barcode.includes(s))
}

/**
 * Kassadagi tezkor panel: guruh tugmalari → bosilsa guruhdagi tovar tugmalari.
 * Bir xil tovarning har xil o'lchamlarini (masalan H/P 25 fitinglari) tez urish uchun.
 */
export default function QuickPanel({ wh, admin, onAdd }: { wh: Warehouse; admin: boolean; onAdd: (p: Product) => void }) {
  const groups = wh.data.settings.quickPanel ?? []
  const [open, setOpen] = useState(() => localStorage.getItem('ombor-quick-open') !== '0')
  const [groupId, setGroupId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const byId = useMemo(() => new Map(wh.data.products.map((p) => [p.id, p])), [wh.data.products])
  const group = groups.find((g) => g.id === groupId) ?? null
  const items = group ? group.productIds.map((id) => byId.get(id)).filter((p): p is Product => !!p) : []

  if (!groups.length && !admin) return null
  const toggle = () => { setOpen(!open); localStorage.setItem('ombor-quick-open', open ? '0' : '1') }

  const tile = {
    minHeight: 64, p: 1, borderRadius: '12px', border: 1, borderColor: 'divider', bgcolor: 'background.paper', textAlign: 'center',
    fontSize: 13, fontWeight: 700, lineHeight: 1.2, flexDirection: 'column', gap: 0.25, transition: 'all .12s',
    '&:hover': { borderColor: GREEN, bgcolor: alpha(GREEN, 0.06) }, '&:active': { transform: 'scale(.97)' },
  } as const

  return (
    <Card sx={{ p: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: open ? 1.25 : 0 }}>
        <ButtonBase onClick={toggle} sx={{ borderRadius: 2, px: 0.5, py: 0.25, gap: 0.75, flexGrow: 1, justifyContent: 'flex-start' }}>
          <BoltIcon sx={{ color: '#F2B705' }} />
          <Typography sx={{ fontWeight: 800 }}>{group ? group.name : tr("Tezkor panel")}</Typography>
          <ExpandIcon sx={{ fontSize: 20, color: 'text.secondary', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
        </ButtonBase>
        {admin && <Tooltip title={tr("Panelni sozlash")}><IconButton size="small" onClick={() => setEditing(true)}><EditIcon fontSize="small" /></IconButton></Tooltip>}
      </Stack>
      {open && (
        groups.length === 0 ? (
          <Alert severity="info" action={<Button color="inherit" size="small" onClick={() => setEditing(true)}>{tr("Sozlash")}</Button>}>
            {tr("Tez-tez sotiladigan tovarlarni guruhlab, tugma qilib qo'ying — kassada bir bosishda savatga tushadi.")}
          </Alert>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))', gap: 0.75 }}>
            {group ? <>
              <ButtonBase onClick={() => setGroupId(null)} sx={{ ...tile, bgcolor: alpha(GREEN, 0.1), borderColor: alpha(GREEN, 0.35), color: 'primary.dark' }}>
                <BackIcon fontSize="small" />{tr("Orqaga")}
              </ButtonBase>
              {items.map((p) => (
                <ButtonBase key={p.id} onClick={() => onAdd(p)} disabled={p.qty <= 0}
                  sx={{ ...tile, opacity: p.qty <= 0 ? 0.45 : 1 }}>
                  <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.name}</span>
                  <Typography component="span" sx={{ fontSize: 12, fontWeight: 800, color: 'primary.main' }}>{fmtMoney(p.sellPrice)}</Typography>
                  {p.qty <= 0 && <Typography component="span" sx={{ fontSize: 10.5, color: 'error.main' }}>{tr("qolmagan")}</Typography>}
                </ButtonBase>
              ))}
              {items.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>{tr("Guruh bo'sh")}</Typography>}
            </> : groups.map((g) => (
              <ButtonBase key={g.id} onClick={() => setGroupId(g.id)} sx={{ ...tile, bgcolor: alpha('#F2B705', 0.08), borderColor: alpha('#F2B705', 0.35) }}>
                <FolderIcon fontSize="small" sx={{ color: '#C98E00' }} />
                <span>{g.name}</span>
                <Typography component="span" sx={{ fontSize: 11, color: 'text.secondary', fontWeight: 600 }}>{tr("{0} ta", g.productIds.length)}</Typography>
              </ButtonBase>
            ))}
          </Box>
        )
      )}
      {editing && <QuickPanelEditor wh={wh} onClose={() => setEditing(false)} />}
    </Card>
  )
}

/** Admin: guruhlarni yaratish, tovar qo'shish (qidirib bittalab yoki «Hammasini qo'shish»), tartibini o'zgartirish */
function QuickPanelEditor({ wh, onClose }: { wh: Warehouse; onClose: () => void }) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down('sm'))
  const [groups, setGroups] = useState<QuickGroup[]>(() => structuredClone(wh.data.settings.quickPanel ?? []))
  const [sel, setSel] = useState<string | null>(groups[0]?.id ?? null)
  const [q, setQ] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const byId = useMemo(() => new Map(wh.data.products.map((p) => [p.id, p])), [wh.data.products])
  const g = groups.find((x) => x.id === sel) ?? null
  const found = useMemo(() => (q.trim() ? wh.data.products.filter((p) => match(p, q)).slice(0, 100) : []), [wh.data.products, q])

  const patch = (fn: (g: QuickGroup) => QuickGroup) => setGroups((list) => list.map((x) => (x.id === sel ? fn(x) : x)))
  const addIds = (ids: string[]) => patch((x) => ({ ...x, productIds: [...x.productIds, ...ids.filter((id) => !x.productIds.includes(id))] }))
  const move = <T,>(arr: T[], i: number, d: number) => { const a = [...arr]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a }

  const newGroup = () => {
    const name = prompt(tr("Guruh nomi (masalan: H/P 25)"))?.trim()
    if (!name) return
    const x = { id: uid(), name, productIds: [] }
    setGroups([...groups, x]); setSel(x.id); setQ(name)
  }

  const save = async () => {
    setBusy(true)
    const r = await attempt(() => wh.saveSettings({ quickPanel: groups }))
    setBusy(false)
    if (!r.ok) return setErr(r.error)
    onClose()
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" fullScreen={fullScreen}>
      <DialogTitle>{tr("Tezkor panelni sozlash")}</DialogTitle>
      <DialogContent>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mt: 0.5 }}>
          {/* Guruhlar */}
          <Box sx={{ width: { md: 240 }, flexShrink: 0 }}>
            <Button fullWidth variant="outlined" startIcon={<AddIcon />} onClick={newGroup} sx={{ mb: 1 }}>{tr("Yangi guruh")}</Button>
            <List dense disablePadding sx={{ maxHeight: { md: 420 }, overflowY: 'auto' }}>
              {groups.map((x, i) => (
                <ListItem key={x.id} disablePadding secondaryAction={
                  <Stack direction="row">
                    <IconButton size="small" onClick={() => setGroups(move(groups, i, -1))}><UpIcon fontSize="small" /></IconButton>
                    <IconButton size="small" onClick={() => setGroups(move(groups, i, 1))}><DownIcon fontSize="small" /></IconButton>
                  </Stack>
                }>
                  <ListItemButton selected={x.id === sel} onClick={() => { setSel(x.id); setQ('') }} sx={{ pr: 9 }}>
                    <ListItemText primary={x.name} secondary={tr("{0} ta", x.productIds.length)} />
                  </ListItemButton>
                </ListItem>
              ))}
              {groups.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>{tr("Hali guruh yo'q")}</Typography>}
            </List>
          </Box>

          {/* Tanlangan guruh */}
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            {!g ? <Typography color="text.secondary">{tr("Chapdan guruh tanlang yoki yangi guruh yarating")}</Typography> : (
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1}>
                  <TextField size="small" fullWidth label={tr("Guruh nomi")} value={g.name} onChange={(e) => patch((x) => ({ ...x, name: e.target.value }))} />
                  <Button color="error" startIcon={<DeleteIcon />} onClick={() => { if (confirm(tr("«{0}» guruhi o'chirilsinmi?", g.name))) { setGroups(groups.filter((x) => x.id !== g.id)); setSel(null) } }}>
                    {tr("O'chirish")}
                  </Button>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <Autocomplete<Product> fullWidth size="small" options={found} inputValue={q} value={null} filterOptions={(x) => x}
                    onInputChange={(_, v, reason) => reason !== 'reset' && setQ(v)}
                    onChange={(_, v) => { if (v) addIds([v.id]) }}
                    getOptionLabel={(p) => p.name}
                    renderOption={(props, p) => <li {...props} key={p.id}><Stack direction="row" justifyContent="space-between" sx={{ width: '100%' }}><span>{p.name}</span><b>{fmtMoney(p.sellPrice)}</b></Stack></li>}
                    renderInput={(params) => <TextField {...params} label={tr("Tovar qidirish")} placeholder={tr("Masalan: H/P 25")} />} />
                  <Button variant="contained" disabled={!found.length} onClick={() => addIds(found.map((p) => p.id))} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {tr("Hammasini qo'shish ({0})", found.length)}
                  </Button>
                </Stack>
                <List dense disablePadding sx={{ border: 1, borderColor: 'divider', borderRadius: 2, maxHeight: 360, overflowY: 'auto' }}>
                  {g.productIds.map((id, i) => {
                    const p = byId.get(id)
                    return (
                      <ListItem key={id} divider secondaryAction={
                        <Stack direction="row">
                          <IconButton size="small" onClick={() => patch((x) => ({ ...x, productIds: move(x.productIds, i, -1) }))}><UpIcon fontSize="small" /></IconButton>
                          <IconButton size="small" onClick={() => patch((x) => ({ ...x, productIds: move(x.productIds, i, 1) }))}><DownIcon fontSize="small" /></IconButton>
                          <IconButton size="small" color="error" onClick={() => patch((x) => ({ ...x, productIds: x.productIds.filter((y) => y !== id) }))}><DeleteIcon fontSize="small" /></IconButton>
                        </Stack>
                      }>
                        <ListItemText sx={{ pr: 12 }} primary={p?.name ?? tr("(o'chirilgan tovar)")}
                          secondary={p ? `${fmtMoney(p.sellPrice)} · ${tr("qoldiq")} ${fmtNum(p.qty)}` : ''} />
                      </ListItem>
                    )
                  })}
                  {g.productIds.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>{tr("Yuqoridan tovar qidirib qo'shing")}</Typography>}
                </List>
              </Stack>
            )}
          </Box>
        </Stack>
        {err && <Alert severity="error" sx={{ mt: 2 }}>{err}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{tr("Bekor qilish")}</Button>
        <Button variant="contained" onClick={save} disabled={busy}>{tr("Saqlash")}</Button>
      </DialogActions>
    </Dialog>
  )
}
