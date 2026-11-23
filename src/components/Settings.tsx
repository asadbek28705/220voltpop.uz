import { useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material'
import type { Warehouse } from '../store'
import type { ShopSettings, WarehouseData } from '../types'
import { download } from '../utils'
import { attempt } from '../api'
import { getSeller, setSeller } from '../device'
import PageHeader from './PageHeader'
import TelegramSettings from './TelegramSettings'
import Users from './Users'
import { useMe } from '../auth'
import { api } from '../api'
import LogoutIcon from '@mui/icons-material/Logout'

export default function Settings({ wh, onSellerChange }: { wh: Warehouse; onSellerChange: (name: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [shop, setShop] = useState<ShopSettings>(wh.data.settings)
  const [seller, setSellerName] = useState(getSeller())
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const me = useMe()
  const admin = me.user?.role === 'admin'
  const [pw, setPw] = useState({ old: '', next: '', next2: '' })
  const changePassword = async () => {
    if (pw.next !== pw.next2) return setMsg({ ok: false, text: 'Yangi parollar bir xil emas' })
    const r = await attempt(() => api('POST', '/password', { oldPassword: pw.old, newPassword: pw.next }))
    setMsg(r.ok ? { ok: true, text: "Parol o'zgartirildi" } : { ok: false, text: r.error })
    if (r.ok) setPw({ old: '', next: '', next2: '' })
  }
  const logout = async () => { await attempt(() => api('POST', '/logout')); location.reload() }
  useEffect(() => setShop(wh.data.settings), [wh.data.settings])

  const run = async (fn: () => Promise<unknown>, okText: string) => {
    const r = await attempt(fn)
    setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: r.error })
  }

  const backup = () =>
    download(`ombor-zaxira-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(wh.data, null, 2), 'application/json')

  const restore = async (file: File) => {
    try {
      const d = JSON.parse(await file.text()) as WarehouseData
      if (!Array.isArray(d.products) || !Array.isArray(d.movements)) throw new Error()
      if (confirm(`Zaxiradan ${d.products.length} ta tovar va ${d.movements.length} ta harakat tiklansinmi? Hozirgi ma'lumotlar almashtiriladi.`)) {
        run(() => wh.replaceAll(d), 'Zaxiradan tiklandi')
      }
    } catch {
      setMsg({ ok: false, text: "Fayl noto'g'ri yoki buzilgan" })
    }
  }

  const s = (k: keyof ShopSettings) => (e: React.ChangeEvent<HTMLInputElement>) => setShop({ ...shop, [k]: e.target.value })

  return (
    <Stack spacing={2} sx={{ maxWidth: 760 }}>
      <PageHeader title="Sozlamalar" subtitle={admin ? "Hisob, xodimlar, chek, Telegram va ma'lumotlar" : 'Hisobingiz'} />
      {msg && <Alert severity={msg.ok ? 'success' : 'error'} onClose={() => setMsg(null)}>{msg.text}</Alert>}

      {me.demo ? (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="h6" gutterBottom>Shu qurilmadagi sotuvchi</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Demo nusxa: ism chekda va savdolar tarixida ko'rinadi.</Typography>
          <Stack direction="row" spacing={2}>
            <TextField size="small" label="Ism" value={seller} onChange={(e) => setSellerName(e.target.value)} fullWidth />
            <Button variant="contained" onClick={() => { setSeller(seller); onSellerChange(seller.trim()); setMsg({ ok: true, text: 'Saqlandi' }) }}>Saqlash</Button>
          </Stack>
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Box>
              <Typography variant="h6">{me.user?.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                Login: {me.user?.login} · {admin ? 'Egasi (admin)' : 'Sotuvchi'}
              </Typography>
            </Box>
            <Button variant="outlined" startIcon={<LogoutIcon />} onClick={logout}>Chiqish</Button>
          </Stack>
          <Typography sx={{ fontWeight: 600, mb: 1 }}>Parolni almashtirish</Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField size="small" type="password" label="Eski parol" value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} autoComplete="current-password" />
            <TextField size="small" type="password" label="Yangi parol" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" />
            <TextField size="small" type="password" label="Takrorlang" value={pw.next2} onChange={(e) => setPw({ ...pw, next2: e.target.value })} autoComplete="new-password" />
            <Button variant="contained" onClick={changePassword} disabled={!pw.old || pw.next.length < 6}>Saqlash</Button>
          </Stack>
        </Paper>
      )}

      {!admin ? null : <>
      <Users />

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="h6" gutterBottom>Chek ma'lumotlari</Typography>
        <Stack spacing={2}>
          <TextField size="small" label="Do'kon nomi" value={shop.shopName} onChange={s('shopName')} />
          <TextField size="small" label="Manzil" value={shop.address} onChange={s('address')} />
          <TextField size="small" label="Telefon" value={shop.phone} onChange={s('phone')} />
          <TextField size="small" label="Chek pastidagi yozuv" value={shop.receiptFooter} onChange={s('receiptFooter')} />
          <Button variant="contained" sx={{ alignSelf: 'flex-start' }} onClick={() => run(() => wh.saveSettings(shop), 'Chek ma\'lumotlari saqlandi')}>Saqlash</Button>
        </Stack>
      </Paper>

      <TelegramSettings />

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="h6" gutterBottom>Zaxira nusxa</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Ma'lumotlar server bazasida saqlanadi (data/ombor.db). Haftada bir marta zaxira oling.
        </Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <Button variant="contained" onClick={backup}>Zaxira yuklab olish</Button>
          <Button variant="outlined" onClick={() => fileRef.current?.click()}>Zaxiradan tiklash</Button>
          <input ref={fileRef} type="file" accept="application/json" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = '' }} />
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="h6" gutterBottom>Ma'lumotlarni tozalash</Typography>
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          <Button color="error" variant="outlined"
            onClick={() => confirm("Barcha tovar va tarix o'chirilsinmi? Bu amalni qaytarib bo'lmaydi.") && run(wh.clearAll, "Hammasi o'chirildi")}>
            Hammasini o'chirish
          </Button>
          <Button variant="outlined"
            onClick={() => confirm("Namuna ma'lumotlar yuklansinmi? Hozirgi ma'lumotlar almashtiriladi.") && run(wh.reset, 'Namuna ma\'lumotlar yuklandi')}>
            Namuna ma'lumotlarni yuklash
          </Button>
        </Stack>
      </Paper>
      </>}
    </Stack>
  )
}
