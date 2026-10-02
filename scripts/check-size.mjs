// Comprueba que la carga inicial (HTML, JS de entrada, módulos precargados, CSS y sus fuentes) no pasa de 1,5 MB gzip.
// Uso: npm run build && node scripts/check-size.mjs
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const LIMIT = 1.5 * 1024 * 1024
const dist = 'dist'
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
const local = (url) => path.join(dist, url.replace(/^(\.\/|\/[^/]+\/|\/)/, ''))
const files = new Set([path.join(dist, 'index.html')])
for (const [, url] of html.matchAll(/<(?:script[^>]+src|link[^>]+href)="([^"]+\.(?:js|css))"/g)) files.add(local(url))
// fuentes .woff2 que usa el CSS inicial (ya van comprimidas: cuentan tal cual)
for (const f of [...files].filter((f) => f.endsWith('.css'))) {
  for (const [, url] of fs.readFileSync(f, 'utf8').matchAll(/url\(([^)]+\.woff2)\)/g)) files.add(path.join(path.dirname(f), path.basename(url)))
}
const kb = (n) => `${(n / 1024).toFixed(1)} kB`
let total = 0
for (const f of files) {
  const buf = fs.readFileSync(f)
  const size = f.endsWith('.woff2') ? buf.length : zlib.gzipSync(buf, { level: 9 }).length
  total += size
  console.log(`${kb(size).padStart(10)}  ${path.relative(dist, f)}`)
}
let all = 0
for (const f of fs.readdirSync(path.join(dist, 'assets'))) if (!f.endsWith('.woff')) all += zlib.gzipSync(fs.readFileSync(path.join(dist, 'assets', f))).length
console.log(`\nCarga inicial: ${kb(total)} gzip (límite ${kb(LIMIT)})`)
console.log(`Juego completo (lo que guarda el modo sin conexión): ${kb(all)} gzip`)
if (total > LIMIT) {
  console.error('❌ La carga inicial supera el límite de 1,5 MB gzip')
  process.exit(1)
}
console.log('✅ Dentro del límite')
