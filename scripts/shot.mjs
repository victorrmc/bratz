// Uso: node scripts/shot.mjs "<query>" out.png [w h]
import { chromium } from 'playwright'
const [, , query = '', out = 'shot.png', w = '600', h = '900'] = process.argv
const base = process.env.URL ?? 'http://localhost:5173/'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await browser.newPage({ viewport: { width: +w, height: +h } })
const errs = []
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()) })
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
await page.goto(base + '?' + query)
await page.waitForTimeout(+(process.env.WAIT ?? 2500))
await page.screenshot({ path: out })
if (errs.length) console.log(errs.slice(0, 10).join('\n'))
await browser.close()
