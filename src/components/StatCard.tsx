import type { ReactNode } from 'react'
import { Box, Card, Stack, Typography, alpha } from '@mui/material'
import { GREEN } from '../theme'

export default function StatCard({ icon, title, value, color = GREEN, valueColor }: {
  icon: ReactNode; title: string; value: string; color?: string; valueColor?: string
}) {
  return (
    <Card sx={{ p: 2.5, height: '100%' }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Box sx={{ width: 48, height: 48, borderRadius: 2.5, flexShrink: 0, display: 'grid', placeItems: 'center', bgcolor: alpha(color, 0.14), color }}>
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary">{title}</Typography>
          <Typography variant="h5" sx={{ lineHeight: 1.25, color: valueColor }}>{value}</Typography>
        </Box>
      </Stack>
    </Card>
  )
}
