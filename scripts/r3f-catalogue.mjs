// Plugin de Vite: catálogo reducido de react-three-fiber.
//
// <Canvas> de r3f registra el namespace entero de three (`extend(THREE)`) para
// poder crear cualquier elemento JSX (<mesh>, <fog>…). Eso obliga a incluir
// toda la librería en el bundle, aunque el juego use una parte. Al compilar,
// este plugin busca los elementos JSX en minúscula que aparecen en `src/` y en
// drei/postprocessing, y sustituye esa llamada por un catálogo con solo esas
// clases. Así el tree-shaking puede quitar el resto de three.
import fs from 'node:fs'
import path from 'node:path'

const R3F_ENTRY = /@react-three[\\/]fiber[\\/]dist[\\/]react-three-fiber\.esm\.js$/

function walk(dir, exts, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, exts, out)
    else if (exts.some((x) => e.name.endsWith(x))) out.push(p)
  }
  return out
}

const JSX_CALL = /(?:jsxs?|jsxDEV|createElement)\(\s*["']([a-z][A-Za-z0-9]*)["']/g

/** Archivo de drei que exporta un componente (core/<Nombre>.js) y los que importa en relativo. */
function dreiFiles(root, names) {
  const core = path.join(root, 'node_modules', '@react-three', 'drei', 'core')
  const seen = new Set()
  const visit = (f) => {
    if (seen.has(f) || !fs.existsSync(f)) return
    seen.add(f)
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) visit(path.resolve(path.dirname(f), m[1]))
  }
  for (const n of names) visit(path.join(core, `${n}.js`))
  return [...seen]
}

/** Elementos JSX en minúscula usados por el juego y por los componentes de drei/postprocessing que importa. */
export function collectIntrinsics(root) {
  const names = new Set()
  const drei = new Set()
  for (const f of walk(path.join(root, 'src'), ['.ts', '.tsx'])) {
    const code = fs.readFileSync(f, 'utf8')
    if (f.endsWith('.tsx')) for (const m of code.matchAll(/<([a-z][A-Za-z0-9]*)[\s/>]/g)) names.add(m[1])
    for (const m of code.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]@react-three\/drei['"]/g)) {
      for (const n of m[1].split(',')) if (n.trim()) drei.add(n.trim().split(/\s+as\s+/)[0])
    }
  }
  const libs = [...dreiFiles(root, drei), ...walk(path.join(root, 'node_modules', '@react-three', 'postprocessing', 'dist'), ['.js'])]
  for (const f of libs) for (const m of fs.readFileSync(f, 'utf8').matchAll(JSX_CALL)) names.add(m[1])
  return names
}

export function r3fCatalogue() {
  let classes = []
  let root = process.cwd()
  return {
    name: 'r3f-catalogue',
    apply: 'build',
    enforce: 'pre',
    configResolved(c) {
      root = c.root
    },
    async buildStart() {
      const THREE = await import('three')
      classes = [...collectIntrinsics(root)]
        .map((n) => n[0].toUpperCase() + n.slice(1))
        .filter((n) => typeof THREE[n] === 'function')
        .sort()
    },
    transform(code, id) {
      if (!R3F_ENTRY.test(id)) return null
      if (!code.includes('extend(THREE)')) this.error('r3f-catalogue: no se encuentra extend(THREE) en react-three-fiber')
      const imports = classes.map((c) => `${c} as __r3f_${c}`).join(', ')
      const entries = classes.map((c) => `${c}: __r3f_${c}`).join(', ')
      return {
        code: `import { ${imports} } from 'three';\nconst __R3F_CATALOGUE__ = { ${entries} };\n` + code.replace('extend(THREE)', 'extend(__R3F_CATALOGUE__)'),
        map: null,
      }
    },
  }
}
