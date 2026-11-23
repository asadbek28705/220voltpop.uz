# Ombor — qurilish va santexnika do'koni

Do'kon ombori va kassasi: tovarlar, shtrix-kod skaneri, savdo va cheklar, kirim, inventarizatsiya, hisobotlar.
Do'kondagi bitta kompyuter server bo'lib ishlaydi, ishchilar telefondan Wi-Fi orqali ulanadi.

## Ishga tushirish (do'kon kompyuterida)

Node.js 22.13+ kerak (24 tavsiya etiladi).

```bash
npm install
npm start
```

Terminalda manzillar chiqadi:

- Shu kompyuterda: `http://localhost:8080`
- Telefonlardan: `https://192.168.x.x:8443` — telefon shu Wi-Fi tarmoqqa ulangan bo'lishi kerak

Telefonda birinchi marta "Ulanish xavfsiz emas" degan ogohlantirish chiqadi (sertifikat do'konning o'zida yaratilgan).
"Qo'shimcha" → "Baribir o'tish" ni bosing. Kamera faqat `https://` manzilda ishlaydi.

### macOS firewall

Agar telefonlar ulana olmasa: **System Settings → Network → Firewall → Options** —
"Block all incoming connections" ni o'chiring va `node` ga kiruvchi ulanishlarga ruxsat bering.

## Shtrix-kod

- **Skaner aparati** (USB yoki Bluetooth): istalgan sahifada skaner qiling. Kassada tovar savatga tushadi,
  boshqa sahifalarda tovar kartasi (narx, qoldiq, joyi) chiqadi. Noma'lum kod — yangi tovar qo'shish taklif qilinadi.
- **Telefon kamerasi**: Kassadagi kamera tugmasi yoki boshqa sahifalardagi pastki o'ng tugma.
- Tovarga shtrix-kod biriktirish: Tovarlar → tahrirlash → "Shtrix-kod" maydoniga skaner qiling.

## Kassa va cheklar

Kassa sahifasi telefonga moslangan (telefonda dastur shu sahifadan ochiladi). Skaner → savat → to'lov usuli → "Sotish".
Sotuvdan keyin chek chiqadi (58/80 mm termoprinter yoki oddiy printer). Eski cheklar: Savdolar → chek raqami.
Do'kon nomi, manzil, telefon — Sozlamalar → Chek ma'lumotlari. Har bir ishchi o'z telefonida ismini Sozlamalarda yozadi.

## Ma'lumotlar

SQLite bazasi: `data/ombor.db`. Sozlamalar → "Zaxira yuklab olish" bilan muntazam zaxira oling.

## Dasturchilar uchun

```bash
npm run dev   # server (8080) + Vite dev server, /api proksi qilinadi
```

```
server/
├── index.js    # Express: API, SSE (real vaqt yangilanish), HTTP 8080 + HTTPS 8443
├── db.js       # SQLite (node:sqlite), tranzaksiyalar, qoldiq tekshiruvi
├── cert.js     # LAN uchun o'z-o'zidan imzolangan sertifikat
└── seed.js     # Namuna ma'lumotlar
src/
├── store.ts    # Server bilan sinxronlash (faqat o'zgarganlar olinadi)
├── hooks/      # useHardwareScanner, useCart
└── components/ # Pos (kassa), Receipt, CameraScanner, Reports, ...
```
