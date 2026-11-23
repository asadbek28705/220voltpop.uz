import { useState } from 'react'
import { Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, Stack } from '@mui/material'
import PrintIcon from '@mui/icons-material/PrintOutlined'
import CheckIcon from '@mui/icons-material/CheckCircleRounded'
import type { Warehouse } from '../store'
import { PrintArea, Receipt, printReceipt } from './Receipt'

interface Props { wh: Warehouse; saleId: string; justSold?: boolean; onClose: () => void }

export default function ReceiptDialog({ wh, saleId, justSold, onClose }: Props) {
  const lines = wh.data.movements.filter((m) => m.type === 'out' && m.saleId === saleId)
  const [printing, setPrinting] = useState(false)

  const print = () => { setPrinting(true); printReceipt(); setTimeout(() => setPrinting(false), 500) }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogContent sx={{ bgcolor: 'background.default', pt: 3 }}>
        {justSold && (
          <Stack alignItems="center" spacing={0.5} sx={{ mb: 2, color: 'primary.main', fontWeight: 700 }}>
            <CheckIcon sx={{ fontSize: 48 }} />
            <span>Savdo amalga oshirildi</span>
          </Stack>
        )}
        {lines.length === 0 ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}><CircularProgress /></Box>
        ) : (
          <Box className="receipt-preview" sx={{ boxShadow: 1, borderRadius: 2, overflowX: 'auto' }}>
            <Receipt lines={lines} settings={wh.data.settings} />
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>{justSold ? 'Yangi savdo' : 'Yopish'}</Button>
        <Button variant="contained" size="large" startIcon={<PrintIcon />} disabled={!lines.length || printing} onClick={print}>
          Chekni chop etish
        </Button>
      </DialogActions>
      <PrintArea lines={lines.length ? lines : null} settings={wh.data.settings} />
    </Dialog>
  )
}
