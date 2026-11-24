import type { ReactNode } from 'react'
import { Box, Card, Stack, Typography, alpha } from '@mui/material'
import { GREEN } from '../theme'

/** Ko'rsatkich kartasi: gradientli belgi, katta raqam, burchakda yumshoq doira */
export default function StatCard({ icon, title, value, color = GREEN, valueColor }: {
  icon: ReactNode; title: string; value: string; color?: string; valueColor?: string
}) {
  return (
    <Card sx={{ p: 2.5, height: '100%', position: 'relative', overflow: 'hidden', '&:hover': { transform: 'translateY(-2px)' } }}>
      <Box sx={{ position: 'absolute', right: -28, top: -28, width: 110, height: 110, borderRadius: '50%', bgcolor: alpha(color, 0.07), pointerEvents: 'none' }} />
      <Stack spacing={1.75} sx={{ position: 'relative' }}>
        <Box sx={{
          width: 44, height: 44, borderRadius: 3, display: 'grid', placeItems: 'center', color: '#fff',
          background: `linear-gradient(135deg, ${alpha(color, 0.85)} 0%, ${color} 100%)`, boxShadow: `0 8px 18px ${alpha(color, 0.35)}`,
          '& svg': { fontSize: 22 },
        }}>
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 0.25 }}>{title}</Typography>
          <Typography sx={{ fontSize: { xs: 22, md: 24 }, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.2, color: valueColor, overflowWrap: 'anywhere' }}>{value}</Typography>
        </Box>
      </Stack>
    </Card>
  )
}
