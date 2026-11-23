# Ombor — qurilish va santexnika do'koni

Do'kon ombori uchun oddiy hisob dasturi: mahsulotlar, kirim, chiqim (sotuv), inventarizatsiya, tarix va hisobotlar.

## Ishga tushirish

```bash
npm install
npm run dev
```

Brauzerda Vite ko'rsatgan manzilni oching (odatda http://localhost:5173).

## Imkoniyatlar

- **Mahsulotlar** — nomi, artikul, kategoriya, o'lchov birligi (dona, qop, metr, kg, litr...), kelish/sotuv narxi, minimal qoldiq, javondagi joyi
- **Kirim** — yetkazib beruvchidan qabul; kelish narxi avtomatik yangilanadi
- **Chiqim / Sotuv** — mijoz yoki obyektga; omborda yo'q miqdorni chiqarib bo'lmaydi, foyda ko'rsatiladi
- **Inventarizatsiya** — haqiqiy sanoq natijasini kiritasiz, farq tarixga yoziladi
- **Bosh sahifa** — ombor qiymati, bugungi sotuv/kirim, kam qolgan mahsulotlar
- **Tarix** — sana, tur bo'yicha filtr, kirim/sotuv summasi, taxminiy foyda, yozuvni bekor qilish
- **Excel (CSV)** eksport, **JSON zaxira** olish va tiklash

## Ma'lumotlar qayerda saqlanadi

Hozircha brauzerning `localStorage`ida (bitta kompyuterda). Bir nechta kompyuter yoki telefondan ishlash uchun keyingi bosqichda server va ma'lumotlar bazasi qo'shiladi.

## Tuzilishi

```
src/
├── types.ts          # Mahsulot, harakat turlari, kategoriyalar
├── store.ts          # Ma'lumotlar va amallar (useWarehouse)
├── seed.ts           # Namuna mahsulotlar
├── utils.ts          # Formatlash, CSV, yuklab olish
└── components/       # Dashboard, Products, History, Settings, dialoglar
```
