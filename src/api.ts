import { getSeller } from './device'
import { t as tr, tServer } from './i18n'

export class ApiError extends Error {}

export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch('/api' + path, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Seller': encodeURIComponent(getSeller()) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(tr("Server bilan aloqa yo'q. Wi-Fi ni tekshiring."))
  }
  const data = await res.json().catch(() => ({}))
  // Sessiya tugagan — login sahifasiga qaytarish
  if (res.status === 401 && path !== '/login') window.dispatchEvent(new Event('ombor-unauthorized'))
  if (!res.ok) throw new ApiError(data.error ? tServer(data.error) : tr('Xato: {0}', res.status))
  return data as T
}

/** Xatoni matn sifatida qaytaradi (UI uchun qulay) */
export async function attempt<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    return { ok: true, value: await fn() }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
