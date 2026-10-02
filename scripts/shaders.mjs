import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 390, height: 844 } })
await p.addInitScript(() => {
  window.__cs = []
  const P = WebGL2RenderingContext.prototype
  const orig = P.compileShader
  P.compileShader = function (s) { window.__cs.push(new Error().stack.split('\n').slice(2, 7).join(' | ')); return orig.call(this, s) }
  const g = P.getShaderParameter
  window.__gsp = 0
  P.getShaderParameter = function (...a) { window.__gsp++; return g.apply(this, a) }
  const gsi = P.getShaderInfoLog
  window.__gsi = []
  P.getShaderInfoLog = function (...a) { if (window.__track && window.__gsi.length < 4) window.__gsi.push(new Error().stack.split('\n').slice(2, 14).join(' | ')); return gsi.apply(this, a) }
  const gp = P.getProgramParameter
  window.__gpp = 0; window.__gppStacks = []
  P.getProgramParameter = function (...a) { window.__gpp++; if (window.__gppStacks.length < 5 && window.__track) window.__gppStacks.push(new Error().stack.split('\n').slice(2, 9).join(' | ')); return gp.apply(this, a) }
})
await p.goto('http://localhost:4173/bratz/?q=baja&dpr=0.5')
await p.waitForSelector('[data-screen]', { timeout: 90000 })
await p.evaluate(() => { const st = window.__clara.store.getState(); st.finishOnboarding(); st.go('studio') })
await p.waitForTimeout(8000)
const before = await p.evaluate(() => ({ cs: window.__cs.length, gsp: window.__gsp, gpp: window.__gpp }))
await p.evaluate(() => { window.__track = true })
await p.waitForTimeout(3000)
const after = await p.evaluate(() => ({ cs: window.__cs.length, gsp: window.__gsp, gpp: window.__gpp, stacks: window.__gppStacks, last: window.__cs.slice(-3), gsi: window.__gsi }))
console.log(JSON.stringify(before), JSON.stringify(after, null, 1))
await b.close()
