// Genera los PNG de la app instalable a partir de public/icon.svg. Uso: node scripts/icons.mjs
import fs from 'node:fs'
import { chromium } from 'playwright'
const svg = fs.readFileSync('public/icon.svg', 'utf8')
const out = [
  ['public/icon-192.png', 192, 0, true],
  ['public/icon-512.png', 512, 0, true],
  ['public/icon-maskable-512.png', 512, 0, false], // sin redondear: el sistema recorta
  ['public/apple-touch-icon.png', 180, 0, false], // iOS redondea por su cuenta
]
const browser = await chromium.launch()
const page = await browser.newPage()
for (const [file, size, , round] of out) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px;overflow:hidden;border-radius:${round ? size * 0.22 : 0}px">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</div></body></html>`,
  )
  await page.screenshot({ path: file, omitBackground: true })
  console.log(file, fs.statSync(file).size)
}
await browser.close()
