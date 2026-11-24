import { useMemo, useState } from 'react'
import {
  Alert, Button, Chip, IconButton, InputAdornment, Paper, Snackbar, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Tooltip, Typography,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/PersonAddAlt1Outlined'
import CartIcon from '@mui/icons-material/AddShoppingCartOutlined'
import PayIcon from '@mui/icons-material/PaymentsOutlined'
import DeleteIcon from '@mui/icons-material/DeleteOutline'
import DownloadIcon from '@mui/icons-material/FileDownloadOutlined'
import PeopleIcon from '@mui/icons-material/PeopleAltOutlined'
import DebtIcon from '@mui/icons-material/MenuBookOutlined'
import WalletIcon from '@mui/icons-material/AccountBalanceWalletOutlined'
import type { Warehouse } from '../store'
import type { Customer } from '../types'
import { useIsAdmin } from '../auth'
import { download, fmtDate, fmtMoney, toCsv } from '../utils'
import PageHeader from './PageHeader'
import StatCard from './StatCard'
import CustomerDialog from './CustomerDialog'
import CustomerCard from './CustomerCard'
import DebtDialog from './DebtDialog'

interface Props { wh: Warehouse; debtorsOnly?: boolean; onSell: (c: Customer) => void }

export const matchCustomer = (c: Customer, q: string) => {
  const s = q.trim().toLowerCase()
  if (!s) return true
  const digits = s.replace(/\D/g, '')
  return c.name.toLowerCase().includes(s) || (digits.length >= 3 && c.phone.replace(/\D/g, '').includes(digits))
}

export default function Customers({ wh, debtorsOnly, onSell }: Props) {
  const { customers, customerTx } = wh.data
  const admin = useIsAdmin()
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Customer | 'new' | null>(null)
  const [open, setOpen] = useState<Customer | null>(null)
  const [debt, setDebt] = useState<{ c: Customer; type: 'pay' | 'debt' } | null>(null)
  const [toast, setToast] = useState('')

  const list = useMemo(() => customers
    .filter((c) => !debtorsOnly || c.debt > 0)
    .filter((c) => matchCustomer(c, q))
    .sort((a, b) => (debtorsOnly ? b.debt - a.debt : (b.lastDate ?? '').localeCompare(a.lastDate ?? '') || a.name.localeCompare(b.name))),
  [customers, debtorsOnly, q])

  const debtors = customers.filter((c) => c.debt > 0)
  const totalDebt = debtors.reduce((s, c) => s + c.debt, 0)
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
  const paidMonth = customerTx.filter((t) => t.type === 'pay' && new Date(t.date) >= monthStart).reduce((s, t) => s + t.amount, 0)

  const remove = (c: Customer) => {
    if (confirm(`"${c.name}" mijozlar ro'yxatidan o'chirilsinmi? Savdolar tarixda qoladi.`)) wh.deleteCustomer(c.id).catch((e) => alert(e.message))
  }
  const exportCsv = () => {
    const rows: (string | number)[][] = [['Mijoz', 'Telefon', 'Qarzi', 'Jami xaridlari', 'Cheklar', 'Oxirgi xarid', 'Izoh']]
    list.forEach((c) => rows.push([c.name, c.phone, c.debt, c.bought, c.receipts, c.lastDate ? fmtDate(c.lastDate) : '', c.note]))
    rows.push([], ['Jami qarz', '', list.reduce((s, c) => s + Math.max(0, c.debt), 0)])
    download(`${debtorsOnly ? 'qarzdorlar' : 'mijozlar'}-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows), 'text/csv;charset=utf-8')
  }

  return (
    <Stack spacing={2}>
      <PageHeader
        title={debtorsOnly ? 'Qarzdorlar' : 'Mijozlar'}
        subtitle={debtorsOnly ? "Nasiyaga olgan mijozlar — qarz to'languncha shu yerda turadi" : "Doimiy mijozlar bazasi: tez toping, xaridini yozing, qarzini kuzating"}
        actions={<>
          {admin && <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv}>Excel</Button>}
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>Yangi mijoz</Button>
        </>} />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}><StatCard icon={<DebtIcon />} title="Jami qarz" value={fmtMoney(totalDebt)} color="#E5533D" valueColor={totalDebt > 0 ? 'error.main' : undefined} /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><StatCard icon={<PeopleIcon />} title={debtorsOnly ? 'Qarzdorlar soni' : 'Mijozlar soni'} value={`${debtorsOnly ? debtors.length : customers.length} ta`} color="#3B82F6" /></Grid>
        <Grid size={{ xs: 12, sm: 4 }}><StatCard icon={<WalletIcon />} title="Shu oy qarzdan tushgan" value={fmtMoney(paidMonth)} /></Grid>
      </Grid>

      <Paper variant="outlined">
        <Stack direction="row" sx={{ p: 2 }}>
          <TextField size="small" placeholder="Qidirish: ism yoki telefon" value={q} onChange={(e) => setQ(e.target.value)} sx={{ minWidth: { sm: 320 } }} fullWidth
            autoFocus slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }} />
        </Stack>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Mijoz</TableCell>
                <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Telefon</TableCell>
                <TableCell align="right">Qarzi</TableCell>
                <TableCell align="right" sx={{ display: { xs: 'none', md: 'table-cell' } }}>Jami xaridlari</TableCell>
                <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Oxirgi xarid</TableCell>
                <TableCell align="center" sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Amallar</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {list.map((c) => (
                <TableRow key={c.id} hover sx={{ cursor: 'pointer' }} onClick={() => setOpen(c)}>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {c.name}
                    {c.phone && <Typography variant="caption" display={{ xs: 'block', sm: 'none' }} color="text.secondary">{c.phone}</Typography>}
                    {c.note && <Typography variant="caption" display="block" color="text.secondary" noWrap sx={{ maxWidth: 260 }}>{c.note}</Typography>}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', display: { xs: 'none', sm: 'table-cell' } }}>{c.phone}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {c.debt > 0 ? <Chip size="small" color="error" variant="outlined" label={fmtMoney(c.debt)} sx={{ fontWeight: 700 }} />
                      : c.debt < 0 ? <Chip size="small" color="success" variant="outlined" label={`+${fmtMoney(-c.debt)}`} />
                        : <Typography variant="body2" color="text.secondary">—</Typography>}
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap', display: { xs: 'none', md: 'table-cell' } }}>{fmtMoney(c.bought)}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', display: { xs: 'none', md: 'table-cell' } }}>{c.lastDate ? fmtDate(c.lastDate) : '—'}</TableCell>
                  <TableCell align="center" sx={{ whiteSpace: 'nowrap', display: { xs: 'none', sm: 'table-cell' } }} onClick={(e) => e.stopPropagation()}>
                    <Tooltip title="Shu mijozga sotish"><IconButton size="small" color="primary" onClick={() => onSell(c)}><CartIcon /></IconButton></Tooltip>
                    <Tooltip title="Qarz to'lovini qabul qilish"><IconButton size="small" onClick={() => setDebt({ c, type: 'pay' })}><PayIcon /></IconButton></Tooltip>
                    {admin && <Tooltip title="O'chirish"><IconButton size="small" color="error" onClick={() => remove(c)}><DeleteIcon /></IconButton></Tooltip>}
                  </TableCell>
                </TableRow>
              ))}
              {list.length === 0 && (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                  {debtorsOnly ? "Qarzdor mijoz yo'q 👍" : q ? 'Topilmadi' : "Hali mijoz yo'q — «Yangi mijoz» ni bosing"}
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {editing && <CustomerDialog wh={wh} customer={editing === 'new' ? undefined : editing} initialName={editing === 'new' ? q : undefined}
        onClose={() => setEditing(null)} onSaved={(c) => setToast(`Saqlandi: ${c.name}`)} />}
      {open && <CustomerCard wh={wh} customer={open} onClose={() => setOpen(null)} onSell={onSell}
        onPay={(c, type) => setDebt({ c, type })} onEdit={(c) => setEditing(c)} />}
      {debt && <DebtDialog wh={wh} customer={debt.c} type={debt.type} onClose={() => setDebt(null)} onDone={setToast} />}
      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast('')} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" onClose={() => setToast('')}>{toast}</Alert>
      </Snackbar>
    </Stack>
  )
}
