// Perfil rápido en un móvil real (Chrome remote debugging).
//
// 1. En el móvil Android: Ajustes → Opciones de desarrollador → Depuración USB.
// 2. Conéctalo por USB y abre chrome://inspect en el ordenador.
// 3. Abre el juego en el Chrome del móvil, pulsa «Toca para empezar» y entra en el Estudio.
// 4. En chrome://inspect pulsa «inspect» y pega este archivo entero en la consola.
//    Tarda 10 s y devuelve una tabla con los datos (cópiala y pásamela).
//    Para la carga en frío: borra los datos del sitio, recarga y vuelve a pegarlo.
;(async () => {
  const c = window.__clara
  if (!c?.interaction?.gl) return console.warn('Abre primero el 3D (pulsa «Toca para empezar»).')
  const listo = performance.getEntriesByName('rumbo:3d-listo')[0]
  const toque = performance.getEntriesByName('rumbo:toque')[0]
  const frames = await new Promise((res) => {
    const s = []
    let last = performance.now()
    const t0 = last
    const f = () => {
      const n = performance.now()
      s.push(n - last)
      last = n
      if (n - t0 < 10000) requestAnimationFrame(f)
      else res(s)
    }
    requestAnimationFrame(f)
  })
  const sorted = [...frames].sort((a, b) => a - b)
  const g = c.interaction.gl
  const r = {
    dispositivo: navigator.userAgent.replace(/.*\(([^)]*)\).*/, '$1'),
    pantalla: c.store.getState().screen,
    calidad: c.store.getState().quality,
    lienzo: `${g.domElement.width}x${g.domElement.height}`,
    fps: +(frames.length / 10).toFixed(1),
    'fotograma p95 (ms)': +sorted[Math.floor(sorted.length * 0.95)].toFixed(1),
    'carga 3D desde el toque (s)': listo && toque ? +((listo.startTime - toque.startTime) / 1000).toFixed(2) : 'sin marca',
    'geometría desde': window.__claraGeo?.source,
    'geometría lista en (ms)': window.__claraGeo?.ms,
    programas: g.info.programs.length,
    'llamadas de dibujo': g.info.render.calls,
    triángulos: g.info.render.triangles,
    'compilación paralela': g.extensions.has('KHR_parallel_shader_compile'),
    memoria: navigator.deviceMemory ?? '?',
    núcleos: navigator.hardwareConcurrency,
  }
  console.table(r)
  return r
})()
