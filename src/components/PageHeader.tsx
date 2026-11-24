import type { ReactNode } from 'react'
import { Box, Stack, Typography } from '@mui/material'

export default function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'flex-end' }} justifyContent="space-between" sx={{ mb: 3 }}>
      <Box>
        <Typography variant="h4" sx={{ fontSize: { xs: 24, md: 30 } }}>{title}</Typography>
        {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{subtitle}</Typography>}
      </Box>
      {actions && <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap alignItems="flex-end" className="no-print">{actions}</Stack>}
    </Stack>
  )
}
