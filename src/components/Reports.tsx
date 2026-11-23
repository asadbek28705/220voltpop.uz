import { useMemo, useState } from 'react'
import {
  Button, Card, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material'
import Grid from '@mui/material/Grid'
import CartIcon from '@mui/icons-material/ShoppingCartOutlined'
import TrendIcon from '@mui/icons-material/TrendingUp'
import WalletIcon from '@mui/icons-material/AccountBalanceWalletOutlined'
import InboxIcon from '@mui/icons-material/MoveToInboxOutlined'
import DownloadIcon from '@mui/icons-material/FileDownloadOutlined'
import PrintIcon from '@mui/icons-material/PrintOutlined'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { Warehouse } from '../store'
import { download, fmtMoney, fmtNum, toCsv } from '../utils'
import { MONTHS, dayKey, daysAgo, inRange, profitOf, today } from '../stats'
import { GREEN, YELLOW } from '../theme'
import PageHeader from './PageHeader'
import StatCard from './StatCard'
import ChartCard from './ChartCard'
import { PIE_COLORS, useChartStyle } from './charts'

export default function Reports({ wh }: { wh: Warehouse }) {
  const { movements, products } = wh.data
  const [from, setFrom] = useState(daysAgo(89))
  const [to, setTo] = useState(today())
  const cs = useChartStyle()

  const r = useMemo(() => {
    const sales = movements.filter((m) => m.type === 'out' && inRange(m, from, to))
    const ins = movements.filter((m) => m.type === 'in' && inRange(m, from, to))
    const revenue = sales.reduce((s, m) => s + m.qty * m.price, 0)
    const profit = sales.reduce((s, m) => s + profitOf(m, products), 0)
    const purchased = ins.reduce((s, m) => s + m.qty * m.price, 0)

    // Oylik
    const monthMap = new Map<string, { name: string; Savdo: number; Foyda: number }>()
    // Kunlik — oraliqdagi har bir kun
    const dayMap = new Map<string, { name: string; Savdo: number }>()
    if (from && to && from <= to) {
      const d = new Date(from + 'T00:00:00')
      const end = new Date(to + 'T00:00:00')
      let guard = 0
      while (d <= end && guard++ < 1000) {
        const k = dayKey(d)
        dayMap.set(k, { name: `${k.slice(8)}.${k.slice(5, 7)}`, Savdo: 0 })
        const mk = k.slice(0, 7)
        if (!monthMap.has(mk)) monthMap.set(mk, { name: `${MONTHS[d.getMonth()]} ${d.getFullYear()}`, Savdo: 0, Foyda: 0 })
        d.setDate(d.getDate() + 1)
      }
    }
    const catMap = new Map<string, number>()
    const prodMap = new Map<string, { name: string; qty: number; unit: string; sum: number; profit: number }>()
    for (const m of sales) {
      const k = dayKey(m.date)
      const sum = m.qty * m.price
      const pf = profitOf(m, products)
      const day = dayMap.get(k); if (day) day.Savdo += sum
      const mon = monthMap.get(k.slice(0, 7)); if (mon) { mon.Savdo += sum; mon.Foyda += pf }
      const prod = products.find((p) => p.id === m.productId)
      const cat = prod?.category ?? 'Boshqa'
      catMap.set(cat, (catMap.get(cat) ?? 0) + sum)
      const pr = prodMap.get(m.productId) ?? { name: m.productName, qty: 0, unit: prod?.unit ?? '', sum: 0, profit: 0 }
      pr.qty += m.qty; pr.sum += sum; pr.profit += pf
      prodMap.set(m.productId, pr)
    }
    return {
      revenue, profit, purchased, count: sales.length,
      monthly: [...monthMap.values()],
      daily: [...dayMap.values()],
      categories: [...catMap.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
      top: [...prodMap.values()].sort((a, b) => b.sum - a.sum).slice(0, 10),
    }
  }, [movements, products, from, to])

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ['Hisobot', `${from} — ${to}`], [],
      ['Jami savdo', r.revenue], ['Foyda', r.profit], ['Savdolar soni', r.count], ['Jami kirim', r.purchased], [],
      ['Tovar', 'Sotilgan miqdor', 'Birlik', 'Summa', 'Foyda'],
      ...r.top.map((t) => [t.name, t.qty, t.unit, t.sum, t.profit]),
    ]
    download(`hisobot-${from}_${to}.csv`, toCsv(rows), 'text/csv;charset=utf-8')
  }

  return (
    <>
      <PageHeader title="Hisobotlar" subtitle="Qurilish va santexnika do'koni" actions={<>
        <TextField size="small" type="date" label="Dan" value={from} onChange={(e) => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <TextField size="small" type="date" label="Gacha" value={to} onChange={(e) => setTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={exportCsv}>Excel</Button>
        <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()}>Chop etish</Button>
      </>} />

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><StatCard icon={<CartIcon />} title="Jami savdo" value={fmtMoney(r.revenue)} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><StatCard icon={<TrendIcon />} title="Foyda" value={fmtMoney(r.profit)} valueColor={r.profit >= 0 ? 'primary.main' : 'error.main'} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><StatCard icon={<WalletIcon />} title="Savdolar soni" value={String(r.count)} color="#C9A227" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><StatCard icon={<InboxIcon />} title="Jami kirim" value={fmtMoney(r.purchased)} color="#3B82F6" /></Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <ChartCard title="Oylik savdo">
            <ResponsiveContainer>
              <BarChart data={r.monthly} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid {...cs.grid} />
                <XAxis dataKey="name" {...cs.axis} />
                <YAxis {...cs.yAxis} />
                <Tooltip {...cs.tooltip} />
                <Legend />
                <Bar dataKey="Savdo" fill={GREEN} radius={[6, 6, 0, 0]} maxBarSize={80} activeBar={{ fill: YELLOW }} />
                <Bar dataKey="Foyda" fill="#9AD3B0" radius={[6, 6, 0, 0]} maxBarSize={80} activeBar={{ fill: '#FCE38A' }} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <ChartCard title="Kategoriyalar bo'yicha savdo">
            {r.categories.length === 0 ? (
              <Typography color="text.secondary">Ma'lumot yo'q</Typography>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={r.categories} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="80%" paddingAngle={2}>
                    {r.categories.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="none" />)}
                  </Pie>
                  <Tooltip {...cs.tooltip} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <ChartCard title="Kunlik savdo">
            <ResponsiveContainer>
              <LineChart data={r.daily} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid {...cs.grid} />
                <XAxis dataKey="name" {...cs.axis} minTickGap={20} />
                <YAxis {...cs.yAxis} />
                <Tooltip {...cs.tooltip} cursor={{ stroke: YELLOW, strokeWidth: 2 }} />
                <Line type="monotone" dataKey="Savdo" stroke={GREEN} strokeWidth={2.5} dot={false}
                  activeDot={{ r: 6, fill: YELLOW, stroke: '#fff', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Card sx={{ p: 2.5 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Eng ko'p sotilgan tovarlar</Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Tovar</TableCell>
                  <TableCell align="right">Sotilgan</TableCell>
                  <TableCell align="right">Summa</TableCell>
                  <TableCell align="right">Foyda</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {r.top.map((t, i) => (
                  <TableRow key={t.name} hover>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>{t.name}</TableCell>
                    <TableCell align="right">{fmtNum(t.qty)} {t.unit}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{fmtMoney(t.sum)}</TableCell>
                    <TableCell align="right" sx={{ color: 'primary.main' }}>{fmtMoney(t.profit)}</TableCell>
                  </TableRow>
                ))}
                {r.top.length === 0 && (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>Tanlangan davrda savdo yo'q</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </Grid>
      </Grid>
    </>
  )
}
