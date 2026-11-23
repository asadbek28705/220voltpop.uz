import { useEffect, useRef } from 'react'

/**
 * USB/Bluetooth shtrix-kod skanerlari klaviatura kabi ishlaydi: kodni juda tez "yozadi" va Enter bosadi.
 * Odam bunchalik tez yoza olmaydi — shu farq bo'yicha skanerni aniqlaymiz.
 * Kursor matn maydonida bo'lsa, ushlamaymiz (kod shu maydonga yoziladi).
 */
export function useHardwareScanner(onScan: (code: string) => void, enabled = true) {
  const cb = useRef(onScan)
  cb.current = onScan

  useEffect(() => {
    if (!enabled) return
    let buf = ''
    let last = 0
    let first = 0

    const isTyping = (t: EventTarget | null) => {
      const el = t as HTMLElement | null
      if (!el) return false
      const tag = el.tagName
      return el.isContentEditable || tag === 'TEXTAREA' || (tag === 'INPUT' && !['checkbox', 'radio', 'button'].includes((el as HTMLInputElement).type))
    }

    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
      const now = performance.now()
      if (e.key === 'Enter' || e.key === 'Tab') {
        const fast = buf.length >= 4 && (now - first) / buf.length < 50
        if (fast) {
          e.preventDefault()
          cb.current(buf)
        }
        buf = ''
        return
      }
      if (e.key.length !== 1) return
      if (now - last > 80) { buf = ''; first = now }
      if (!buf) first = now
      buf += e.key
      last = now
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [enabled])
}
