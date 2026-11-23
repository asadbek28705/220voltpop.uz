import { useRef } from 'react'
import { Alert, Button, Paper, Stack, Typography } from '@mui/material'
import type { Warehouse } from '../store'
import type { WarehouseData } from '../types'
import { download } from '../utils'
import PageHeader from './PageHeader'

export default function Settings({ wh }: { wh: Warehouse }) {
  const fileRef = useRef<HTMLInputElement>(null)

  const backup = () =>
    download(`ombor-zaxira-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(wh.data, null, 2), 'application/json')

  const restore = async (file: File) => {
    try {
      const d = JSON.parse(await file.text()) as WarehouseData
      if (!Array.isArray(d.products) || !Array.isArray(d.movements)) throw new Error()
      if (confirm(`Zaxiradan ${d.products.length} ta mahsulot va ${d.movements.length} ta harakat tiklansinmi? Hozirgi ma'lumotlar almashtiriladi.`)) {
        wh.replaceAll({ ...d, categories: d.categories ?? [] })
      }
    } catch {
      alert("Fayl noto'g'ri yoki buzilgan")
    }
  }

  return (
    <Stack spacing={2} sx={{ maxWidth: 760 }}>
      <PageHeader title="Sozlamalar" subtitle="Zaxira nusxa va ma'lumotlarni boshqarish" />
      <Alert severity="info">
        Ma'lumotlar shu kompyuterdagi brauzerda saqlanadi. Har kuni yoki haftada bir marta zaxira nusxa oling.
      </Alert>
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="h6" gutterBottom>Zaxira nusxa</Typography>
        <Stack direction="row" spacing={2}>
          <Button variant="contained" onClick={backup}>Zaxira yuklab olish</Button>
          <Button variant="outlined" onClick={() => fileRef.current?.click()}>Zaxiradan tiklash</Button>
          <input ref={fileRef} type="file" accept="application/json" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) restore(f); e.target.value = '' }} />
        </Stack>
      </Paper>
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="h6" gutterBottom>Ma'lumotlarni tozalash</Typography>
        <Stack direction="row" spacing={2}>
          <Button color="error" variant="outlined"
            onClick={() => confirm("Barcha mahsulot va tarix o'chirilsinmi? Bu amalni qaytarib bo'lmaydi.") && wh.clearAll()}>
            Hammasini o'chirish
          </Button>
          <Button onClick={() => confirm("Namuna ma'lumotlar yuklansinmi? Hozirgi ma'lumotlar almashtiriladi.") && wh.reset()}>
            Namuna ma'lumotlarni yuklash
          </Button>
        </Stack>
      </Paper>
    </Stack>
  )
}
