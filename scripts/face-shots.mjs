// Banco de capturas de la cara: 4 muñecas × 6 expresiones × 3 maquillajes, de frente y a ¾.
// Uso: node scripts/face-shots.mjs <ronda> [muñecas separadas por comas]
// Requiere el servidor de desarrollo (la vista de desarrollo solo existe en dev): npx vite --port 5173
// Después: python3 scripts/grid.py para las hojas de contactos (lo lanza este script al final).
import { chromium } from 'playwright'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

const [, , round = 'r0', dollList = 'clara,nayra,vega,alba'] = process.argv
const base = process.env.URL ?? 'http://localhost:5173/'
const dir = `docs/screenshots/cara/${round}`
const raw = `${dir}/sueltas`
fs.mkdirSync(raw, { recursive: true })

const dolls = dollList.split(',')
const exprs = ['sonrisa', 'dientes', 'risa', 'guino', 'sorpresa', 'seria']
const makeups = ['propio', 'natural', 'fiesta']
// rot = giro de la cámara alrededor de la muñeca (radianes); 0,6 ≈ ¾
const views = [
  ['frente', 0],
  ['tres-cuartos', 0.6],
]

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: 360, height: 400 }, deviceScaleFactor: 2 })
page.setDefaultTimeout(180_000)
const errs = []
page.on('console', (m) => m.type() === 'error' && errs.push(m.text()))
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))

const shots = []
for (const doll of dolls) {
  for (const [view, rot] of views) {
    // a ¾ basta con el maquillaje propio
    for (const mk of view === 'frente' ? makeups : ['propio']) {
      for (const expr of exprs) {
        const name = `${doll}-${view}-${mk}-${expr}`
        await page.goto(`${base}?cam=face&doll=${doll}&rot=${rot}&mk=${mk}&expr=${expr}`)
        await page.locator('canvas').waitFor({ timeout: 60_000 })
        await page.waitForTimeout(1800)
        await page.screenshot({ path: `${raw}/${name}.png` })
        shots.push(name)
        process.stdout.write('.')
      }
    }
  }
}
console.log(`\n${shots.length} capturas en ${raw}`)
if (errs.length) console.log('ERRORES:\n' + [...new Set(errs)].join('\n'))
await browser.close()

// Hojas de contactos: una por muñeca (filas = maquillaje/vista, columnas = expresión) y una general.
for (const doll of dolls) {
  const rows = [...makeups.map((mk) => `frente-${mk}`), 'tres-cuartos-propio']
  const files = rows.flatMap((r) => exprs.map((e) => `${raw}/${doll}-${r}-${e}.png`))
  execFileSync('python3', ['scripts/grid.py', `${dir}/${doll}.png`, String(exprs.length), ...files])
}
const all = dolls.flatMap((d) => exprs.map((e) => `${raw}/${d}-frente-propio-${e}.png`))
execFileSync('python3', ['scripts/grid.py', `${dir}/todas.png`, String(exprs.length), ...all])
console.log(`Hojas en ${dir}`)
