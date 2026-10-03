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

// Huella del código que genera la geometría de la muñeca. Va en las claves de la
// caché de IndexedDB (src/three/geoCache.ts): si cambia este código, la geometría
// guardada en los móviles deja de usarse y se regenera.
const GEO_SOURCES = ['src/three/geo.ts', 'src/three/body.ts', 'src/three/dollGeo.ts', 'src/three/nails.ts', 'src/three/hair.ts', 'src/three/geoCache.ts', 'src/data/hair.ts', 'src/data/characters.ts']
function geoVersion() {
  const h = createHash('sha256')
  for (const f of GEO_SOURCES) h.update(fs.readFileSync(path.resolve(__dirname, f)))
  return h.digest('hex').slice(0, 12)
}

// GitHub Pages sirve el proyecto en /<repo>/
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? (process.env.BASE_PATH ?? '/bratz/') : '/',
  plugins: [react(), pwa(), r3fCatalogue()],
  // en desarrollo no se usa IndexedDB (el código cambia sin cambiar la huella)
  define: { __GEO_VERSION__: JSON.stringify(command === 'build' || isPreview ? geoVersion() : 'dev') },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Rolldown ya separa three + react-three-fiber en un trozo propio; aquí solo
        // se le da un nombre reconocible (si no, se llamaría como un módulo interno de r3f).
        chunkFileNames(chunk) {
          return chunk.moduleIds.some((id) => /node_modules[\\/]three[\\/]build[\\/]three\.core/.test(id)) ? 'assets/motor-3d-[hash].js' : 'assets/[name]-[hash].js'
        },
      },
    },
  },
}))
