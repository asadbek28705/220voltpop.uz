import { useState } from 'react'
import { AppBar, Box, Container, Tab, Tabs, Toolbar, Typography } from '@mui/material'
import WarehouseIcon from '@mui/icons-material/Warehouse'
import { useWarehouse } from './store'
import type { MovementType } from './types'
import Dashboard from './components/Dashboard'
import Products from './components/Products'
import History from './components/History'
import Settings from './components/Settings'
import MovementDialog from './components/MovementDialog'

export default function App() {
  const wh = useWarehouse()
  const [tab, setTab] = useState(0)
  const [mvOpen, setMvOpen] = useState<{ type: MovementType; productId?: string } | null>(null)

  const openMovement = (type: MovementType, productId?: string) => setMvOpen({ type, productId })

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppBar position="sticky" elevation={1}>
        <Toolbar sx={{ gap: 1.5 }}>
          <WarehouseIcon />
          <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
            Ombor — Qurilish va santexnika
          </Typography>
        </Toolbar>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} textColor="inherit" indicatorColor="secondary" variant="scrollable" sx={{ px: 2 }}>
          <Tab label="Bosh sahifa" />
          <Tab label="Mahsulotlar" />
          <Tab label="Kirim / Chiqim tarixi" />
          <Tab label="Sozlamalar" />
        </Tabs>
      </AppBar>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        {tab === 0 && <Dashboard wh={wh} onMovement={openMovement} goProducts={() => setTab(1)} />}
        {tab === 1 && <Products wh={wh} onMovement={openMovement} />}
        {tab === 2 && <History wh={wh} />}
        {tab === 3 && <Settings wh={wh} />}
      </Container>
      {mvOpen && (
        <MovementDialog wh={wh} initialType={mvOpen.type} initialProductId={mvOpen.productId} onClose={() => setMvOpen(null)} />
      )}
    </Box>
  )
}
