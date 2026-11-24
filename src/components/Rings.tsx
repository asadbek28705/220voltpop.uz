import { Box, alpha } from '@mui/material'

/**
 * Bezak: bir markazli yumaloq halqalar (kartalar burchagida).
 * size — eng katta halqa diametri, x/y — markazning kartaga nisbatan joyi.
 */
export default function Rings({ color, size = 220, x = '100%', y = '0%', count = 3, strength = 1 }: {
  color: string; size?: number; x?: string; y?: string; count?: number; strength?: number
}) {
  return (
    <Box aria-hidden sx={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', borderRadius: 'inherit' }}>
      {Array.from({ length: count }, (_, i) => {
        const d = size * (1 - i * (0.6 / count))
        return (
          <Box key={i} sx={{
            position: 'absolute', left: x, top: y, width: d, height: d, borderRadius: '50%', transform: 'translate(-50%, -50%)',
            border: `1.5px solid ${alpha(color, (0.10 + i * 0.05) * strength)}`,
            background: i === count - 1 ? `radial-gradient(circle, ${alpha(color, 0.10 * strength)} 0%, transparent 70%)` : 'none',
          }} />
        )
      })}
    </Box>
  )
}
