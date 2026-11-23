// Foydalanuvchilarni boshqarish (server konsolidan):
//   npm run user -- list
//   npm run user -- add <login> "<Ism>" [admin|seller]   → parol avtomatik yaratiladi va chiqariladi
//   npm run user -- reset <login>                        → yangi parol
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDb } from './db.js'
import { Auth } from './auth.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = process.env.DATA_DIR ?? join(ROOT, 'data')
const store = openDb(join(DATA_DIR, 'ombor.db'))
const auth = new Auth(store.db)
const [cmd, a, b, c] = process.argv.slice(2)

try {
  if (cmd === 'list') {
    for (const u of auth.list()) console.log(`${u.login.padEnd(16)} ${u.role.padEnd(7)} ${u.active ? '' : '(o\'chirilgan) '}${u.name}`)
  } else if (cmd === 'add' && a && b) {
    const r = auth.create({ login: a, name: b, role: c ?? 'seller' })
    console.log(`Yaratildi: ${r.user.login} (${r.user.role})\nParol: ${r.password}`)
  } else if (cmd === 'reset' && a) {
    const u = auth.list().find((x) => x.login === a.toLowerCase())
    if (!u) throw new Error('Topilmadi: ' + a)
    console.log(`Yangi parol (${u.login}): ${auth.resetPassword(u.id).password}`)
  } else {
    console.log('Foydalanish:\n  npm run user -- list\n  npm run user -- add <login> "<Ism>" [admin|seller]\n  npm run user -- reset <login>')
  }
} catch (e) {
  console.error('Xato:', e.message)
  process.exit(1)
}
