import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material'
import CartIcon from '@mui/icons-material/AddShoppingCart'
import InIcon from '@mui/icons-material/MoveToInboxOutlined'
import AddIcon from '@mui/icons-material/Add'
import type { Product } from '../types'
import { fmtMoney, fmtNum } from '../utils'

interface Props {
  code: string
  product?: Product
  onClose: () => void
  onAddToCart: (p: Product) => void
  onIncoming: (p: Product) => void
  onCreate: (code: string) => void
}

export default function ScanResultDialog({ code, product: p, onClose, onAddToCart, onIncoming, onCreate }: Props) {
  if (!p) {
    return (
      <Dialog open onClose={onClose} fullWidth maxWidth="xs">
        <DialogTitle>Tovar topilmadi</DialogTitle>
        <DialogContent>
          <Typography>Shtrix-kod: <b>{code}</b></Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>Bu kod bilan tovar yo'q. Yangi tovar sifatida qo'shasizmi?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Yopish</Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => onCreate(code)}>Yangi tovar</Button>
        </DialogActions>
      </Dialog>
    )
  }
  const status = p.qty === 0 ? 'error' : p.qty <= p.minQty ? 'warning' : 'success'
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 0.5 }}>{p.name}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">{p.category}</Typography>
        <Typography variant="h4" sx={{ fontWeight: 800, my: 2, color: 'primary.main' }}>{fmtMoney(p.sellPrice)}</Typography>
        <Stack spacing={1}>
          <Row label="Omborda"><Chip size="small" variant="outlined" color={status} label={`${fmtNum(p.qty)} ${p.unit}`} /></Row>
          <Row label="Joyi">{p.location || '—'}</Row>
          <Row label="Artikul">{p.sku || '—'}</Row>
          <Row label="Shtrix-kod">{p.barcode || code}</Row>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1, px: 3, pb: 2 }}>
        <Button onClick={onClose}>Yopish</Button>
        <Button variant="outlined" startIcon={<InIcon />} onClick={() => onIncoming(p)}>Kirim</Button>
        <Button variant="contained" startIcon={<CartIcon />} disabled={p.qty <= 0} onClick={() => onAddToCart(p)}>Savatga</Button>
      </DialogActions>
    </Dialog>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography color="text.secondary">{label}</Typography>
      <Box sx={{ fontWeight: 600 }}>{children}</Box>
    </Stack>
  )
}
