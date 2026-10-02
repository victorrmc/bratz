import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })
const p = await b.newPage()
p.on('response', r => { if (r.status() >= 400) console.log(r.status(), r.url()) })
p.on('pageerror', e => console.log('ERR', e.message))
p.on('console', m => console.log('C', m.type(), m.text().slice(0,200)))
await p.goto('http://localhost:4173/bratz/')
await p.waitForTimeout(8000)
await b.close()
