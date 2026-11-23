import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Lokal tarmoq uchun o'z-o'zidan imzolangan sertifikat.
 * Telefon brauzerlari kamerani faqat HTTPS sahifada beradi.
 * IP manzil o'zgarsa sertifikat qayta yaratiladi.
 */
export function ensureCert(dir, ips) {
  mkdirSync(dir, { recursive: true })
  const key = join(dir, 'key.pem')
  const cert = join(dir, 'cert.pem')
  const ipsFile = join(dir, 'ips.txt')
  const want = ['127.0.0.1', ...ips].sort().join(',')
  if (existsSync(key) && existsSync(cert) && existsSync(ipsFile) && readFileSync(ipsFile, 'utf8') === want) return { key, cert }

  const san = ['DNS:localhost', ...want.split(',').map((ip) => `IP:${ip}`)].join(',')
  const conf = join(dir, 'openssl.cnf')
  writeFileSync(conf, `[req]
distinguished_name = dn
x509_extensions = ext
prompt = no
[dn]
CN = Ombor
[ext]
subjectAltName = ${san}
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
`)
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '825', '-keyout', key, '-out', cert, '-config', conf], { stdio: 'ignore' })
  writeFileSync(ipsFile, want)
  return { key, cert }
}
