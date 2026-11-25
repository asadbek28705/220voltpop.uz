import { useEffect, useState } from 'react'

/** Joriy sahifadagi asosiy JS fayl nomi (har yangi versiyada o'zgaradi: index-AbC123.js) */
const currentBundle = () =>
  [...document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')].map((s) => s.src.split('/').pop()).find((n) => n?.startsWith('index-')) ?? ''

/**
 * Serverga yangi versiya chiqqanini tekshiradi (har 2 daqiqada va oynaga qaytilganda).
 * Natija: true — yangi versiya bor, sahifani yangilash kerak.
 */
export function useUpdateCheck() {
  const [available, setAvailable] = useState(false)
  useEffect(() => {
    const mine = currentBundle()
    if (!mine || location.hostname === 'localhost') return
    let stop = false
    const check = async () => {
      try {
        const html = await (await fetch('/?v=' + Date.now(), { cache: 'no-store' })).text()
        const latest = html.match(/\/assets\/(index-[\w-]+\.js)/)?.[1]
        if (!stop && latest && latest !== mine) setAvailable(true)
      } catch { /* aloqa yo'q — keyinroq */ }
    }
    const t = setInterval(check, 2 * 60 * 1000)
    const onVis = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVis)
    check()
    return () => { stop = true; clearInterval(t); document.removeEventListener('visibilitychange', onVis) }
  }, [])
  return available
}
