import { useMemo } from 'react'
import { Box, Button, Card, Chip, List, ListItem, ListItemText, Stack, Typography } from '@mui/material'
import Grid from '@mui/material/Grid'
import AddIcon from '@mui/icons-material/AddCircleOutline'
import CartIcon from '@mui/icons-material/ShoppingCartOutlined'
import MoneyOffIcon from '@mui/icons-material/MoneyOffOutlined'
import WalletIcon from '@mui/icons-material/AccountBalanceWalletOutlined'
import TrendIcon from '@mui/icons-material/TrendingUp'
import WarningIcon from '@mui/icons-material/WarningAmberRounded'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Warehouse } from '../store'
import type { MovementType } from '../types'
import { fmtDate, fmtMoney, fmtNum } from '../utils'
import { dayKey, daysAgo, profitOf, today } from '../stats'
import { GREEN, YELLOW } from '../theme'
import PageHeader from './PageHeader'
import StatCard from './StatCard'
import ChartCard from './ChartCard'
import { useChartStyle } from './charts'

interface Props { wh: Warehouse; onMovement: (t: MovementType, id?: string) => void; navigate: (page: string) => void; onExpense: () => void }

export default function Dashboard({ wh, onMovement, navigate, onExpense }: Props) {
  const { products, movements } = wh.data
  const cs = useChartStyle()
  const costValue = products.reduce((s, p) => s + p.qty * p.buyPrice, 0)
  const low = products.filter((p) => p.qty <= p.minQty).sort((a, b) => a.qty / (a.minQty || 1) - b.qty / (b.minQty || 1))

  const t = today()
  const todaySales = movements.filter((m) => m.type === 'out' && dayKey(m.date) === t)
  const todayRevenue = todaySales.reduce((s, m) => s + m.qty * m.price, 0)
  const todayProfit = todaySales.reduce((s, m) => s + profitOf(m, products), 0)
  const todayExpenses = wh.data.expenses.filter((e) => dayKey(e.date) === t).reduce((s, e) => s + e.amount, 0)

  const last14 = useMemo(() => {
    const rows = Array.from({ length: 14 }, (_, i) => {
      const k = daysAgo(13 - i)
      return { k, name: `${k.slice(8)}.${k.slice(5, 7)}`, Savdo: 0 }
    })
    const idx = new Map(rows.map((r) => [r.k, r]))
    for (const m of movements) if (m.type === 'out') { const r = idx.get(dayKey(m.date)); if (r) r.Savdo += m.qty * m.price }
    return rows
  }, [movements])

  return (
    <>
      <PageHeader title="Bosh sahifa" subtitle="Bugungi holat" actions={<>
        <Button variant="outlined" startIcon={<MoneyOffIcon />} onClick={onExpense}>Xarajat</Button>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={() => onMovement('in')}>Kirim</Button>
        <Button variant="contained" startIcon={<CartIcon />} onClick={() => onMovement('out')}>Yangi savdo</Button>
      </>} />

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><StatCard icon={<CartIcon />} title="Bugungi savdo" value={fmtMoney(todayRevenue)} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><StatCard icon={<TrendIcon />} title="Bugungi sof foyda" value={fmtMoney(todayProfit - todayExpenses)} valueColor={todayProfit - todayExpenses >= 0 ? 'primary.main' : 'error.main'} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><StatCard icon={<WalletIcon />} title="Ombor qiymati (tannarx)" value={fmtMoney(costValue)} color="#3B82F6" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><StatCard icon={<MoneyOffIcon />} title="Bugungi xarajat" value={fmtMoney(todayExpenses)} color="#E5533D" /></Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <ChartCard title="Oxirgi 14 kun savdosi" height={280}>
            <ResponsiveContainer>
              <AreaChart data={last14} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GREEN} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={GREEN} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...cs.grid} />
                <XAxis dataKey="name" {...cs.axis} />
                <YAxis {...cs.yAxis} />
                <Tooltip {...cs.tooltip} cursor={{ stroke: YELLOW, strokeWidth: 2 }} />
                <Area type="monotone" dataKey="Savdo" stroke={GREEN} strokeWidth={2.5} fill="url(#g)"
                  activeDot={{ r: 6, fill: YELLOW, stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ p: 2.5, height: '100%' }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <WarningIcon sx={{ color: YELLOW }} />
              <Typography variant="h6" sx={{ flexGrow: 1 }}>Kam qolganlar ({low.length})</Typography>
              <Button size="small" onClick={() => navigate('products')}>Hammasi</Button>
            </Stack>
            {low.length === 0 ? (
              <Typography color="text.secondary">Hamma tovar yetarli miqdorda</Typography>
            ) : (
              <List dense disablePadding>
                {low.slice(0, 7).map((p) => (
                  <ListItem key={p.id} disableGutters
                    secondaryAction={<Chip size="small" clickable onClick={() => onMovement('in', p.id)} color={p.qty === 0 ? 'error' : 'warning'}
                      variant="outlined" label={`${fmtNum(p.qty)} ${p.unit}`} />}>
                    <ListItemText primary={p.name} secondary={`Minimal: ${fmtNum(p.minQty)} ${p.unit}`}
                      slotProps={{ primary: { noWrap: true, sx: { pr: 10 } } }} />
                  </ListItem>
                ))}
              </List>
            )}
          </Card>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Card sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="h6" sx={{ flexGrow: 1 }}>Oxirgi harakatlar</Typography>
              <Button size="small" onClick={() => navigate('history')}>Hammasi</Button>
            </Stack>
            {movements.length === 0 ? (
              <Typography color="text.secondary">Hali kirim yoki chiqim yo'q</Typography>
            ) : (
              <List dense disablePadding>
                {movements.slice(0, 8).map((m) => (
                  <ListItem key={m.id} disableGutters sx={{ borderRadius: 2, px: 1, '&:hover': { bgcolor: 'action.hover' } }}>
                    <Box sx={{ width: 120, flexShrink: 0 }}>
                      <Chip size="small" variant="outlined" label={m.type === 'in' ? 'Kirim' : m.type === 'out' ? 'Savdo' : 'Inventarizatsiya'}
                        color={m.type === 'in' ? 'info' : m.type === 'out' ? 'success' : 'default'} />
                    </Box>
                    <ListItemText primary={`${m.productName} — ${m.type === 'adjust' && m.qty > 0 ? '+' : ''}${fmtNum(m.qty)}`}
                      secondary={`${fmtDate(m.date)}${m.counterparty ? ' · ' + m.counterparty : ''}`} />
                    <Typography variant="body2" sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {m.type !== 'adjust' ? fmtMoney(m.qty * m.price) : ''}
                    </Typography>
                  </ListItem>
                ))}
              </List>
            )}
          </Card>
        </Grid>
      </Grid>
    </>
  )
}
