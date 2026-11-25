import { useState } from 'react'
import { Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material'
import { getReceiptPaper, setReceiptPaper, type ReceiptPaper } from '../print'
import PrintIcon from '@mui/icons-material/PrintOutlined'
import CheckIcon from '@mui/icons-material/CheckCircleRounded'
import ReturnIcon from '@mui/icons-material/AssignmentReturnOutlined'
import type { Warehouse } from '../store'
import { PrintArea, Receipt, printReceipt } from './Receipt'
import ReturnDialog from './ReturnDialog'
import { t as tr } from '../i18n'

interface Props {
  wh: Warehouse
  saleId?: string // savdo cheki
  returnId?: string // qaytarish cheki
  justSold?: boolean
  justReturned?: boolean
  onClose: () => void
}

export default function ReceiptDialog({ wh, saleId, returnId: initialReturn, justSold, justReturned: jr, onClose }: Props) {
  const [returnId, setReturnId] = useState(initialReturn)
  const [returning, setReturning] = useState(false)
  const [justReturned, setJustReturned] = useState(!!jr)
  const kind = returnId ? 'return' : 'sale'
  const lines = returnId
    ? wh.data.movements.filter((m) => m.type === 'return' && m.batchId === returnId)
    : wh.data.movements.filter((m) => m.type === 'out' && m.saleId === saleId)
  const [printing, setPrinting] = useState(false)
  const [paper, setPaper] = useState<ReceiptPaper>(getReceiptPaper)
  const paid = kind === 'sale' ? wh.data.customerTx.filter((t) => t.saleId === saleId && t.type === 'pay').reduce((s, t) => s + t.amount, 0) : 0
  const returned = kind === 'sale' ? wh.data.movements.filter((m) => m.type === 'return' && m.saleId === saleId).reduce((s, m) => s + m.qty * m.price, 0) : 0
  const soldQty = lines.reduce((s, m) => s + m.qty, 0)
  const backQty = kind === 'sale' ? wh.data.movements.filter((m) => m.type === 'return' && m.saleId === saleId).reduce((s, m) => s + m.qty, 0) : 0
  const canReturn = kind === 'sale' && lines.length > 0 && backQty < soldQty - 1e-9
  const customer = lines[0]?.customerId ? wh.data.customers.find((c) => c.id === lines[0].customerId) ?? null : null

  const print = () => { setPrinting(true); printReceipt(); setTimeout(() => setPrinting(false), 500) }
  const props = { settings: wh.data.settings, paid, kind, customer, returned } as const

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogContent sx={{ bgcolor: 'background.default', pt: 3 }}>
        {((justSold && !returnId) || justReturned) && (
          <Stack alignItems="center" spacing={0.5} sx={{ mb: 2, color: kind === 'return' ? 'warning.main' : 'primary.main', fontWeight: 700 }}>
            <CheckIcon sx={{ fontSize: 48 }} />
            <span>{kind === 'return' ? tr("Tovar qaytarildi va omborga tushdi") : tr("Savdo amalga oshirildi")}</span>
          </Stack>
        )}
        {lines.length === 0 ? (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 4 }}><CircularProgress /></Box>
        ) : (
          <Box className="receipt-preview" sx={{ boxShadow: 1, borderRadius: 2, overflowX: 'auto' }}>
            <Receipt lines={lines} {...props} />
          </Box>
        )}
        <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} sx={{ mt: 2 }} className="no-print">
          <Typography variant="body2" color="text.secondary">{tr("Chek qog'ozi:")}</Typography>
          <ToggleButtonGroup size="small" exclusive value={paper} onChange={(_, v) => { if (v) { setPaper(v); setReceiptPaper(v) } }}>
            <ToggleButton value="80" sx={{ px: 1.5 }}>80 mm</ToggleButton>
            <ToggleButton value="58" sx={{ px: 1.5 }}>58 mm</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, flexWrap: 'wrap', gap: 1 }}>
        {canReturn && !justSold && (
          <Button color="warning" startIcon={<ReturnIcon />} onClick={() => setReturning(true)} sx={{ mr: 'auto' }}>{tr("Qaytarish")}</Button>
        )}
        <Button onClick={onClose}>{justSold && !returnId ? tr("Yangi savdo") : tr("Yopish")}</Button>
        <Button variant="contained" size="large" startIcon={<PrintIcon />} disabled={!lines.length || printing} onClick={print}>
          {tr("Chekni chop etish")}
        </Button>
      </DialogActions>
      <PrintArea lines={lines.length ? lines : null} {...props} />
      {returning && saleId && (
        <ReturnDialog wh={wh} saleId={saleId} onClose={() => setReturning(false)} onDone={(id) => { setReturning(false); setReturnId(id); setJustReturned(true) }} />
      )}
    </Dialog>
  )
}
