import { useTheme } from '@mui/material'
import { fmtMoney } from '../utils'
import { shortMoney } from '../stats'

export const PIE_COLORS = ['#2E9E5B', '#F5C518', '#3B82F6', '#EF6C3B', '#8B5CF6', '#14B8A6', '#EC4899', '#84CC16', '#64748B', '#A16207']

/** Recharts uchun mavzuga mos umumiy sozlamalar */
export function useChartStyle() {
  const t = useTheme()
  const text = t.palette.text.secondary
  return {
    grid: { strokeDasharray: '3 3', stroke: t.palette.divider, vertical: false },
    axis: { tick: { fill: text, fontSize: 12 }, stroke: t.palette.divider, tickLine: false },
    yAxis: { tick: { fill: text, fontSize: 12 }, stroke: t.palette.divider, tickLine: false, tickFormatter: shortMoney, width: 64 },
    tooltip: {
      formatter: (v: unknown) => fmtMoney(Number(v) || 0),
      contentStyle: { background: t.palette.background.paper, border: `1px solid ${t.palette.divider}`, borderRadius: 10 },
      labelStyle: { color: t.palette.text.primary, fontWeight: 600 },
      cursor: { fill: 'rgba(245,197,24,0.15)' },
    },
  }
}
