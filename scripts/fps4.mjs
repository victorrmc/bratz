import { chromium } from 'playwright'
const [, , mode = 'none', dpr = '0.5'] = process.argv
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 390, height: 844 } })
await p.goto(`http://localhost:4173/bratz/?q=baja&dpr=${dpr}`)
await p.waitForSelector('[data-screen]', { timeout: 90000 })
await p.evaluate(() => { const st = window.__clara.store.getState(); st.finishOnboarding(); st.go('studio') })
await p.waitForTimeout(6000)
await p.evaluate((mode) => {
  const sc = window.__clara.interaction.scene
  const T = sc.children[0].constructor
  sc.traverse((o) => {
    if (!o.isMesh) return
    if (mode === 'lambert') { const m = o.material; const n = new (Object.getPrototypeOf(Object.getPrototypeOf(m)).constructor)(); o.material.dispose; o.material = Object.assign(o.material.clone(), { sheen: 0, clearcoat: 0, iridescence: 0 }) }
  })
  let doll = null
  sc.traverse((o) => { if (o.name && o.name.startsWith('doll-')) doll = o })
  if (mode === 'nodoll') doll.visible = false
  if (mode === 'onlydoll') sc.children.forEach((c) => { let has = false; c.traverse((x) => { if (x === doll) has = true }); if (!has) c.visible = false })
  if (mode === 'stats') {
    let calls = 0, verts = 0
    doll.traverse((x) => { if (x.isMesh && x.visible) { calls++; verts += x.geometry.attributes.position.count } })
    window.__stats = { dollCalls: calls, dollVerts: verts }
  }
  sc.traverse((o) => {
  })
}, mode)
await p.waitForTimeout(3000)
const fps = await p.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 5000) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)) }; requestAnimationFrame(f) }))
console.log(mode, dpr, 'fps', fps.toFixed(1), JSON.stringify(await p.evaluate(() => window.__stats ?? null)))
await b.close()
