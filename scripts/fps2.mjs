import { chromium } from 'playwright'
const [, , q = 'q=baja&dpr=0.5', hide = ''] = process.argv
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 390, height: 844 } })
await p.goto('http://localhost:4173/bratz/?' + q)
await p.waitForSelector('[data-screen]', { timeout: 90000 })
await p.evaluate(() => { const st = window.__clara.store.getState(); st.finishOnboarding(); st.go('studio') })
if (process.env.NOBLUR) await p.addStyleTag({ content: '*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}' })
await p.waitForTimeout(4000)
const info = await p.evaluate((hide) => {
  const sc = window.__clara.interaction.scene
  let meshes = 0, verts = 0
  sc.traverse((o) => { if (o.isMesh || o.isPoints) { meshes++; verts += o.geometry?.attributes?.position?.count ?? 0 } })
  if (hide === 'doll') sc.traverse((o) => { if (o.name?.startsWith('doll-')) o.visible = false })
  if (hide === 'all') sc.children.forEach((c) => (c.visible = false))
  const r = window.__clara.interaction.gl.info.render
  return { meshes, verts, calls: r.calls, tris: r.triangles }
}, hide)
const fps = await p.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 6000) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)) }; requestAnimationFrame(f) }))
console.log(hide || 'full', JSON.stringify(info), 'fps', fps.toFixed(1))
await b.close()
