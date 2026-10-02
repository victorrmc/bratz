// node scripts/flow.mjs out-prefix w h "click:menu-studio" "wait:1500" "shot:studio" ...
import { chromium } from 'playwright'
const [, , prefix, w, h, ...steps] = process.argv
const base = process.env.URL ?? 'http://localhost:5173/'
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const ctx = await browser.newContext({ viewport: { width: +w, height: +h } })
const page = await ctx.newPage()
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text().slice(0, 300)) })
page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
await page.goto(base + (process.env.Q ?? ''))
await page.getByTestId('start').click()
await page.waitForSelector('[data-screen]', { timeout: 60000 })
for (const s of steps) {
  const [cmd, ...rest] = s.split(':')
  const arg = rest.join(':')
  if (cmd === 'click') await page.getByTestId(arg).click({ timeout: 20000 })
  else if (cmd === 'wait') await page.waitForTimeout(+arg)
  else if (cmd === 'shot') await page.screenshot({ path: `${prefix}-${arg}.png` })
  else if (cmd === 'drag') { const [x1, y1, x2] = arg.split(',').map(Number); await page.mouse.move(x1, y1); await page.mouse.down(); await page.mouse.move(x2, y1, { steps: 8 }); await page.mouse.up() }
  else if (cmd === 'eval') await page.evaluate(arg)
}
await browser.close()
