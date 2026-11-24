import { useState } from 'react'
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, useMediaQuery, useTheme } from '@mui/material'
import type { Warehouse } from '../store'
import type { Customer } from '../types'
import { attempt } from '../api'

interface Props { wh: Warehouse; customer?: Customer; initialName?: string; onClose: () => void; onSaved?: (c: Customer) => void }

/** Doimiy mijozni qo'shish / tahrirlash */
export default function CustomerDialog({ wh, customer, initialName, onClose, onSaved }: Props) {
  const fullScreen = useMediaQuery(useTheme().breakpoints.down('sm'))
  const [f, setF] = useState({ name: customer?.name ?? initialName ?? '', phone: customer?.phone ?? '', note: customer?.note ?? '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!f.name.trim()) return setErr('Ismini kiriting')
    setBusy(true)
    const r = await attempt(() => wh.saveCustomer({ id: customer?.id, name: f.name.trim(), phone: f.phone.trim(), note: f.note.trim() }))
    setBusy(false)
    if (!r.ok) return setErr(r.error)
    onSaved?.(r.value)
    onClose()
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" fullScreen={fullScreen}>
      <DialogTitle>{customer ? 'Mijozni tahrirlash' : 'Yangi mijoz'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Ismi / obyekt nomi *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus
            placeholder="Masalan: Usta Akmal" />
          <TextField label="Telefon" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} inputMode="tel" placeholder="+998 90 123 45 67" />
          <TextField label="Izoh" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} multiline minRows={2}
            placeholder="Manzil, obyekt, qaysi brigada..." />
          {err && <Alert severity="error">{err}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Bekor qilish</Button>
        <Button variant="contained" onClick={save} disabled={busy}>Saqlash</Button>
      </DialogActions>
    </Dialog>
  )
}
