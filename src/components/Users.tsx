import { useEffect, useState } from 'react'
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Paper, Stack, Switch,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/PersonAddAlt'
import KeyIcon from '@mui/icons-material/KeyOutlined'
import { api, attempt } from '../api'
import type { User } from '../auth'
import { useMe } from '../auth'
import { t as tr } from '../i18n'

const ROLES = { admin: tr("Egasi (admin)"), seller: tr("Sotuvchi") }

/** Xodimlar: qo'shish, rol, o'chirish, parolni tiklash (faqat admin) */
export default function Users() {
  const me = useMe()
  const [users, setUsers] = useState<User[]>([])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', login: '', role: 'seller' })
  const [shown, setShown] = useState<{ login: string; password: string } | null>(null)
  const [error, setError] = useState('')

  const load = () => api<User[]>('GET', '/users').then(setUsers).catch(() => {})
  useEffect(() => { load() }, [])

  const add = async () => {
    setError('')
    const r = await attempt(() => api<{ user: User; password: string }>('POST', '/users', form))
    if (!r.ok) return setError(r.error)
    setAdding(false)
    setForm({ name: '', login: '', role: 'seller' })
    setShown({ login: r.value.user.login, password: r.value.password })
    load()
  }
  const update = async (u: User, patch: Partial<User>) => {
    const r = await attempt(() => api('PUT', `/users/${u.id}`, patch))
    if (!r.ok) setError(r.error)
    load()
  }
  const reset = async (u: User) => {
    if (!confirm(tr("{0} uchun yangi parol yaratilsinmi? Eski parol ishlamay qoladi.", u.name))) return
    const r = await attempt(() => api<{ password: string }>('POST', `/users/${u.id}/reset`))
    if (r.ok) setShown({ login: u.login, password: r.value.password })
    else setError(r.error)
  }

  if (me.demo) return null

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="h6">{tr("Xodimlar")}</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAdding(true)}>{tr("Xodim qo'shish")}</Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {tr("Sotuvchi: kassa, savdolar, tovarlar (kelish narxisiz), kirim va etiketka. Foyda, xarajat, hisobot va sozlamalarni ko'rmaydi.")}
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{tr("Ism")}</TableCell>
              <TableCell>{tr("Login")}</TableCell>
              <TableCell>{tr("Rol")}</TableCell>
              <TableCell align="center">{tr("Faol")}</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id} hover>
                <TableCell sx={{ fontWeight: 500 }}>{u.name}{u.id === me.user?.id && <Chip size="small" label="siz" sx={{ ml: 1 }} />}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace' }}>{u.login}</TableCell>
                <TableCell>
                  <TextField select size="small" variant="standard" value={u.role} disabled={u.id === me.user?.id}
                    onChange={(e) => update(u, { role: e.target.value as User['role'] })}>
                    {Object.entries(ROLES).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
                  </TextField>
                </TableCell>
                <TableCell align="center">
                  <Switch size="small" checked={u.active} disabled={u.id === me.user?.id} onChange={(e) => update(u, { active: e.target.checked })} />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title={tr("Yangi parol")}><IconButton size="small" onClick={() => reset(u)}><KeyIcon fontSize="small" /></IconButton></Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      <Dialog open={adding} onClose={() => setAdding(false)} fullWidth maxWidth="xs">
        <DialogTitle>{tr("Yangi xodim")}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label={tr("Ism")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            <TextField label={tr("Login (lotin harflarda)")} value={form.login} placeholder={tr("masalan: ali")}
              onChange={(e) => setForm({ ...form, login: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') })} />
            <TextField select label={tr("Rol")} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {Object.entries(ROLES).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
            </TextField>
            <Typography variant="body2" color="text.secondary">{tr("Parol avtomatik yaratiladi va bir marta ko'rsatiladi.")}</Typography>
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdding(false)}>{tr("Bekor qilish")}</Button>
          <Button variant="contained" onClick={add}>{tr("Qo'shish")}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!shown} onClose={() => setShown(null)} fullWidth maxWidth="xs">
        <DialogTitle>{tr("Kirish ma'lumotlari")}</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>{tr("Parolni hozir yozib oling yoki xodimga yuboring — u qayta ko'rsatilmaydi.")}</Alert>
          <Typography>{tr("Login:")} <b style={{ fontFamily: 'monospace' }}>{shown?.login}</b></Typography>
          <Typography>{tr("Parol:")} <b style={{ fontFamily: 'monospace', fontSize: 18 }}>{shown?.password}</b></Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{tr("Manzil:")} {location.origin}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => navigator.clipboard?.writeText(tr("{0}\nLogin: {1}\nParol: {2}", location.origin, shown?.login, shown?.password))}>{tr("Nusxa olish")}</Button>
          <Button variant="contained" onClick={() => setShown(null)}>{tr("Tayyor")}</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}
