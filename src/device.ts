// Shu qurilmaga tegishli sozlamalar (har bir telefon o'zinikini saqlaydi)
const SELLER_KEY = 'ombor-seller'

export const getSeller = () => localStorage.getItem(SELLER_KEY) ?? ''
export const setSeller = (name: string) => localStorage.setItem(SELLER_KEY, name.trim())

export const isMobile = () => window.matchMedia('(max-width: 899px)').matches

let ctx: AudioContext | null = null
/** Skaner muvaffaqiyatli bo'lganda qisqa "pip" */
export function beep(ok = true) {
  try {
    ctx ??= new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = ok ? 1500 : 300
    g.gain.value = 0.08
    o.connect(g).connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + (ok ? 0.08 : 0.25))
    navigator.vibrate?.(ok ? 40 : [80, 50, 80])
  } catch { /* ovoz bo'lmasa ham ishlayveradi */ }
}
