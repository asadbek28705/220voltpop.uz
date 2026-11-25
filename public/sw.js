// Ilova (PWA/APK) uchun service worker. Ma'lumotlarni keshlamaydi — har doim serverdan yangi.
// Internet yo'q bo'lsa, faqat "aloqa yo'q" sahifasini ko'rsatadi.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return
  e.respondWith(fetch(e.request).catch(() => new Response(
    '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<body style="margin:0;display:grid;place-items:center;min-height:100vh;font-family:system-ui;background:#F3F5F9;color:#0F172A;text-align:center">' +
    '<div><div style="font-size:56px">⚡</div><h2>Internet aloqasi yo\'q</h2><p style="color:#64748B">Aloqa tiklangach, sahifani yangilang.</p>' +
    '<button onclick="location.reload()" style="margin-top:12px;padding:12px 24px;border:0;border-radius:12px;background:#16A363;color:#fff;font-size:16px;font-weight:700">Qayta urinish</button></div>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } })))
})
