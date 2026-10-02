import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { r3fCatalogue } from './scripts/r3f-catalogue.mjs'

// App instalable: registra el service worker y le pasa la lista de archivos a guardar para jugar sin conexión.
function pwa(): Plugin {
  let outDir = 'dist'
  return {
    name: 'rumbo-pwa',
    apply: 'build',
    configResolved(c) {
      outDir = path.resolve(c.root, c.build.outDir)
    },
    transformIndexHtml() {
      return [
        {
          tag: 'script',
          injectTo: 'body',
          children: "if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}))",
        },
      ]
    },
    closeBundle() {
      const files: string[] = []
      const walk = (dir: string) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, e.name)
          if (e.isDirectory()) walk(p)
          else files.push(path.relative(outDir, p).split(path.sep).join('/'))
        }
      }
      walk(outDir)
      // .woff sobra: todos los navegadores con service worker usan .woff2
      const precache = files.filter((f) => f !== 'sw.js' && !f.endsWith('.woff')).sort()
      const hash = createHash('sha256')
      for (const f of precache) hash.update(f).update(fs.readFileSync(path.join(outDir, f)))
      const swPath = path.join(outDir, 'sw.js')
      const sw = fs
        .readFileSync(swPath, 'utf8')
        .replace("const VERSION = 'dev'", `const VERSION = '${hash.digest('hex').slice(0, 12)}'`)
        .replace('const PRECACHE = []', `const PRECACHE = ${JSON.stringify(precache)}`)
      fs.writeFileSync(swPath, sw)
    },
  }
}

// GitHub Pages sirve el proyecto en /<repo>/
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? (process.env.BASE_PATH ?? '/bratz/') : '/',
  plugins: [react(), pwa(), r3fCatalogue()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
}))
