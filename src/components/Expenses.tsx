import { useMemo, useState } from 'react'
import {
  Button, Card, Chip, IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Tooltip, Typography,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/DeleteOutline'
import DownloadIcon from '@mui/icons-material/FileDownloadOutlined'
import MoneyOffIcon from '@mui/icons-material/MoneyOffOutlined'
import TrendIcon from '@mui/icons-material/TrendingUp'
import BalanceIcon from '@mui/icons-material/AccountBalanceOutlined'
import ReceiptIcon from '@mui/icons-material/ReceiptLongOutlined'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip as ChartTooltip } from 'recharts'
import type { Warehouse } from '../store'
import type { Expense } from '../types'
import { paymentLabel } from '../types'
import { download, fmtDate, fmtMoney, toCsv } from '../utils'
import { expenseInRange, inRange, profitOf, quarter } from '../stats'
import PeriodPicker from './PeriodPicker'
import PageHeader from './PageHeader'
import StatCard from './StatCard'
import ChartCard from './ChartCard'
import ExpenseDialog from './ExpenseDialog'
import { PIE_COLORS, useChartStyle } from './charts'

export default function Expenses({ wh }: { wh: Warehouse }) {
  const { expenses, movements, products } = wh.data
  const cs = useChartStyle()
  const [from, setFrom] = useState(() => quarter(0).from)
  const [to, setTo] = useState(() => quarter(0).to)
  const [cat, setCat] = useState('')
  const [open, setOpen] = useState(false)

  const inPeriod = useMemo(() => expenses.filter((e) => expenseInRange(e, from, to)), [expenses, from, to])
  const list = useMemo(() => inPeriod.filter((e) => !cat || e.category === cat), [inPeriod, cat])
  const total = list.reduce((s, e) => s + e.amount, 0)
  const periodTotal = inPeriod.reduce((s, e) => s + e.amount, 0)
  const profit = useMemo(
    () => movements.filter((m) => m.type === 'out' && inRange(m, from, to)).reduce((s, m) => s + profitOf(m, products), 0),
    [movements, products, from, to],
  )
  const net = profit - periodTotal
  const byCat = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of inPeriod) map.set(e.category, (map.get(e.category) ?? 0) + e.amount)
    return [...map].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [inPeriod])

  const remove = (e: Expense) => {
    if (confirm(`"${e.category} — ${fmtMoney(e.amount)}" xarajati o'chirilsinmi?`)) wh.deleteExpense(e.id).catch((x) => alert(x.message))
  }

  const exportCsv = () => {
    const rows: (string | number)[][] = [['Sana', 'Turi', 'Summa', "To'lov", 'Izoh', 'Kiritdi']]
    list.forEach((e) => rows.push([fmtDate(e.date), e.category, e.amount, paymentLabel(e.payment), e.note, e.seller ?? '']))
    rows.push([], ['Jami', '', total])
    download(`xarajatlar-${from}_${to}.csv`, toCsv(rows), 'text/csv;charset=utf-8')
  }

  return (
    <>
      <PageHeader title="Xarajatlar" subtitle="Ijara, ish haqi, kommunal va boshqa chiqimlar" actions={<>
        <PeriodPicker from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv}>Excel</Button>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)}>Yangi xarajat</Button>
      </>} />

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><StatCard icon={<MoneyOffIcon />} title="Jami xarajat" value={fmtMoney(periodTotal)} color="#E5533D" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><StatCard icon={<TrendIcon />} title="Savdodan foyda" value={fmtMoney(profit)} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <StatCard icon={<BalanceIcon />} title="Sof foyda" value={fmtMoney(net)} color={net >= 0 ? '#2E9E5B' : '#E5533D'} valueColor={net >= 0 ? 'primary.main' : 'error.main'} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><StatCard icon={<ReceiptIcon />} title="Xarajatlar soni" value={String(inPeriod.length)} color="#C9A227" /></Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <ChartCard title="Turlari bo'yicha" height={340}>
            {byCat.length === 0 ? (
              <Typography color="text.secondary">Tanlangan davrda xarajat yo'q</Typography>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={byCat} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="78%" paddingAngle={2}
                    onClick={(d) => setCat((c) => (c === d.name ? '' : String(d.name)))} style={{ cursor: 'pointer' }}>
                    {byCat.map((c, i) => (
                      <Cell key={c.name} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" opacity={!cat || cat === c.name ? 1 : 0.35} />
                    ))}
                  </Pie>
                  <ChartTooltip {...cs.tooltip} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card sx={{ height: '100%' }}>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ flexGrow: 1 }}>Ro'yxat</Typography>
              <TextField size="small" select label="Turi" value={cat} onChange={(e) => setCat(e.target.value)} sx={{ minWidth: 200 }}>
                <MenuItem value="">Barchasi</MenuItem>
                {byCat.map((c) => <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>)}
              </TextField>
            </Stack>
            <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 0 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Sana</TableCell>
                    <TableCell>Turi</TableCell>
                    <TableCell>Izoh</TableCell>
                    <TableCell>To'lov</TableCell>
                    <TableCell align="right">Summa</TableCell>
                    <TableCell className="no-print" />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {list.map((e) => (
                    <TableRow key={e.id} hover>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{fmtDate(e.date)}</TableCell>
                      <TableCell><Chip size="small" variant="outlined" label={e.category} /></TableCell>
                      <TableCell>
                        {e.note}
                        {e.seller && <Typography variant="caption" display="block" color="text.secondary">{e.seller}</Typography>}
                      </TableCell>
                      <TableCell>{paymentLabel(e.payment)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, whiteSpace: 'nowrap', color: 'error.main' }}>−{fmtMoney(e.amount)}</TableCell>
                      <TableCell className="no-print">
                        <Tooltip title="O'chirish"><IconButton size="small" onClick={() => remove(e)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {list.length === 0 && (
                    <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5, color: 'text.secondary' }}>Xarajat yo'q</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            {cat && (
              <Typography sx={{ p: 2 }} color="text.secondary">
                {cat}: <b>{fmtMoney(total)}</b>
              </Typography>
            )}
          </Card>
        </Grid>
      </Grid>

      {open && <ExpenseDialog wh={wh} onClose={() => setOpen(false)} />}
    </>
  )
}
