import { ContactShadows, RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { AmbientParticles, AmbientSky, GlamEnvironment, seeded, ThreePointLights } from '../env'
import { FloatingGlints } from '../effects'
import { Bulbs, FloatingShape, GlossyFloor, Islet, NeonTube, Palm, WhiteHouse } from './common'
import { patternTexture } from '../textures'
import { extrude, heartShape, roundedRectShape, starShape } from '../geo'
import DaltVila from './DaltVila'

// Escenarios de la sesión de fotos (y fondos de los retos).

function Shadow({ quality, y = 0.002, color = '#5a2a4a' }: { quality: string; y?: number; color?: string }) {
  if (quality === 'baja') return null
  return <ContactShadows position={[0, y, 0]} opacity={0.55} scale={2.4} blur={2.4} far={1.6} resolution={512} color={color} />
}

// ───────────────────── Piezas animadas ─────────────────────

/** Tubo de neón que zumba y, de vez en cuando, parpadea como uno de verdad. */
function FlickerNeon({ seed = 1, ...props }: React.ComponentProps<typeof NeonTube> & { seed?: number }) {
  const ref = useRef<THREE.Group>(null)
  const base = useRef<THREE.Color | null>(null)
  useFrame((s) => {
    const mesh = ref.current?.children[0] as THREE.Mesh | undefined
    if (!mesh) return
    const mat = mesh.material as THREE.MeshBasicMaterial
    base.current ??= mat.color.clone()
    const t = s.clock.elapsedTime
    // ventana de fallo cada ~7 s, desfasada por tubo; dentro, apagones rápidos
    const w = (t * 0.14 + seed * 0.37) % 1
    let k = 0.93 + 0.07 * Math.sin(t * 47 + seed * 3)
    if (w < 0.07) {
      const r = Math.sin(Math.floor(t * 24) * 12.9898 * seed) * 43758.5453
      k = r - Math.floor(r) > 0.45 ? 1 : 0.08
    }
    mat.color.copy(base.current).multiplyScalar(k)
  })
  return (
    <group ref={ref}>
      <NeonTube {...props} />
    </group>
  )
}

const SEA_VERT = `
uniform float uT; uniform vec2 uFlow; uniform float uAmp; uniform float uShore;
varying vec3 vW;
float swell(vec2 p){ return sin(dot(p, vec2(0.28, 0.96)) * 1.3 + uT * 1.1) * 0.6 + sin(dot(p, vec2(-0.7, 0.71)) * 0.9 + uT * 0.8) * 0.4; }
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  float fade = smoothstep(uShore, uShore - 4.0, w.z) * (1.0 - smoothstep(-25.0, -45.0, w.z));
  w.y += swell(w.xz + uFlow * uT) * uAmp * fade;
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`
const SEA_FRAG = `
uniform float uT; uniform vec2 uFlow; uniform vec3 uColor; uniform vec3 uSun; uniform vec3 uHorizon;
uniform vec3 uSunDir; uniform float uSunX; uniform float uZ0;
varying vec3 vW;
vec2 wv(vec2 p, vec2 d, float k, float sp, float a){ float ph = dot(d, p) * k + uT * sp; return d * (k * a * cos(ph)); }
void main(){
  vec2 p = vW.xz + uFlow * uT;
  vec2 g = wv(p, vec2(0.28, 0.96), 1.3, 1.1, 0.06) + wv(p, vec2(-0.7, 0.71), 0.9, 0.8, 0.04)
         + wv(p, vec2(0.89, 0.45), 3.7, 2.3, 0.018) + wv(p, vec2(-0.32, 0.95), 6.1, 3.1, 0.009)
         + wv(p, vec2(0.6, -0.8), 9.3, 4.0, 0.004);
  float dist = length(cameraPosition.xz - vW.xz);
  g *= 1.0 / (1.0 + dist * 0.035);
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 V = normalize(cameraPosition - vW);
  float fres = pow(1.0 - max(dot(n, V), 0.0), 4.0);
  vec3 R = reflect(-V, n);
  vec3 L = normalize(uSunDir);
  float spec = pow(max(dot(R, L), 0.0), 90.0);
  float d = clamp((uZ0 - vW.z) / 40.0, 0.0, 1.0);
  vec3 col = mix(uColor * 0.72, uColor * 1.18, clamp(0.5 + n.x * 6.0 + n.z * 3.0, 0.0, 1.0));
  col = mix(col, uHorizon, clamp(fres * 0.7 + d * 0.45, 0.0, 1.0));
  // camino de luz del sol sobre el agua, con destellos que bailan
  float path = exp(-abs(vW.x - uSunX * (0.3 + d)) * (0.6 - d * 0.4)) * d;
  float glit = pow(max(0.0, sin(p.x * 9.0 + uT * 2.0) * sin(p.y * 7.0 - uT * 1.5)), 20.0);
  col = mix(col, uSun, clamp(path * 0.45 + glit * path * 1.6, 0.0, 1.0));
  col += uSun * spec * (0.6 + d);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`

/**
 * Mar con oleaje: mar de fondo desplazado en vértices, olas pequeñas en el
 * sombreado, reflejo del cielo y camino de luz del sol (que sigue a `sunRef`).
 */
function LivelySea({
  color = '#4b6fd0',
  sun = '#ffb56b',
  horizon = '#ffb38a',
  y = 0,
  z = -2.5,
  size = 80,
  flow = [0, 0],
  amp = 0.05,
  shore = 100,
  sunX = 0,
  sunRef,
  quality,
}: {
  color?: string
  sun?: string
  horizon?: string
  y?: number
  z?: number
  size?: number
  flow?: [number, number]
  amp?: number
  shore?: number
  sunX?: number
  sunRef?: React.RefObject<THREE.Object3D | null>
  quality: string
}) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uT: { value: 0 },
          uFlow: { value: new THREE.Vector2(...flow) },
          uAmp: { value: amp },
          uShore: { value: shore },
          uColor: { value: new THREE.Color(color) },
          uSun: { value: new THREE.Color(sun) },
          uHorizon: { value: new THREE.Color(horizon) },
          uSunDir: { value: new THREE.Vector3(sunX, 0.12, -1) },
          uSunX: { value: sunX },
          uZ0: { value: z + 0.5 },
        },
        vertexShader: SEA_VERT,
        fragmentShader: SEA_FRAG,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [color, sun, horizon, flow.join(), amp, shore, sunX, z],
  )
  useEffect(() => () => mat.dispose(), [mat])
  const v = useMemo(() => new THREE.Vector3(), [])
  useFrame((s) => {
    mat.uniforms.uT.value = s.clock.elapsedTime
    const o = sunRef?.current
    if (o) {
      o.getWorldPosition(v)
      mat.uniforms.uSunX.value = v.x * 0.45
      mat.uniforms.uSunDir.value.copy(v).normalize()
    }
  })
  const seg = quality === 'baja' ? 48 : 96
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, y, z - size / 2 + 4]} material={mat}>
      <planeGeometry args={[size, size, seg, seg]} />
    </mesh>
  )
}

const FOAM_FRAG = `
uniform float uT; uniform float uShore; uniform vec3 uWater; uniform vec3 uWet;
varying vec2 vXZ;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
void main(){
  float x = vXZ.x; float z = vXZ.y;
  vec4 acc = vec4(0.0);
  float wet = 0.0;
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float ph = fract(uT / 7.0 + fi * 0.5);
    float wob = sin(x * 1.1 + fi * 2.3) * 0.16 + sin(x * 2.9 - fi) * 0.06;
    // 1) la ola rompe y avanza hacia la orilla (línea de espuma sobre el agua)
    float zl = mix(uShore - 5.5, uShore - 0.4, smoothstep(0.0, 0.45, ph)) + wob * 0.6;
    float crest = smoothstep(0.22, 0.0, abs(z - zl)) * (1.0 - smoothstep(0.35, 0.5, ph)) * smoothstep(0.0, 0.08, ph);
    // 2) sube por la arena y vuelve a retirarse
    float run = smoothstep(0.42, 0.62, ph) * (1.0 - smoothstep(0.62, 1.0, ph));
    float zf = uShore - 0.3 + run * 1.15 + wob;
    float sheet = step(z, zf) * step(uShore - 0.6, z) * (1.0 - smoothstep(0.75, 1.0, ph));
    float lip = smoothstep(0.1, 0.0, abs(z - zf)) * smoothstep(0.4, 0.55, ph) * (1.0 - smoothstep(0.8, 1.0, ph));
    float n = vn(vec2(x * 6.0, z * 9.0 - uT * 0.5) + fi * 13.0);
    float foam = clamp((crest + lip) * (0.55 + n * 0.8), 0.0, 1.0);
    acc.rgb += uWater * sheet * 0.6 * (1.0 - acc.a) + vec3(1.0) * foam;
    acc.a = max(acc.a, max(sheet * 0.55, foam * 0.95));
    wet = max(wet, step(z, uShore - 0.3 + 1.15 * smoothstep(0.42, 0.62, ph) + wob) * step(uShore - 0.6, z) * (1.0 - smoothstep(0.62, 1.0, ph)));
  }
  vec3 col = acc.a > 0.001 ? acc.rgb / max(acc.a, 0.4) : uWet;
  float alpha = max(acc.a, wet * 0.28);
  gl_FragColor = vec4(min(col, vec3(1.2)), alpha);
  #include <colorspace_fragment>
}`

/** Orilla: olas que rompen, suben por la arena con espuma y se retiran. */
function ShoreFoam({ shore = -3, water = '#9fc7f0', wet = '#c9905e' }: { shore?: number; water?: string; wet?: string }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uT: { value: 0 }, uShore: { value: shore }, uWater: { value: new THREE.Color(water) }, uWet: { value: new THREE.Color(wet) } },
        vertexShader: 'varying vec2 vXZ; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vXZ = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: FOAM_FRAG,
      }),
    [shore, water, wet],
  )
  useEffect(() => () => mat.dispose(), [mat])
  useFrame((s) => (mat.uniforms.uT.value = s.clock.elapsedTime))
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0.012, shore - 1.6]} material={mat} renderOrder={2}>
      <planeGeometry args={[30, 5.6]} />
    </mesh>
  )
}

/** Buganvilla mecida por el viento: cada flor oscila en el shader según su posición. */
function WindBougainvillea({ position, count = 40, spread = [0.6, 0.4, 0.2], seed = 1, hang = 0 }: { position: [number, number, number]; count?: number; spread?: [number, number, number]; seed?: number; hang?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geo = useMemo(() => new THREE.IcosahedronGeometry(0.05, 0), [])
  const uT = useMemo(() => ({ value: 0 }), [])
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, flatShading: true })
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uWind = uT
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWind;').replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec3 ic = instanceMatrix[3].xyz;
        float sway = sin(uWind * 1.6 + ic.x * 3.0 + ic.y * 2.0) * 0.6 + sin(uWind * 2.9 + ic.y * 7.0) * 0.4;
        float gust = 0.6 + 0.4 * sin(uWind * 0.45 + ic.x);
        float reach = clamp(${(spread[1] * 0.5).toFixed(3)} - ic.y, 0.0, 2.0) + 0.25;
        transformed += vec3(sway * 0.5, -abs(sway) * 0.12, sway * 0.25) * reach * gust * 0.12 / max(0.3, length(instanceMatrix[0].xyz));`,
      )
    }
    m.customProgramCacheKey = () => `wind-${spread[1].toFixed(3)}`
    return m
  }, [uT, spread])
  useEffect(() => {
    const m = ref.current
    if (!m) return
    const rnd = seeded(seed)
    const mtx = new THREE.Matrix4()
    const c = new THREE.Color()
    for (let i = 0; i < count; i++) {
      const sc = 0.6 + rnd() * 0.8
      const yy = (rnd() - 0.5) * spread[1]
      // con `hang` las flores cuelgan como una cascada que se estrecha hacia abajo
      const narrow = hang ? 1 - hang * (0.5 - yy / spread[1]) * 0.8 : 1
      mtx.makeScale(sc, sc, sc).setPosition((rnd() - 0.5) * spread[0] * narrow, yy, (rnd() - 0.5) * spread[2])
      m.setMatrixAt(i, mtx)
      const r = rnd()
      m.setColorAt(i, c.set(r < 0.22 ? '#3a8f4f' : r < 0.6 ? '#e0218a' : r < 0.9 ? '#ff4fa8' : '#ff8fc9'))
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [count, spread, seed, hang])
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  useFrame((s) => (uT.value = s.clock.elapsedTime))
  return <instancedMesh ref={ref} args={[geo, mat, count]} position={position} frustumCulled={false} />
}

/** Pétalos que el viento arrastra en diagonal (buganvillas en «Nuestra casa»). */
function WindPetals({ count = 18, from = [-1.4, 2.0, -1.0], quality }: { count?: number; from?: [number, number, number]; quality: string }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const n = quality === 'baja' ? Math.ceil(count / 2) : count
  const geo = useMemo(() => {
    const g = new THREE.CircleGeometry(0.022, 6)
    g.scale(1, 0.6, 1)
    return g
  }, [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ff4fa8', roughness: 0.7, side: THREE.DoubleSide }), [])
  const seeds = useMemo(() => {
    const r = seeded(99)
    return Array.from({ length: n }, () => [r(), r(), r(), r()])
  }, [n])
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const e = useMemo(() => new THREE.Euler(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const pv = useMemo(() => new THREE.Vector3(), [])
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), [])
  useFrame((s) => {
    const m = ref.current
    if (!m) return
    const t = s.clock.elapsedTime
    for (let i = 0; i < n; i++) {
      const [a, b, c, d] = seeds[i]
      const life = (t * (0.08 + a * 0.05) + b) % 1
      pv.set(from[0] + life * 3.2 + Math.sin(t * 1.3 + d * 9) * 0.08, from[1] + c * 0.4 - life * 2.0 + Math.sin(t * 2 + a * 7) * 0.05, from[2] + (d - 0.5) * 0.9 + life * 0.8)
      e.set(t * (1 + a) + d * 6, t * (1.4 + b), t * 0.7 + c * 5)
      q.setFromEuler(e)
      m4.compose(pv, q, one.setScalar(life < 0.05 || life > 0.95 ? 0.001 : 1))
      m.setMatrixAt(i, m4)
    }
    m.instanceMatrix.needsUpdate = true
  })
  useEffect(
    () => () => {
      geo.dispose()
      mat.dispose()
    },
    [geo, mat],
  )
  return <instancedMesh ref={ref} args={[geo, mat, n]} frustumCulled={false} />
}

// El sol de Ibiza baja despacio hasta hundirse en el mar y vuelve a empezar.
const SUN_CYCLE = 70
const SUN_DIST = 70
/** Elevación del sol (radianes) en el instante `t`: baja de 7° a −5°; al final reaparece arriba. */
export function sunElevation(t: number) {
  const p = (t % SUN_CYCLE) / SUN_CYCLE
  const k = p < 0.9 ? p / 0.9 : 0
  return THREE.MathUtils.degToRad(7 - 12 * k)
}

function SettingSun({ sunRef, x = 5.2, color = '#ffcf7a' }: { sunRef: React.RefObject<THREE.Mesh | null>; x?: number; color?: string }) {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.2), toneMapped: false, fog: false, transparent: true }), [color])
  const base = useMemo(() => new THREE.Color(color).multiplyScalar(2.2), [color])
  const low = useMemo(() => new THREE.Color('#ff7a4a').multiplyScalar(2.0), [])
  useEffect(() => () => mat.dispose(), [mat])
  // el ciclo empieza al entrar en el escenario: siempre se llega con el sol alto
  const t0 = useRef<number | null>(null)
  useFrame((s) => {
    const m = sunRef.current
    if (!m) return
    t0.current ??= s.clock.elapsedTime
    const t = s.clock.elapsedTime - t0.current
    const el = sunElevation(t)
    m.position.set(x, 1.1 + Math.tan(el) * SUN_DIST, -SUN_DIST)
    // al acercarse al horizonte se vuelve más rojo; tras reaparecer, entra con un fundido
    const red = 1 - THREE.MathUtils.smoothstep(el, -0.04, 0.1)
    mat.color.copy(base).lerp(low, red)
    const p = (t % SUN_CYCLE) / SUN_CYCLE
    mat.opacity = Math.min(1, p / 0.04)
    m.scale.setScalar(1 + red * 0.08)
  })
  return (
    <mesh ref={sunRef} material={mat} position={[x, 1.1, -SUN_DIST]}>
      <circleGeometry args={[3.6, 48]} />
    </mesh>
  )
}

function Disco({ quality }: { quality: string }) {
  const ball = useRef<THREE.Mesh>(null)
  const tiles = useRef<THREE.InstancedMesh>(null)
  const spots = useRef<THREE.Group>(null)
  const N = 12
  const tileGeo = useMemo(() => new THREE.PlaneGeometry(0.46, 0.46), [])
  const tileMat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), [])
  const heartPts = useMemo(() => heartShape(0.7).getSpacedPoints(60).map((p) => [p.x, 1.9 + p.y, -3.65] as [number, number, number]), [])
  useFrame((s) => {
    const t = s.clock.elapsedTime
    if (ball.current) ball.current.rotation.y = t * 0.4
    if (spots.current) spots.current.children.forEach((c, i) => (c.rotation.z = Math.sin(t * 0.8 + i * 2) * 0.5))
    const m = tiles.current
    if (m) {
      const mtx = new THREE.Matrix4()
      const c = new THREE.Color()
      const cols = ['#ff2d8a', '#8f5bff', '#3de0c4', '#ffb3d9', '#2f6bff']
      let k = 0
      for (let i = 0; i < N; i++)
        for (let j = 0; j < N; j++) {
          mtx.makeRotationX(-Math.PI / 2).setPosition(-2.75 + i * 0.5, 0.003, -3.6 + j * 0.5)
          m.setMatrixAt(k, mtx)
          const on = Math.sin(t * 3 + i * 0.7 + j * 1.3) > 0.2
          m.setColorAt(k, c.set(cols[(i + j + Math.floor(t * 2)) % cols.length]).multiplyScalar(on ? 0.9 : 0.12))
          k++
        }
      m.instanceMatrix.needsUpdate = true
      if (m.instanceColor) m.instanceColor.needsUpdate = true
    }
  })
  return (
    <>
      <GlamEnvironment tint="#7a2fd6" accent="#ff2d8a" intensity={0.8} />
      <ThreePointLights key1="#ffe6f6" fill="#ff3fa0" rim="#3de0ff" k={0.9} />
      <color attach="background" args={['#14061f']} />
      <fog attach="fog" args={['#1a0828', 4, 12]} />
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[14, 14]} />
        <meshPhysicalMaterial color="#1a0b26" roughness={0.15} clearcoat={1} />
      </mesh>
      <instancedMesh ref={tiles} args={[tileGeo, tileMat, N * N]} />
      <mesh position={[0, 2.6, -3.8]}>
        <planeGeometry args={[12, 6]} />
        <meshStandardMaterial color="#1e0b2c" roughness={0.9} />
      </mesh>
      <FlickerNeon seed={1} points={[[-2.4, 0.6, -3.7], [-2.4, 2.6, -3.7], [-1.6, 3.0, -3.7]]} color="#ff2d8a" />
      <FlickerNeon seed={2.3} points={[[2.4, 0.6, -3.7], [2.4, 2.6, -3.7], [1.6, 3.0, -3.7]]} color="#3de0ff" />
      {/* corazón de neón */}
      <FlickerNeon seed={4.1} points={heartPts} color="#ff5fae" radius={0.022} />
      {/* bola de espejos */}
      <mesh ref={ball} position={[0, 2.9, -1.2]}>
        <icosahedronGeometry args={[0.32, 3]} />
        <meshStandardMaterial color="#e8e8f4" metalness={1} roughness={0.05} flatShading envMapIntensity={2.5} />
      </mesh>
      <group ref={spots}>
        {['#ff2d8a', '#3de0ff', '#c38bff'].map((c, i) => (
          <mesh key={c} position={[-1.6 + i * 1.6, 3.2, -0.8]} rotation-x={0.0}>
            <coneGeometry args={[0.7, 3.2, 24, 1, true]} />
            <meshBasicMaterial color={c} transparent opacity={0.08} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
      <FloatingGlints count={50} color="#d6c0ff" />
      {/* polvo de luz flotando en los haces de los focos */}
      <AmbientParticles kind="polvo" count={70} area={[4.4, 2.8, 2.6]} center={[0, 1.6, -1.2]} color="#e6d2ff" size={0.03} quality={quality} seed={3} />
      <Shadow quality={quality} color="#000000" />
    </>
  )
}

function Mall({ quality }: { quality: string }) {
  const tiles = useMemo(() => {
    const t = patternTexture('escoces', '#ffd6ec', '#f29ccc').clone()
    t.repeat.set(8, 8)
    t.needsUpdate = true
    return t
  }, [])
  const windows = [
    { x: -1.75, c: '#ff5fae' },
    { x: 1.75, c: '#2fb8ff' },
  ]
  return (
    <>
      <GlamEnvironment tint="#ffd6ec" accent="#c9b6ff" intensity={0.55} />
      <ThreePointLights key1="#ffffff" fill="#ffc6e4" rim="#b9a4ff" k={0.8} />
      <color attach="background" args={['#b98be6']} />
      <fog attach="fog" args={['#c9a0ea', 7, 15]} />
      <mesh position={[0, 1.6, -3.2]}>
        <planeGeometry args={[2.2, 3.2]} />
        <meshStandardMaterial map={patternTexture('rayas', '#ffb3d9', '#ffffff')} roughness={0.7} />
      </mesh>
      <NeonTube points={heartShape(0.5).getSpacedPoints(60).map((p) => [p.x, 2.2 + p.y, -3.1] as [number, number, number])} color="#ff2d8a" radius={0.024} />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[14, 14]} />
        <meshPhysicalMaterial map={tiles} roughness={0.2} clearcoat={1} />
      </mesh>
      {windows.map((w) => (
        <group key={w.x} position={[w.x, 0, -2.6]} rotation-y={-Math.sign(w.x) * 0.35}>
          <mesh position={[0, 1.4, 0]}>
            <boxGeometry args={[2, 2.8, 0.1]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0, 1.25, 0.06]}>
            <planeGeometry args={[1.7, 2.1]} />
            <meshStandardMaterial color={w.c} emissive={w.c} emissiveIntensity={0.8} />
          </mesh>
          {/* maniquí abstracto */}
          <mesh position={[0, 0.95, 0.15]}>
            <capsuleGeometry args={[0.13, 0.5, 6, 12]} />
            <meshPhysicalMaterial color="#ffffff" roughness={0.3} clearcoat={1} />
          </mesh>
          <mesh position={[0, 1.42, 0.15]}>
            <sphereGeometry args={[0.1, 16, 12]} />
            <meshPhysicalMaterial color="#ffffff" roughness={0.3} clearcoat={1} />
          </mesh>
          <mesh position={[0, 2.62, 0.08]}>
            <boxGeometry args={[1.4, 0.22, 0.04]} />
            <meshStandardMaterial color={w.c} emissive={w.c} emissiveIntensity={0.9} />
          </mesh>
        </group>
      ))}
      {/* bolsas de compras */}
      {[
        [-0.75, '#ff5fae'],
        [-0.55, '#c38bff'],
        [0.7, '#3de0c4'],
      ].map(([x, c]) => (
        <group key={x as number} position={[x as number, 0, 0.35]} rotation-y={(x as number) * 0.8}>
          <mesh position-y={0.13}>
            <boxGeometry args={[0.2, 0.26, 0.08]} />
            <meshPhysicalMaterial color={c as string} roughness={0.4} clearcoat={0.6} />
          </mesh>
          <mesh position-y={0.28} rotation-x={0}>
            <torusGeometry args={[0.05, 0.006, 6, 16, Math.PI]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}
      {[-3.3, 3.3].map((x) => (
        <group key={x} position={[x, 0, -1.8]}>
          <mesh position-y={0.25}>
            <cylinderGeometry args={[0.25, 0.2, 0.5, 20]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position-y={0.85}>
            <icosahedronGeometry args={[0.45, 1]} />
            <meshStandardMaterial color="#4caf6a" flatShading roughness={0.8} />
          </mesh>
        </group>
      ))}
      <AmbientParticles kind="polvo" count={40} area={[4, 2.6, 2.4]} center={[0, 1.4, -1]} color="#fff4fb" size={0.026} opacity={0.8} quality={quality} seed={5} />
      <Shadow quality={quality} />
    </>
  )
}

function Beach({ quality }: { quality: string }) {
  const sand = useMemo(() => {
    const t = patternTexture('purpurina', '#f2c99a').clone()
    t.repeat.set(20, 20)
    t.needsUpdate = true
    return t
  }, [])
  return (
    <>
      <GlamEnvironment tint="#ffb07a" accent="#ff7ab8" intensity={0.9} />
      <ThreePointLights key1="#ffd7b0" fill="#ff9fc8" rim="#ff9a5a" k={1.05} />
      <AmbientSky top="#6f5ccf" mid="#ff8fa8" bottom="#ffb87a" sunColor="#ffc27a" sunDir={[0, 0.06, -1]} clouds={0.9} />
      <fog attach="fog" args={['#f7a0a0', 12, 48]} />
      <mesh position={[0, 1.5, -24]}>
        <circleGeometry args={[1.8, 48]} />
        <meshBasicMaterial color={new THREE.Color('#ffd27a').multiplyScalar(2.2)} toneMapped={false} fog={false} />
      </mesh>
      <LivelySea color="#4b6fd0" sun="#ffb56b" horizon="#ff9fae" y={-0.01} z={-2.5} shore={-3} quality={quality} />
      <ShoreFoam shore={-3} water="#a9c6f2" wet="#b97e55" />
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.005, 1.5]} receiveShadow>
        <planeGeometry args={[30, 9]} />
        <meshStandardMaterial map={sand} roughness={0.95} />
      </mesh>
      <Palm position={[-2.2, 0, -1.6]} scale={0.95} lean={0.25} />
      <Palm position={[2.6, 0, -2.4]} scale={1.1} lean={-0.2} />
      {/* toalla de rayas */}
      <mesh rotation-x={-Math.PI / 2} rotation-z={0.3} position={[1.1, 0.01, 0.6]}>
        <planeGeometry args={[0.6, 1.2]} />
        <meshStandardMaterial map={patternTexture('rayas', '#ff5fae', '#ffffff')} roughness={0.9} />
      </mesh>
      <Islet position={[-4, 0, -18]} scale={2} color="#6f4a78" />
      <AmbientParticles kind="chispas" count={36} area={[6, 0.6, 5]} center={[0, 0.25, -5]} color="#fff1d0" size={0.05} quality={quality} seed={11} />
      <AmbientParticles kind="polvo" count={40} area={[4, 2.4, 2.4]} center={[0, 1.3, -1]} color="#ffe2c4" size={0.026} opacity={0.7} quality={quality} seed={12} />
      <Shadow quality={quality} y={0.012} color="#8a4a3a" />
    </>
  )
}

function RedCarpet({ quality }: { quality: string }) {
  const flashes = useRef<THREE.Group>(null)
  const wall = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 256
    const x = cv.getContext('2d')!
    x.fillStyle = '#2a0f22'
    x.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        x.save()
        x.translate(32 + i * 64, 32 + j * 64)
        x.fillStyle = (i + j) % 2 ? '#e3b45a' : '#ff2d8a'
        x.beginPath()
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2 - Math.PI / 2
          const r = k % 2 ? 9 : 20
          k ? x.lineTo(Math.cos(a) * r, Math.sin(a) * r) : x.moveTo(Math.cos(a) * r, Math.sin(a) * r)
        }
        x.fill()
        x.restore()
      }
    const t = new THREE.CanvasTexture(cv)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(4, 2)
    return t
  }, [])
  useFrame((s) => {
    const g = flashes.current
    if (!g) return
    const t = s.clock.elapsedTime
    g.children.forEach((c, i) => {
      const on = Math.sin(t * 7 + i * 2.7) > 0.93
      ;((c as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setScalar(on ? 8 : 0.15)
    })
  })
  return (
    <>
      <GlamEnvironment tint="#ffe0ea" accent="#ffd27a" intensity={0.9} />
      <ThreePointLights key1="#ffffff" fill="#ffd0e0" rim="#ffe1a0" k={1.1} />
      <color attach="background" args={['#120610']} />
      <fog attach="fog" args={['#1a0812', 5, 14]} />
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial color="#1a0d14" roughness={0.6} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.004, -1]}>
        <planeGeometry args={[1.8, 10]} />
        <meshStandardMaterial color="#b3122e" roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.6, -2.4]}>
        <planeGeometry args={[6, 3.2]} />
        <meshStandardMaterial map={wall} roughness={0.7} />
      </mesh>
      {[-1.1, 1.1].map((x) =>
        [-1.5, 0.2].map((z) => (
          <group key={`${x}${z}`} position={[x, 0, z]}>
            <mesh position-y={0.45}>
              <cylinderGeometry args={[0.03, 0.05, 0.9, 12]} />
              <meshPhysicalMaterial color="#f1c86a" metalness={1} roughness={0.2} />
            </mesh>
            <mesh position-y={0.92}>
              <sphereGeometry args={[0.05, 12, 8]} />
              <meshPhysicalMaterial color="#f1c86a" metalness={1} roughness={0.2} />
            </mesh>
          </group>
        )),
      )}
      {[-1.1, 1.1].map((x) => (
        <mesh key={x} position={[x, 0.78, -0.65]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.85, 0.02, 8, 24, Math.PI]} />
          <meshStandardMaterial color="#7a0f2a" roughness={0.5} />
        </mesh>
      ))}
      <group ref={flashes}>
        {Array.from({ length: 10 }, (_, i) => (
          <mesh key={i} position={[(i % 2 ? 1 : -1) * (2 + (i % 3) * 0.4), 1.2 + (i % 4) * 0.25, 0.5 - i * 0.35]}>
            <sphereGeometry args={[0.06, 10, 8]} />
            <meshBasicMaterial toneMapped={false} />
          </mesh>
        ))}
      </group>
      <AmbientParticles kind="polvo" count={50} area={[4, 2.6, 2.2]} center={[0, 1.5, -0.8]} color="#ffe6b8" size={0.028} quality={quality} seed={8} />
      <Shadow quality={quality} />
    </>
  )
}

function Room({ quality }: { quality: string }) {
  const lava = useRef<THREE.Group>(null)
  useFrame((s) => {
    const g = lava.current
    if (!g) return
    g.children.forEach((c, i) => (c.position.y = 0.95 + Math.sin(s.clock.elapsedTime * 0.6 + i * 2) * 0.12))
  })
  const heart = useMemo(() => extrude(heartShape(0.18), 0.08, 0.05), [])
  const posters = ['#ff5fae', '#8f5bff', '#3de0c4']
  return (
    <>
      <GlamEnvironment tint="#ffc2e2" accent="#c9b6ff" intensity={0.55} />
      <ThreePointLights key1="#fff2f8" fill="#ffb3d9" rim="#c9a7ff" k={0.8} />
      <color attach="background" args={['#f7b3d6']} />
      <mesh position={[0, 1.8, -2.6]}>
        <planeGeometry args={[9, 3.6]} />
        <meshStandardMaterial map={patternTexture('corazones', '#ff9fd0', '#ff5fae')} roughness={0.9} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#c9a7ff" roughness={0.8} />
      </mesh>
      {/* alfombra peluda */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.006}>
        <circleGeometry args={[0.9, 48]} />
        <meshPhysicalMaterial color="#ffffff" roughness={1} sheen={1} sheenColor="#ffd1ec" />
      </mesh>
      {/* cama */}
      <group position={[-1.7, 0, -1.9]}>
        <mesh position-y={0.25}>
          <boxGeometry args={[1.6, 0.5, 1.1]} />
          <meshPhysicalMaterial color="#c9a7ff" roughness={0.6} sheen={1} />
        </mesh>
        <mesh position={[0, 0.8, -0.5]}>
          <boxGeometry args={[1.6, 1.0, 0.1]} />
          <meshPhysicalMaterial color="#ff8fc7" roughness={0.4} clearcoat={0.6} />
        </mesh>
        {[-0.35, 0.35].map((x) => (
          <mesh key={x} geometry={heart} position={[x, 0.68, -0.3]}>
            <meshPhysicalMaterial color="#ff2d8a" roughness={0.5} sheen={1} />
          </mesh>
        ))}
      </group>
      {/* lámpara de lava */}
      <group position={[1.6, 0, -1.6]}>
        <mesh position-y={0.35}>
          <cylinderGeometry args={[0.1, 0.15, 0.7, 20]} />
          <meshPhysicalMaterial color="#c0c4d6" metalness={1} roughness={0.25} />
        </mesh>
        <mesh position-y={0.95}>
          <capsuleGeometry args={[0.12, 0.35, 8, 16]} />
          <meshPhysicalMaterial color="#ffb3e6" transparent opacity={0.45} roughness={0.05} />
        </mesh>
        <group ref={lava}>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0, 0.95, 0]}>
              <sphereGeometry args={[0.05 + i * 0.01, 12, 10]} />
              <meshBasicMaterial color={new THREE.Color('#ff2d8a').multiplyScalar(2)} toneMapped={false} />
            </mesh>
          ))}
        </group>
      </group>
      {posters.map((c, i) => (
        <group key={c} position={[0.4 + i * 0.8, 2.1 + (i % 2) * 0.2, -2.58]} rotation-z={(i - 1) * 0.08}>
          <mesh>
            <planeGeometry args={[0.6, 0.8]} />
            <meshStandardMaterial color={c} />
          </mesh>
          <mesh position-z={0.01} geometry={i === 1 ? extrude(heartShape(0.18), 0.01) : extrude(starShape(0.2, 0.45), 0.01)}>
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}
      <FloatingShape kind="heart" position={[-0.8, 2.6, -2.2]} scale={0.2} color="#ff5fae" />
      <FloatingShape kind="star" position={[2.4, 2.4, -2]} scale={0.18} color="#fff16a" emissive={0.3} />
      <FloatingGlints count={24} />
      <AmbientParticles kind="polvo" count={36} area={[4, 2.4, 2]} center={[0.2, 1.4, -1]} color="#fff0f8" size={0.024} opacity={0.75} quality={quality} seed={9} />
      <Shadow quality={quality} y={0.01} />
    </>
  )
}

function IbizaSunset({ quality, home = false }: { quality: string; home?: boolean }) {
  const sun = useRef<THREE.Mesh>(null)
  const lights = useMemo(() => {
    const pts: [number, number, number][] = []
    for (let i = 0; i <= 16; i++) {
      const t = i / 16
      pts.push([-2.4 + t * 4.8, 2.5 - Math.sin(t * Math.PI) * 0.35, -1.6])
    }
    return pts
  }, [])
  const tiles = useMemo(() => {
    const t = patternTexture('escoces', '#e9a07a', '#d6825e').clone()
    t.repeat.set(6, 6)
    t.needsUpdate = true
    return t
  }, [])
  return (
    <>
      <GlamEnvironment tint="#ffb38a" accent="#ff7ab8" intensity={0.95} />
      <ThreePointLights key1="#ffd9b8" fill="#ffa8c8" rim="#ff9a5a" k={1.05} />
      <AmbientSky {...(home ? SKY_HOME : SKY_IBIZA)} dusk={SKY_DUSK} sunRef={sun} sunColor="#ffb46b" clouds={0.7} />
      <fog attach="fog" args={[home ? '#e98aa0' : '#f59a9c', 10, 40]} />
      <SettingSun sunRef={sun} />
      <LivelySea color="#5866c8" sun="#ffb46b" horizon="#f08f9e" y={-0.6} z={-4} sunRef={sun} quality={quality} />
      <Islet position={[-1.5, -0.6, -16]} scale={2.6} color="#6a4573" />
      {/* terraza */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[7, 5]} />
        <meshStandardMaterial map={tiles} roughness={0.85} />
      </mesh>
      {/* murete blanco */}
      <mesh position={[0, 0.25, -2.4]}>
        <boxGeometry args={[7, 0.5, 0.2]} />
        <meshStandardMaterial color="#fbf6ef" roughness={0.9} />
      </mesh>
      {!home && (
        <>
          <WhiteHouse position={[-2.8, 0, -1.6]} size={[1.4, 1.6, 1.2]} />
          <WhiteHouse position={[-1.8, 0, -3.6]} size={[1.2, 2.2, 1]} />
          <WhiteHouse position={[2.9, 0, -2.2]} size={[1.4, 1.2, 1.2]} />
          <WindBougainvillea position={[-2.1, 1.5, -1.1]} count={60} spread={[0.8, 0.6, 0.3]} seed={21} />
          <WindBougainvillea position={[2.4, 1.15, -1.6]} count={50} spread={[0.7, 0.4, 0.3]} seed={22} />
        </>
      )}
      {home && <HomeProps quality={quality} />}
      <Bulbs points={lights} color="#ffe2a8" size={0.028} intensity={2.4} />
      <FloatingGlints count={30} color="#ffe0b8" />
      {/* luciérnagas del anochecer ibicenco */}
      <AmbientParticles kind="luciernagas" count={22} area={[4.6, 1.8, 2]} center={[0, 1.1, -1]} color="#ffe58a" size={0.04} quality={quality} seed={home ? 31 : 32} />
      <Shadow quality={quality} y={0.004} color="#7a3a30" />
    </>
  )
}

/** Detalles de "nuestra casa": columpio, mesa con dos tazas y olivo. */
function HomeProps({ quality }: { quality: string }) {
  const swing = useRef<THREE.Group>(null)
  useFrame((s) => {
    if (swing.current) swing.current.rotation.x = Math.sin(s.clock.elapsedTime * 1.1) * 0.08
  })
  const arch = useMemo(() => {
    const outer = roundedRectShape(1.6, 2.6, 0.02)
    const hole = new THREE.Path()
    hole.moveTo(-0.55, -1.2)
    hole.lineTo(0.55, -1.2)
    hole.lineTo(0.55, 0.5)
    hole.absarc(0, 0.5, 0.55, 0, Math.PI, false)
    hole.lineTo(-0.55, -1.2)
    outer.holes.push(hole)
    return new THREE.ShapeGeometry(outer, 24)
  }, [])
  const wall = useMemo(() => {
    const sh = new THREE.Shape()
    sh.moveTo(-1.6, 0)
    sh.lineTo(1.6, 0)
    sh.lineTo(1.6, 2.4)
    sh.quadraticCurveTo(0, 2.75, -1.6, 2.4)
    sh.lineTo(-1.6, 0)
    const door = new THREE.Path()
    door.moveTo(-0.45, 0)
    door.lineTo(0.45, 0)
    door.lineTo(0.45, 1.45)
    door.absarc(0, 1.45, 0.45, 0, Math.PI, false)
    door.lineTo(-0.45, 0)
    sh.holes.push(door)
    return new THREE.ExtrudeGeometry(sh, { depth: 0.18, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 20 })
  }, [])
  const doorGeo = useMemo(() => {
    const sh = new THREE.Shape()
    sh.moveTo(-0.45, 0)
    sh.lineTo(0.45, 0)
    sh.lineTo(0.45, 1.45)
    sh.absarc(0, 1.45, 0.45, 0, Math.PI, false)
    sh.lineTo(-0.45, 0)
    return new THREE.ShapeGeometry(sh, 20)
  }, [])
  const lightsArc = useMemo(() => {
    const pts: [number, number, number][] = []
    for (let i = 0; i <= 18; i++) {
      const a = Math.PI * (i / 18)
      pts.push([Math.cos(a) * 0.62, 1.45 + Math.sin(a) * 0.62, -1.05])
    }
    return pts
  }, [])
  return (
    <group>
      {/* nuestra puerta: pared encalada con arco y puerta azul ibicenca */}
      <mesh geometry={wall} position={[0, 0, -1.3]}>
        <meshStandardMaterial color="#fbf6ef" roughness={0.9} />
      </mesh>
      <mesh geometry={doorGeo} position={[0, 0, -1.25]}>
        <meshStandardMaterial color="#2c6fb3" roughness={0.5} />
      </mesh>
      <mesh position={[0.28, 0.95, -1.22]}>
        <sphereGeometry args={[0.03, 12, 8]} />
        <meshStandardMaterial color="#e3b45a" metalness={1} roughness={0.2} />
      </mesh>
      <Bulbs points={lightsArc} color="#ffe2a8" size={0.026} intensity={2.6} />
      <WindBougainvillea position={[-1.05, 2.15, -1.05]} count={70} spread={[1.0, 0.5, 0.3]} seed={41} />
      <WindBougainvillea position={[1.15, 1.9, -1.05]} count={50} spread={[0.7, 0.6, 0.3]} seed={42} />
      {/* cascadas de flores que bajan por las esquinas de la pared, dentro del encuadre */}
      <WindBougainvillea position={[-0.78, 1.55, -1.0]} count={55} spread={[0.32, 1.1, 0.16]} seed={43} hang={1} />
      <WindBougainvillea position={[0.8, 1.5, -1.0]} count={45} spread={[0.3, 0.95, 0.16]} seed={44} hang={1} />
      <WindPetals from={[-1.5, 1.9, -0.9]} quality={quality} />
      <mesh geometry={arch} position={[-1.35, 1.3, -1.25]} rotation-y={0.35} visible={false}>
        <meshStandardMaterial color="#fbf6ef" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      <group ref={swing} position={[1.35, 2.3, -0.7]}>
        {[-0.22, 0.22].map((x) => (
          <mesh key={x} position={[x, -0.75, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 1.5, 6]} />
            <meshStandardMaterial color="#d9b98a" />
          </mesh>
        ))}
        <mesh position={[0, -1.5, 0]}>
          <boxGeometry args={[0.55, 0.04, 0.25]} />
          <meshStandardMaterial color="#c08a5a" roughness={0.7} />
        </mesh>
      </group>
      <group position={[0.85, 0, -0.35]}>
        <mesh position-y={0.36}>
          <cylinderGeometry args={[0.28, 0.28, 0.03, 32]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position-y={0.18}>
          <cylinderGeometry args={[0.03, 0.05, 0.36, 12]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        {[-0.08, 0.08].map((x, i) => (
          <mesh key={x} position={[x, 0.41, 0.02 * i]}>
            <cylinderGeometry args={[0.03, 0.025, 0.06, 16]} />
            <meshPhysicalMaterial color={i ? '#ff9fd0' : '#7fd6ff'} clearcoat={1} roughness={0.2} />
          </mesh>
        ))}
      </group>
      <group position={[-1.0, 0, -0.9]}>
        <mesh position-y={0.2}>
          <cylinderGeometry args={[0.2, 0.15, 0.4, 20]} />
          <meshStandardMaterial color="#d6825e" roughness={0.8} />
        </mesh>
        <mesh position-y={0.95}>
          <icosahedronGeometry args={[0.45, 1]} />
          <meshStandardMaterial color="#7f9a63" flatShading roughness={0.9} />
        </mesh>
      </group>
      <FloatingShape kind="heart" position={[0, 2.35, -1.0]} scale={0.22} color="#ff5fae" emissive={0.3} />
    </group>
  )
}

// ───────────────────── Ferry a Ibiza ─────────────────────

/** Tablones de cubierta de teca, dibujados en canvas. */
function deckTexture() {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 256
  const x = cv.getContext('2d')!
  const rnd = seeded(5)
  const tones = ['#c98f5f', '#bf8455', '#d39b69', '#c48a59']
  for (let i = 0; i < 8; i++) {
    x.fillStyle = tones[i % tones.length]
    x.fillRect(0, i * 32, 256, 32)
    // vetas
    x.strokeStyle = 'rgba(110,60,30,0.18)'
    x.lineWidth = 1
    for (let k = 0; k < 5; k++) {
      const yy = i * 32 + 4 + rnd() * 24
      x.beginPath()
      x.moveTo(0, yy)
      x.bezierCurveTo(80, yy + (rnd() - 0.5) * 6, 170, yy + (rnd() - 0.5) * 6, 256, yy)
      x.stroke()
    }
    // juntas negras de calafateo y testas desfasadas
    x.fillStyle = '#4a2c1c'
    x.fillRect(0, i * 32, 256, 3)
    x.fillRect(((i * 97) % 256) | 0, i * 32, 3, 32)
  }
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(2, 6)
  t.anisotropy = 4
  return t
}

/** Franjas rojas y blancas del salvavidas. */
function buoyTexture() {
  const cv = document.createElement('canvas')
  cv.width = 128
  cv.height = 16
  const x = cv.getContext('2d')!
  for (let i = 0; i < 8; i++) {
    x.fillStyle = i % 2 ? '#ffffff' : '#ff3b6b'
    x.fillRect(i * 16, 0, 16, 16)
  }
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Banderines de colores que ondean con la brisa del barco. */
function Bunting({ from, to, sag = 0.2, count = 13 }: { from: [number, number, number]; to: [number, number, number]; sag?: number; count?: number }) {
  const flags = useRef<THREE.Group>(null)
  const { rope, pts } = useMemo(() => {
    const a = new THREE.Vector3(...from)
    const b = new THREE.Vector3(...to)
    const mid = a.clone().lerp(b, 0.5)
    mid.y -= sag
    const c = new THREE.QuadraticBezierCurve3(a, mid, b)
    return { rope: new THREE.TubeGeometry(c, 32, 0.005, 4, false), pts: c.getSpacedPoints(count + 1).slice(1, -1) }
  }, [from, to, sag, count])
  const tri = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.07, 0, 0, 0.07, 0, 0, 0, -0.16, 0], 3))
    g.computeVertexNormals()
    return g
  }, [])
  const cols = ['#ff5fae', '#ffd34d', '#3de0c4', '#ffffff', '#8f5bff', '#2fb8ff']
  useFrame((s) => {
    const t = s.clock.elapsedTime
    flags.current?.children.forEach((c, i) => {
      c.rotation.x = -0.35 - Math.abs(Math.sin(t * 3.2 + i * 0.9)) * 0.45
      c.rotation.y = Math.sin(t * 2.1 + i * 1.7) * 0.2
    })
  })
  return (
    <group>
      <mesh geometry={rope}>
        <meshStandardMaterial color="#f4ece4" roughness={0.8} />
      </mesh>
      <group ref={flags}>
        {pts.map((p, i) => (
          <mesh key={i} geometry={tri} position={p}>
            <meshStandardMaterial color={cols[i % cols.length]} roughness={0.7} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** Gaviotas que planean en círculos y aletean de vez en cuando. */
function Gulls({ count = 4 }: { count?: number }) {
  const group = useRef<THREE.Group>(null)
  const wing = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.05, 0, 0, 0.06, 0.32, 0.03, 0.02, 0, 0, 0.06, 0.32, 0.03, 0.02, 0.5, -0.05, 0.05], 3))
    g.computeVertexNormals()
    return g
  }, [])
  const params = useMemo(() => {
    const r = seeded(17)
    return Array.from({ length: count }, (_, i) => ({ cx: -2.2 + i * 1.1 + r() * 0.6, cy: 2.2 + r() * 0.8, cz: -8 - r() * 5, rad: 1.2 + r() * 1.5, sp: 0.18 + r() * 0.12, ph: r() * 6.28, s: 0.6 + r() * 0.4 }))
  }, [count])
  useFrame((st) => {
    const t = st.clock.elapsedTime
    group.current?.children.forEach((g, i) => {
      const p = params[i]
      const a = t * p.sp + p.ph
      g.position.set(p.cx + Math.cos(a) * p.rad, p.cy + Math.sin(a * 2) * 0.15, p.cz + Math.sin(a) * p.rad * 0.4)
      g.rotation.y = -a + Math.PI
      g.rotation.z = Math.cos(a) * 0.25
      const flap = Math.sin(t * 7 + i) > 0.3 ? Math.sin(t * 14 + i) * 0.5 : 0.12
      g.children[0].rotation.z = flap
      g.children[1].rotation.z = -flap
    })
  })
  return (
    <group ref={group}>
      {params.map((p, i) => (
        <group key={i} scale={p.s}>
          <mesh geometry={wing}>
            <meshStandardMaterial color="#fbfbff" roughness={0.6} side={THREE.DoubleSide} />
          </mesh>
          <mesh geometry={wing} scale={[-1, 1, 1]}>
            <meshStandardMaterial color="#fbfbff" roughness={0.6} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Ibiza en el horizonte: sierra con capas de bruma, Dalt Vila y casitas blancas. */
function IbizaIsland() {
  const { far, near } = useMemo(() => {
    const hills = (w: number, h: number, seed: number, bumps: number) => {
      const r = seeded(seed)
      const sh = new THREE.Shape()
      sh.moveTo(-w / 2, 0)
      const N = 40
      const amp = Array.from({ length: bumps }, () => [r() * 0.6 + 0.4, r() * 6.28, 1 + r() * 3] as const)
      for (let i = 0; i <= N; i++) {
        const u = i / N
        let y = Math.sin(u * Math.PI) ** 0.7 * h
        for (const [a, ph, f] of amp) y += Math.sin(u * f * 6 + ph) * a * h * 0.12
        sh.lineTo(-w / 2 + u * w, Math.max(0, y))
      }
      sh.lineTo(w / 2, 0)
      return new THREE.ShapeGeometry(sh)
    }
    return { far: hills(26, 2.0, 3, 4), near: hills(16, 1.25, 8, 5) }
  }, [])
  const houses = useRef<THREE.InstancedMesh>(null)
  const HN = 34
  useEffect(() => {
    const m = houses.current
    if (!m) return
    const r = seeded(77)
    const mtx = new THREE.Matrix4()
    for (let i = 0; i < HN; i++) {
      // casitas apiñadas en la ladera de la ciudad, junto a la costa
      const u = r()
      const x = 1.2 + u * 4.2
      const y = 0.05 + (1 - Math.abs(u - 0.45) * 1.8) * 0.9 * r()
      mtx.makeScale(0.14 + r() * 0.12, 0.1 + r() * 0.1, 0.05).setPosition(x, Math.max(0.05, y), 0.02)
      m.setMatrixAt(i, mtx)
    }
    m.instanceMatrix.needsUpdate = true
  }, [])
  return (
    <group position={[-4, -2.55, -26]} scale={1.5}>
      <mesh geometry={far} position={[-2, 0, -6]}>
        <meshBasicMaterial color="#a7a6cf" />
      </mesh>
      <mesh geometry={near}>
        <meshStandardMaterial color="#7f8f78" roughness={1} />
      </mesh>
      <instancedMesh ref={houses} args={[undefined, undefined, HN]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#fff7ee" />
      </instancedMesh>
      {/* Dalt Vila: murallas y la torre de la catedral en lo alto */}
      <mesh position={[3.4, 1.0, 0.03]}>
        <boxGeometry args={[1.4, 0.2, 0.05]} />
        <meshBasicMaterial color="#e9d7c3" />
      </mesh>
      <mesh position={[3.6, 1.32, 0.04]}>
        <boxGeometry args={[0.16, 0.5, 0.05]} />
        <meshBasicMaterial color="#f3e6d6" />
      </mesh>
    </group>
  )
}

const FERRY_WAKE_FRAG = `
uniform float uT;
varying vec2 vXZ;
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1,0)), f.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), f.x), f.y); }
void main(){
  // espuma de la estela pegada al casco, arrastrada hacia popa
  vec2 p = vec2(vXZ.x + uT * 1.8, vXZ.y);
  float band = 1.0 - smoothstep(0.0, 2.2, abs(vXZ.y + 2.3));
  float n = vn(p * vec2(1.6, 3.5)) * 0.65 + vn(p * vec2(4.0, 8.0) + 3.0) * 0.35;
  float a = smoothstep(0.45, 0.8, n) * band;
  gl_FragColor = vec4(vec3(1.0), a * 0.85);
  #include <colorspace_fragment>
}`

function FerryWake() {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uT: { value: 0 } },
        vertexShader: 'varying vec2 vXZ; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vXZ = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: FERRY_WAKE_FRAG,
      }),
    [],
  )
  useEffect(() => () => mat.dispose(), [mat])
  useFrame((s) => (mat.uniforms.uT.value = s.clock.elapsedTime))
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, -2.48, -2.6]} material={mat} renderOrder={2}>
      <planeGeometry args={[30, 4.4]} />
    </mesh>
  )
}

/** Barandilla de la cubierta: candeleros blancos, pasamanos de madera y cabos de acero. */
function Railing({ z = -1.5, from = -4, to = 4 }: { z?: number; from?: number; to?: number }) {
  const posts = useRef<THREE.InstancedMesh>(null)
  const n = Math.round((to - from) / 0.55) + 1
  useEffect(() => {
    const m = posts.current
    if (!m) return
    const mtx = new THREE.Matrix4()
    for (let i = 0; i < n; i++) m.setMatrixAt(i, mtx.makeTranslation(from + i * 0.55, 0.5, z))
    m.instanceMatrix.needsUpdate = true
  }, [n, from, z])
  const w = to - from
  return (
    <group>
      <instancedMesh ref={posts} args={[undefined, undefined, n]}>
        <cylinderGeometry args={[0.018, 0.022, 1, 8]} />
        <meshStandardMaterial color="#ffffff" metalness={0.3} roughness={0.35} />
      </instancedMesh>
      <mesh position={[(from + to) / 2, 1.02, z]} rotation-z={Math.PI / 2}>
        <cylinderGeometry args={[0.035, 0.035, w, 10]} />
        <meshStandardMaterial color="#a86a3c" roughness={0.45} />
      </mesh>
      {[0.68, 0.36].map((y) => (
        <mesh key={y} position={[(from + to) / 2, y, z]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.007, 0.007, w, 6]} />
          <meshStandardMaterial color="#d6dde6" metalness={1} roughness={0.25} />
        </mesh>
      ))}
      {/* regala: borde blanco de la cubierta */}
      <mesh position={[(from + to) / 2, 0.06, z]}>
        <boxGeometry args={[w, 0.12, 0.08]} />
        <meshStandardMaterial color="#f7f5f2" roughness={0.6} />
      </mesh>
    </group>
  )
}

function Ferry({ quality }: { quality: string }) {
  const deck = useMemo(() => deckTexture(), [])
  const buoy = useMemo(() => buoyTexture(), [])
  useEffect(
    () => () => {
      deck.dispose()
      buoy.dispose()
    },
    [deck, buoy],
  )
  // el barco cabecea: el mundo exterior (mar, isla, cielo) se mece respecto a la cubierta
  const world = useRef<THREE.Group>(null)
  useFrame((s) => {
    const g = world.current
    if (!g) return
    const t = s.clock.elapsedTime
    g.rotation.z = Math.sin(t * 0.55) * 0.012
    g.rotation.x = Math.sin(t * 0.37 + 1) * 0.006
    g.position.y = Math.sin(t * 0.8) * 0.05
  })
  return (
    <>
      <GlamEnvironment tint="#bfe3ff" accent="#ffb3d1" intensity={0.9} />
      <ThreePointLights key1="#fff1e0" fill="#ffc6dc" rim="#a9d8ff" k={1.05} />
      <fog attach="fog" args={['#cfe1f4', 16, 80]} />
      <group ref={world}>
        <AmbientSky top="#4f8fe8" mid="#b4d8ff" bottom="#ffd0cc" sunColor="#ffe0a8" sunDir={[-0.55, 0.22, -1]} clouds={1} halo={0.9} />
        <mesh position={[-24, 18, -64]}>
          <circleGeometry args={[2.6, 40]} />
          <meshBasicMaterial color={new THREE.Color('#fff0c4').multiplyScalar(2)} toneMapped={false} fog={false} />
        </mesh>
        <LivelySea color="#1f7fc8" sun="#fff0c4" horizon="#bcd8f2" y={-2.5} z={-1.8} flow={[1.4, 0]} amp={0.12} sunX={-6} quality={quality} />
        <FerryWake />
        <IbizaIsland />
        <Islet position={[9, -2.55, -30]} scale={1.6} color="#a58aa8" />
        <Gulls count={quality === 'baja' ? 3 : 5} />
      </group>
      {/* cubierta de teca */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 1.3]} receiveShadow>
        <planeGeometry args={[9, 5.8]} />
        <meshStandardMaterial map={deck} roughness={0.7} />
      </mesh>
      <Railing />
      {/* salvavidas colgado de la barandilla */}
      <mesh position={[-0.62, 0.62, -1.43]}>
        <torusGeometry args={[0.2, 0.055, 12, 32]} />
        <meshStandardMaterial map={buoy} roughness={0.5} />
      </mesh>
      {/* mástiles con los banderines */}
      {[-2.3, 2.3].map((x) => (
        <mesh key={x} position={[x, 1.3, -1.2]}>
          <cylinderGeometry args={[0.03, 0.035, 2.6, 10]} />
          <meshStandardMaterial color="#ffffff" metalness={0.3} roughness={0.35} />
        </mesh>
      ))}
      <Bunting from={[-2.3, 2.3, -1.2]} to={[2.3, 2.3, -1.2]} sag={0.4} count={15} />
      {/* cabina blanca con ojos de buey a la izquierda */}
      <group position={[-3.4, 0, 0]}>
        <mesh position={[0, 1.2, 0]}>
          <boxGeometry args={[1.6, 2.4, 3]} />
          <meshStandardMaterial color="#fbf9f6" roughness={0.6} />
        </mesh>
        {[-0.8, 0.2].map((z) => (
          <group key={z} position={[0.81, 1.5, z]} rotation-y={Math.PI / 2}>
            <mesh>
              <torusGeometry args={[0.16, 0.03, 8, 24]} />
              <meshStandardMaterial color="#d6dde6" metalness={1} roughness={0.25} />
            </mesh>
            <mesh>
              <circleGeometry args={[0.16, 24]} />
              <meshPhysicalMaterial color="#3a7fc0" roughness={0.05} clearcoat={1} />
            </mesh>
          </group>
        ))}
      </group>
      {/* nuestras dos maletas: nos mudamos a Ibiza */}
      <group position={[0.52, 0, 0.3]} rotation-y={-0.35}>
        <RoundedBox args={[0.34, 0.48, 0.16]} radius={0.04} smoothness={3} position-y={0.26}>
          <meshPhysicalMaterial color="#ff8fc7" roughness={0.3} clearcoat={1} />
        </RoundedBox>
        <mesh position-y={0.53}>
          <torusGeometry args={[0.06, 0.012, 6, 16, Math.PI]} />
          <meshStandardMaterial color="#5a2a4a" />
        </mesh>
        <FloatingShape kind="heart" position={[0, 0.3, 0.085]} scale={0.09} color="#ffffff" speed={0} />
      </group>
      <group position={[-0.52, 0, 0.4]} rotation-y={0.4}>
        <RoundedBox args={[0.3, 0.4, 0.15]} radius={0.04} smoothness={3} position-y={0.22}>
          <meshPhysicalMaterial color="#7fc8ff" roughness={0.3} clearcoat={1} />
        </RoundedBox>
        <mesh position-y={0.45}>
          <torusGeometry args={[0.055, 0.012, 6, 16, Math.PI]} />
          <meshStandardMaterial color="#2a3a5a" />
        </mesh>
      </group>
      {/* salitre brillando en el aire y destellos del sol */}
      <AmbientParticles kind="chispas" count={30} area={[5, 2, 2]} center={[0, 1.2, -1.8]} color="#ffffff" size={0.04} quality={quality} seed={51} />
      <AmbientParticles kind="polvo" count={36} area={[4, 2.4, 2]} center={[0, 1.3, -0.6]} color="#fff4e0" size={0.024} opacity={0.7} quality={quality} seed={52} />
      <Shadow quality={quality} y={0.004} color="#5a3a2a" />
    </>
  )
}

const SKY_IBIZA = { top: '#6f63c9', mid: '#ff8f9f', bottom: '#ffbf7a' }
const SKY_HOME = { top: '#2e3a8c', mid: '#e77fa6', bottom: '#ffb27a' }
const SKY_DUSK = { top: '#1f2466', mid: '#b4568f', bottom: '#e9786a' }

export default function StageScene({ id, quality }: { id: string; quality: string }) {
  switch (id) {
    case 'disco':
      return <Disco quality={quality} />
    case 'mall':
      return <Mall quality={quality} />
    case 'beach':
      return <Beach quality={quality} />
    case 'redcarpet':
      return <RedCarpet quality={quality} />
    case 'room':
      return <Room quality={quality} />
    case 'ferry':
      return <Ferry quality={quality} />
    case 'casa':
      return <IbizaSunset quality={quality} home />
    case 'daltvila':
      return <DaltVila quality={quality} />
    case 'ibiza':
    default:
      return <IbizaSunset quality={quality} />
  }
}

export { GlossyFloor }
