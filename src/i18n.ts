// Uch til: o'zbek (asosiy), rus, ingliz.
// Kalit — o'zbekcha matnning o'zi: t("Kassa") → "Касса". Tarjima topilmasa o'zbekchasi chiqadi.
// O'zgaruvchilar: t("{0} ta tovar", n) — {0}, {1} ... o'rniga qo'yiladi.
import ru from './locales/ru'
import en from './locales/en'

export type Lang = 'uz' | 'ru' | 'en'
export const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: 'uz', label: "O'zbekcha", short: 'UZ' },
  { code: 'ru', label: 'Русский', short: 'RU' },
  { code: 'en', label: 'English', short: 'EN' },
]

const KEY = 'ombor-lang'
const saved = localStorage.getItem(KEY) as Lang | null
export const lang: Lang = saved && LANGS.some((l) => l.code === saved) ? saved : 'uz'
document.documentElement.lang = lang

const DICTS: Record<Lang, Record<string, string>> = { uz: {}, ru, en }
const dict = DICTS[lang]
const missing = new Set<string>()

const fill = (s: string, args: unknown[]) => (args.length ? s.replace(/\{(\d+)\}/g, (m, i) => (i < args.length ? String(args[+i]) : m)) : s)

export function t(key: string, ...args: unknown[]): string {
  const v = dict[key]
  if (v === undefined && lang !== 'uz' && location.hostname === 'localhost' && !missing.has(key)) {
    missing.add(key)
    console.warn(`[i18n:${lang}] tarjima yo'q:`, JSON.stringify(key))
  }
  return fill(v ?? key, args)
}

/** Tilni almashtirish: sahifa qayta yuklanadi — barcha matnlar yangi tilda */
export function setLang(l: Lang) {
  localStorage.setItem(KEY, l)
  location.reload()
}

/** Server xabarlari (o'zbekcha) — aniq mos yoki shablon bo'yicha tarjima */
const SERVER_PATTERNS: [RegExp, string][] = [
  [/^Omborda faqat (.+) bor$/, 'Omborda faqat {0} bor'],
  [/^"(.+)" omborda yetarli emas: (.+) bor$/, '"{0}" omborda yetarli emas: {1} bor'],
  [/^Bu shtrix-kod "(.+)" tovarida ishlatilgan$/, 'Bu shtrix-kod "{0}" tovarida ishlatilgan'],
  [/^Bu artikul "(.+)" tovarida ishlatilgan$/, 'Bu artikul "{0}" tovarida ishlatilgan'],
  [/^Mijozda (.+) so'm qarz bor — avval qarzni yoping$/, "Mijozda {0} so'm qarz bor — avval qarzni yoping"],
  [/^Telegram: (.+)$/, 'Telegram: {0}'],
  [/^"(.+)": narx tannarxdan \((.+) so'm\) past bo'lishi mumkin emas$/, "\"{0}\": narx tannarxdan ({1} so'm) past bo'lishi mumkin emas"],
  [/^"(.+)": bu narxda sotib bo'lmaydi — narx juda past\. Administratorga murojaat qiling$/, "\"{0}\": bu narxda sotib bo'lmaydi — narx juda past. Administratorga murojaat qiling"],
  [/^"(.+)": ko'pi bilan (.+) ta qaytarish mumkin$/, "\"{0}\": ko'pi bilan {1} ta qaytarish mumkin"],
]
export function tServer(msg: string): string {
  if (lang === 'uz') return msg
  if (dict[msg] !== undefined) return dict[msg]
  for (const [re, key] of SERVER_PATTERNS) {
    const m = msg.match(re)
    if (m) return t(key, ...m.slice(1))
  }
  return msg
}
