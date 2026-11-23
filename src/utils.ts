export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

export const fmtMoney = (n: number) =>
  Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + " so'm"

export const fmtUsd = (n: number) => '$' + (Math.round(n * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 })

/** Dollar → so'm tannarx */
export const toUzs = (usd: number, rate: number) => Math.round(usd * rate)
/** Sotuv narxi tannarx + ustamadan: 100 so'mga yuqoriga yaxlitlanadi (serverdagi bilan bir xil) */
export const sellFrom = (costUzs: number, markup: number) => Math.ceil((costUzs * (1 + markup / 100)) / 100) * 100

export const fmtNum = (n: number) => {
  const r = Math.round(n * 100) / 100
  const [i, d] = r.toString().split('.')
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (d ? ',' + d : '')
}

export const fmtDate = (iso: string) => {
  const d = new Date(iso)
  const p = (x: number) => x.toString().padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

export function toCsv(rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v)
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  // Excel uchun BOM va ";" ajratgich
  return '﻿' + rows.map((r) => r.map(esc).join(';')).join('\n')
}
