import { chromium } from 'playwright'
const [, , q = 'q=baja&dpr=0.5'] = process.argv
const extra = (process.env.FLAGS ?? '').split(' ').filter(Boolean)
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', ...extra] })
const p = await b.newPage({ viewport: { width: 390, height: 844 } })
await p.goto('http://localhost:4173/bratz/?' + q)
await p.getByTestId('start').click()
await p.waitForSelector('[data-screen]', { timeout: 90000 })
await p.evaluate(() => { const st = window.__clara.store.getState(); st.finishOnboarding(); st.go('studio') })
if (process.env.CSS) await p.addStyleTag({ content: process.env.CSS })
if (process.env.HIDE) await p.evaluate(() => window.__clara.interaction.scene.children.forEach((c) => (c.visible = false)))
if (process.env.BASIC) await p.evaluate(() => { const sc = window.__clara.interaction.scene; const seen = new Map(); sc.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshPhysicalMaterial) { let m = seen.get(o.material); if (!m) { m = new (Object.getPrototypeOf(Object.getPrototypeOf(o.material)).constructor)(); m.color.copy(o.material.color); m.map = o.material.map; seen.set(o.material, m) } o.material = m } }) })
if (process.env.LAMBERT) await p.evaluate(() => { const sc = window.__clara.interaction.scene; const L = sc.children.find(()=>1); sc.traverse((o) => { if (o.isMesh && o.material && (o.material.isMeshPhysicalMaterial || o.material.isMeshStandardMaterial)) { const M = window.__clara.three?.MeshLambertMaterial; } }) })
if (process.env.NOENV) await p.evaluate(() => { window.__clara.interaction.scene.environment = null })
await p.waitForTimeout(15000)
const r = await p.evaluate(() => new Promise((res) => {
  const gl = window.__clara.interaction.gl
  const orig = gl.render.bind(gl)
  let rt = 0, rn = 0
  gl.render = (s, c) => { const t = performance.now(); orig(s, c); rt += performance.now() - t; rn++ }
  const ctx = gl.getContext()
  let ft = 0, fn = 0, last = performance.now()
  const t0 = performance.now()
  const f = () => { const n = performance.now(); ft += n - last; last = n; fn++; if (n - t0 < 5000) requestAnimationFrame(f); else { const t = performance.now(); ctx.finish(); const fin = performance.now() - t; res({ fps: fn / 5, avgFrame: ft / fn, renderMs: rt / rn, renders: rn, finishMs: fin, calls: gl.info.render.calls }) } }
  requestAnimationFrame(f)
}))
console.log(q, JSON.stringify(r))
await b.close()
