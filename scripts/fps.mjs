import { chromium } from 'playwright'
const [, , screen = 'studio', q = '', throttle = '1', w = '390', h = '844'] = process.argv
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: +w, height: +h } })
await p.goto('http://localhost:4173/bratz/?' + q)
await p.waitForSelector('[data-screen]', { timeout: 90000 })
const cdp = await p.context().newCDPSession(p)
await p.evaluate((s) => { const st = window.__clara.store.getState(); st.finishOnboarding(); st.go(s) }, screen)
await p.waitForTimeout(4000)
await cdp.send('Emulation.setCPUThrottlingRate', { rate: +throttle })
const fps = await p.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 10000) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)) }; requestAnimationFrame(f) }))
const q2 = await p.evaluate(() => window.__clara.store.getState().quality)
console.log(screen, q, 'throttle', throttle, 'fps', fps.toFixed(1), 'quality', q2)
await b.close()
