import type { ReactNode } from 'react'
import { Card, Typography } from '@mui/material'

export default function ChartCard({ title, children, height = 300 }: { title: string; children: ReactNode; height?: number }) {
  return (
    <Card sx={{ p: 2.5, height: '100%' }}>
      <Typography variant="h6" sx={{ mb: 2 }}>{title}</Typography>
      <div style={{ width: '100%', height }}>{children}</div>
    </Card>
  )
}
