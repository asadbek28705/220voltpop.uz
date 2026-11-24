import { useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { t as tr } from '../i18n'

interface Props {
  open: boolean
  onClose: () => void
  onScan: (code: string) => void
  /** true — oyna yopilmaydi, ketma-ket skaner qilinadi (kassa uchun) */
  continuous?: boolean
  title?: string
}

export default function CameraScanner({ open, onClose, onScan, continuous, title = tr("Kamera bilan skaner") }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  const [lastCode, setLastCode] = useState('')
  const cb = useRef(onScan)
  cb.current = onScan

  useEffect(() => {
    if (!open) return
    setError('')
    setLastCode('')
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError(tr("Kamera faqat xavfsiz (https://) manzilda ishlaydi. Dasturni https:// bilan boshlanadigan manzil orqali oching."))
      return
    }
    let controls: IScannerControls | undefined
    let stopped = false
    let recent = ''
    let recentAt = 0
    const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 120 })
    // Video element Dialog ichida keyinroq paydo bo'ladi
    const start = () => {
      if (stopped) return
      if (!video.current) return void setTimeout(start, 50)
      reader
        .decodeFromConstraints({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } } }, video.current, (res) => {
          if (!res || stopped) return
          const code = res.getText()
          const now = Date.now()
          if (code === recent && now - recentAt < 2000) return // bitta kodni qayta-qayta o'qimaslik
          recent = code
          recentAt = now
          setLastCode(code)
          cb.current(code)
          if (!continuous) { stopped = true; controls?.stop(); onClose() }
        })
        .then((c) => { controls = c; if (stopped) c.stop() })
        .catch((e: Error) => setError(
          e.name === 'NotAllowedError' ? tr("Kameraga ruxsat berilmadi. Brauzer sozlamalarida kameraga ruxsat bering.")
            : e.name === 'NotFoundError' ? tr("Kamera topilmadi") : tr("Kamerani ochib bo'lmadi: ") + e.message,
        ))
    }
    start()
    return () => { stopped = true; controls?.stop() }
  }, [open, continuous, onClose])

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {error ? <Alert severity="error">{error}</Alert> : (
          <Box sx={{ position: 'relative', borderRadius: 3, overflow: 'hidden', bgcolor: '#000', aspectRatio: '4 / 3' }}>
            <video ref={video} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <Box sx={{ position: 'absolute', left: '10%', right: '10%', top: '35%', bottom: '35%', border: '3px solid #F5C518', borderRadius: 2, boxShadow: '0 0 0 9999px rgba(0,0,0,.35)' }} />
          </Box>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          {lastCode ? <>{tr("O'qildi:")} <b>{lastCode}</b>{continuous && tr(" — keyingisini skaner qiling")}</> : tr("Shtrix-kodni sariq ramka ichiga keltiring")}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{continuous ? tr("Tayyor") : tr("Yopish")}</Button>
      </DialogActions>
    </Dialog>
  )
}
