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
import { currentPeriod, dayKey, daysAgo, expenseInRange, fmtDay, inRange, profitOf, today } from '../stats'
import { useState } from 'react'
import { Alert, Snackbar } from '@mui/material'
import RestartIcon from '@mui/icons-material/RestartAlt'
import { useIsAdmin } from '../auth'
import ClosePeriodDialog from './ClosePeriodDialog'
import DebtIcon from '@mui/icons-material/MenuBookOutlined'
import BalanceIcon from '@mui/icons-material/AccountBalanceOutlined'
import { GREEN, YELLOW } from '../theme'
import PageHeader from './PageHeader'
import StatCard from './StatCard'
import ChartCard from './ChartCard'
import { useChartStyle } from './charts'
import { t as tr } from '../i18n'

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

  // Joriy chorak: 1-yanvar / 1-aprel / 1-iyul / 1-oktabrdan 0 dan boshlanadi
  // Joriy hisob davri: oxirgi «Davrni yopish» dan beri hisoblanadi
  const admin = useIsAdmin()
  const [closing, setClosing] = useState(false)
  const [toast, setToast] = useState('')
  const q = currentPeriod(wh.data.settings)
  const qs = useMemo(() => {
    const sales = movements.filter((m) => m.type === 'out' && inRange(m, q.from, q.to))
    const revenue = sales.reduce((s, m) => s + m.qty * m.price, 0)
    const profit = sales.reduce((s, m) => s + profitOf(m, products), 0)
    const spent = wh.data.expenses.filter((e) => expenseInRange(e, q.from, q.to)).reduce((s, e) => s + e.amount, 0)
    return { revenue, profit, spent, net: profit - spent }
  }, [movements, products, wh.data.expenses, q.from, q.to])
  const debtors = wh.data.customers.filter((c) => c.debt > 0)
  const totalDebt = debtors.reduce((s, c) => s + c.debt, 0)

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
      <PageHeader title={tr("Bosh sahifa")} subtitle={tr("Bugungi holat")} actions={<>
        <Button variant="outlined" startIcon={<MoneyOffIcon />} onClick={onExpense}>{tr("Xarajat")}</Button>
        <Button variant="outlined" startIcon={<AddIcon />} onClick={() => onMovement('in')}>{tr("Kirim")}</Button>
        <Button variant="contained" startIcon={<CartIcon />} onClick={() => onMovement('out')}>{tr("Yangi savdo")}</Button>
      </>} />

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><StatCard icon={<CartIcon />} title={tr("Bugungi savdo")} value={fmtMoney(todayRevenue)} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><StatCard icon={<TrendIcon />} title={tr("Bugungi sof foyda")} value={fmtMoney(todayProfit - todayExpenses)} valueColor={todayProfit - todayExpenses >= 0 ? 'primary.main' : 'error.main'} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><StatCard icon={<WalletIcon />} title={tr("Ombor qiymati (tannarx)")} value={fmtMoney(costValue)} color="#3B82F6" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><StatCard icon={<MoneyOffIcon />} title={tr("Bugungi xarajat")} value={fmtMoney(todayExpenses)} color="#E5533D" /></Grid>
      </Grid>

      {/* Telefonda qator sig'masa — keyingi qatorga o'tadi, tugma ekrandan chiqib ketmaydi */}
      <Stack direction="row" alignItems="center" flexWrap="wrap" useFlexGap columnGap={1} rowGap={1} sx={{ mb: 1.5 }}>
        <Stack direction="row" alignItems="baseline" spacing={1} sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ whiteSpace: 'nowrap' }}>{tr("Joriy davr")}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>{tr('{0} dan', fmtDay(q.from))}</Typography>
        </Stack>
        {totalDebt > 0 && <Chip icon={<DebtIcon />} color="error" variant="outlined" clickable onClick={() => navigate('debtors')}
          label={tr("Mijozlar qarzi: {0} ({1})", fmtMoney(totalDebt), debtors.length)} sx={{ fontWeight: 600, maxWidth: '100%' }} />}
        <Stack direction="row" spacing={1}>
          <Button size="small" onClick={() => navigate('reports')} sx={{ whiteSpace: 'nowrap' }}>{tr("Batafsil")}</Button>
          {admin && <Button size="small" color="warning" variant="contained" disableElevation startIcon={<RestartIcon />} onClick={() => setClosing(true)}
            sx={{ whiteSpace: 'nowrap' }}>{tr("Davrni yopish")}</Button>}
        </Stack>
      </Stack>
      {closing && <ClosePeriodDialog wh={wh} from={q.from} totals={qs} onClose={() => setClosing(false)} onDone={setToast} />}
      <Snackbar open={!!toast} autoHideDuration={5000} onClose={() => setToast('')} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" onClose={() => setToast('')}>{toast}</Alert>
      </Snackbar>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><StatCard icon={<CartIcon />} title={tr("Davr savdosi")} value={fmtMoney(qs.revenue)} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><StatCard icon={<TrendIcon />} title={tr("Davr foydasi")} value={fmtMoney(qs.profit)} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><StatCard icon={<MoneyOffIcon />} title={tr("Davr xarajati")} value={fmtMoney(qs.spent)} color="#E5533D" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}><StatCard icon={<BalanceIcon />} title={tr("Davr sof foydasi")} value={fmtMoney(qs.net)} color={qs.net >= 0 ? '#2E9E5B' : '#E5533D'} valueColor={qs.net >= 0 ? 'primary.main' : 'error.main'} /></Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <ChartCard title={tr("Oxirgi 14 kun savdosi")} height={280}>
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
                <Area type="monotone" dataKey="Savdo" name={tr("Savdo")} stroke={GREEN} strokeWidth={2.5} fill="url(#g)"
                  activeDot={{ r: 6, fill: YELLOW, stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Card sx={{ p: 2.5, height: '100%' }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <WarningIcon sx={{ color: YELLOW }} />
              <Typography variant="h6" sx={{ flexGrow: 1 }}>{tr("Kam qolganlar (")}{low.length})</Typography>
              <Button size="small" onClick={() => navigate('products')}>{tr("Hammasi")}</Button>
            </Stack>
            {low.length === 0 ? (
              <Typography color="text.secondary">{tr("Hamma tovar yetarli miqdorda")}</Typography>
            ) : (
              <List dense disablePadding>
                {low.slice(0, 7).map((p) => (
                  <ListItem key={p.id} disableGutters
                    secondaryAction={<Chip size="small" clickable onClick={() => onMovement('in', p.id)} color={p.qty === 0 ? 'error' : 'warning'}
                      variant="outlined" label={`${fmtNum(p.qty)} ${tr(p.unit)}`} />}>
                    <ListItemText primary={p.name} secondary={tr("Minimal: {0} {1}", fmtNum(p.minQty), tr(p.unit))}
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
              <Typography variant="h6" sx={{ flexGrow: 1 }}>{tr("Oxirgi harakatlar")}</Typography>
              <Button size="small" onClick={() => navigate('history')}>{tr("Hammasi")}</Button>
            </Stack>
            {movements.length === 0 ? (
              <Typography color="text.secondary">{tr("Hali kirim yoki chiqim yo'q")}</Typography>
            ) : (
              <List dense disablePadding>
                {movements.slice(0, 8).map((m) => (
                  <ListItem key={m.id} disableGutters sx={{ borderRadius: 2, px: 1, '&:hover': { bgcolor: 'action.hover' } }}>
                    <Box sx={{ width: 120, flexShrink: 0 }}>
                      <Chip size="small" variant="outlined" label={m.type === 'in' ? tr("Kirim") : m.type === 'out' ? tr("Savdo") : tr("Inventarizatsiya")}
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
