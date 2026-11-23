import { Box, Button, Card, CardContent, Chip, List, ListItem, ListItemText, Paper, Stack, Typography } from '@mui/material'
import Grid from '@mui/material/Grid'
import AddIcon from '@mui/icons-material/AddCircleOutline'
import RemoveIcon from '@mui/icons-material/RemoveCircleOutline'
import WarningIcon from '@mui/icons-material/WarningAmber'
import type { Warehouse } from '../store'
import type { MovementType } from '../types'
import { fmtDate, fmtMoney, fmtNum } from '../utils'

interface Props { wh: Warehouse; onMovement: (t: MovementType, id?: string) => void; goProducts: () => void }

function Stat({ title, value, color }: { title: string; value: string; color?: string }) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="body2" color="text.secondary">{title}</Typography>
        <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5, color }}>{value}</Typography>
      </CardContent>
    </Card>
  )
}

export default function Dashboard({ wh, onMovement, goProducts }: Props) {
  const { products, movements } = wh.data
  const costValue = products.reduce((s, p) => s + p.qty * p.buyPrice, 0)
  const saleValue = products.reduce((s, p) => s + p.qty * p.sellPrice, 0)
  const low = products.filter((p) => p.qty <= p.minQty).sort((a, b) => a.qty / (a.minQty || 1) - b.qty / (b.minQty || 1))

  const today = new Date().toDateString()
  const todayMv = movements.filter((m) => new Date(m.date).toDateString() === today)
  const todaySales = todayMv.filter((m) => m.type === 'out').reduce((s, m) => s + m.qty * m.price, 0)
  const todayIn = todayMv.filter((m) => m.type === 'in').reduce((s, m) => s + m.qty * m.price, 0)

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <Button variant="contained" color="success" size="large" startIcon={<AddIcon />} onClick={() => onMovement('in')}>Kirim qilish</Button>
        <Button variant="contained" color="secondary" size="large" startIcon={<RemoveIcon />} onClick={() => onMovement('out')}>Chiqim / Sotuv</Button>
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }}><Stat title="Mahsulot turlari" value={String(products.length)} /></Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.5 }}><Stat title="Ombor qiymati (tannarx)" value={fmtMoney(costValue)} /></Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.5 }}><Stat title="Sotuv narxida qiymati" value={fmtMoney(saleValue)} /></Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.5 }}><Stat title="Bugungi sotuv" value={fmtMoney(todaySales)} color="#2e7d32" /></Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2.5 }}><Stat title="Bugungi kirim" value={fmtMoney(todayIn)} /></Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <WarningIcon color="warning" />
              <Typography variant="h6" sx={{ flexGrow: 1 }}>Kam qolgan mahsulotlar ({low.length})</Typography>
              <Button size="small" onClick={goProducts}>Hammasi</Button>
            </Stack>
            {low.length === 0 ? (
              <Typography color="text.secondary">Hamma mahsulot yetarli miqdorda 👍</Typography>
            ) : (
              <List dense>
                {low.slice(0, 10).map((p) => (
                  <ListItem key={p.id} secondaryAction={<Button size="small" color="success" onClick={() => onMovement('in', p.id)}>Kirim</Button>}>
                    <ListItemText primary={p.name} secondary={`Minimal: ${fmtNum(p.minQty)} ${p.unit}`} />
                    <Chip size="small" color={p.qty === 0 ? 'error' : 'warning'} label={`${fmtNum(p.qty)} ${p.unit}`} sx={{ mr: 8 }} />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Oxirgi harakatlar</Typography>
            {movements.length === 0 ? (
              <Typography color="text.secondary">Hali kirim yoki chiqim yo'q</Typography>
            ) : (
              <List dense>
                {movements.slice(0, 10).map((m) => (
                  <ListItem key={m.id}>
                    <Box sx={{ width: 70 }}>
                      <Chip size="small" label={m.type === 'in' ? 'Kirim' : m.type === 'out' ? 'Chiqim' : 'Tuzatish'}
                        color={m.type === 'in' ? 'success' : m.type === 'out' ? 'secondary' : 'default'} />
                    </Box>
                    <ListItemText primary={`${m.productName} — ${m.qty > 0 && m.type === 'adjust' ? '+' : ''}${fmtNum(m.qty)}`}
                      secondary={`${fmtDate(m.date)}${m.counterparty ? ' · ' + m.counterparty : ''}`} />
                    <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>{m.type !== 'adjust' ? fmtMoney(m.qty * m.price) : ''}</Typography>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  )
}
