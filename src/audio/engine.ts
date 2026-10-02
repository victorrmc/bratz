// Audio 100 % sintetizado con Web Audio: música original por escenario y efectos.
// Arranca tras la primera interacción del usuario.

import { HAPTICS, type Footwear, type Sfx, type Track } from './mapping'
import { buzz, markSfxVibration, vibrate } from './haptics'

export type { Track } from './mapping'
export { buzz }

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

// Acordes de cada pista (4 compases, notas MIDI)
const CHORDS: Record<Track, number[][]> = {
  // pop en Re mayor: I – vi – IV – V
  menu: [
    [62, 66, 69, 73],
    [59, 62, 66, 69],
    [55, 59, 62, 66],
    [57, 61, 64, 67],
  ],
  runway: [
    [57, 60, 64, 67],
    [53, 57, 60, 64],
    [55, 59, 62, 65],
    [52, 55, 59, 62],
  ],
  ending: [
    [60, 64, 67, 71],
    [57, 60, 64, 67],
    [53, 57, 60, 64],
    [55, 59, 62, 65],
  ],
  // balear chill: Fmaj7 – Em7 – Dm7 – Cmaj7
  ibiza: [
    [53, 57, 60, 64],
    [52, 55, 59, 62],
    [50, 53, 57, 60],
    [48, 52, 55, 59],
  ],
  // house: Am9 – Fmaj9 – Cmaj7 – G6
  disco: [
    [57, 60, 64, 67, 71],
    [53, 57, 60, 64, 67],
    [48, 55, 59, 64, 67],
    [55, 59, 62, 64, 67],
  ],
  // guitarra de casa: Sol – Mim – Do – Re
  casa: [
    [43, 55, 59, 62, 67],
    [40, 52, 55, 59, 64],
    [48, 52, 55, 60, 64],
    [50, 54, 57, 62, 66],
  ],
}
// La pasarela va a 114 ppm: una negra por paso del ciclo de paseo (1,9 pasos/s).
const BPM: Record<Track, number> = { menu: 112, runway: 114, ending: 92, ibiza: 96, disco: 124, casa: 84 }
// Melodías (semitonos sobre la tónica de cada acorde), 16 semicorcheas por compás
const MELODY: Record<Track, (number | null)[]> = {
  menu: [7, null, 9, 7, 4, null, 2, 4, 7, null, 12, null, 11, 9, 7, null],
  runway: [12, null, null, 12, 10, null, 7, null, 12, null, 15, 14, 12, null, 10, null],
  ending: [4, null, 7, null, 11, null, 12, null, 11, null, 7, null, 4, null, 2, null],
  ibiza: [null, null, 7, null, 11, null, null, 9, null, null, 7, null, 4, null, null, null],
  disco: [null, null, 12, null, null, 10, null, 12, null, null, 15, null, 14, null, 12, null],
  casa: [7, null, null, 9, 11, null, 9, null, 7, null, null, 4, 2, null, null, null],
}
// Reverberación de cada pista
const REVERB: Record<Track, number> = { menu: 0.15, runway: 0.12, ending: 0.3, ibiza: 0.45, disco: 0.12, casa: 0.3 }

interface SfxLog {
  name: Sfx
  at: number
}

class AudioEngine {
  ctx: AudioContext | null = null
  master: GainNode | null = null
  music: GainNode | null = null
  sfx: GainNode | null = null
  noise: AudioBuffer | null = null
  /** Bus de instrumentos melódicos: en house «bombea» con el bombo. */
  private pump: GainNode | null = null
  private filter: BiquadFilterNode | null = null
  private reverbSend: GainNode | null = null
  private plucks = new Map<number, AudioBuffer>()
  private track: Track | null = null
  private step = 0
  private nextTime = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private volume = 0.7
  private muted = false
  private mix = { music: 0.8, sfx: 0.9 }
  /** Intensidad de la música adaptativa de la pasarela (0 a 3). */
  intensity = 1
  /** La muñeca está andando: suenan sus pasos a tempo. */
  walking = false
  footwear: Footwear = 'tacon'
  /** Últimos efectos (para pruebas y depuración). */
  log: SfxLog[] = []

  get currentTrack(): Track | null {
    return this.track
  }

  /** Debe llamarse dentro de un gesto del usuario. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      const ctx = new AC()
      this.ctx = ctx
      this.master = ctx.createGain()
      const comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -14
      comp.ratio.value = 3
      this.master.connect(comp).connect(ctx.destination)
      // música: bus → filtro (pasarela adaptativa) → master, con envío a reverberación
      this.music = ctx.createGain()
      this.filter = ctx.createBiquadFilter()
      this.filter.type = 'lowpass'
      this.filter.frequency.value = 20000
      this.filter.Q.value = 0.8
      this.music.connect(this.filter).connect(this.master)
      this.reverbSend = ctx.createGain()
      this.reverbSend.gain.value = 0.15
      const verb = ctx.createConvolver()
      verb.buffer = this.impulse(2.4)
      this.music.connect(this.reverbSend).connect(verb).connect(this.filter)
      this.pump = ctx.createGain()
      this.pump.connect(this.music)
      this.sfx = ctx.createGain()
      this.sfx.connect(this.master)
      const len = ctx.sampleRate
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate)
      const d = this.noise.getChannelData(0)
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
      this.applyVolume()
    } catch {
      this.ctx = null
    }
  }

  setVolume(v: number, muted: boolean) {
    this.volume = v
    this.muted = muted
    this.applyVolume()
  }

  /** Volúmenes separados de música y efectos (0 a 1). */
  setMix(music: number, sfx: number) {
    this.mix = { music, sfx }
    this.applyVolume()
  }

  private applyVolume() {
    const ctx = this.ctx
    if (!ctx || !this.master || !this.music || !this.sfx) return
    const now = ctx.currentTime
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 0.9, now, 0.05)
    this.music.gain.setTargetAtTime(this.mix.music * 0.6, now, 0.05)
    this.sfx.gain.setTargetAtTime(this.mix.sfx * 0.9, now, 0.05)
  }

  /** Retardo hasta que lo programado ahora suena de verdad (latencia de salida). */
  private latency(): number {
    const ctx = this.ctx
    if (!ctx) return 0
    return (ctx.outputLatency || 0) + (ctx.baseLatency || 0)
  }

  playTrack(t: Track) {
    const ctx = this.ctx
    if (!ctx || !this.music) return
    if (this.track === t) return
    const now = ctx.currentTime
    // fundido corto entre pistas
    const g = this.music.gain
    g.cancelScheduledValues(now)
    g.setTargetAtTime(0, now, 0.05)
    g.setTargetAtTime(this.mix.music * 0.6, now + 0.28, 0.08)
    this.reverbSend?.gain.setTargetAtTime(REVERB[t], now + 0.25, 0.1)
    this.track = t
    this.step = 0
    this.nextTime = now + 0.3
    if (t !== 'runway') this.walking = false
    this.applyFilter()
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 50)
  }

  stopMusic() {
    this.track = null
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  /** Música adaptativa: 0 = intro suave, 3 = clímax. */
  setIntensity(i: number) {
    this.intensity = Math.max(0, Math.min(3, i))
    this.applyFilter()
  }

  private applyFilter() {
    if (!this.ctx || !this.filter) return
    const f = this.track === 'runway' ? Math.min(20000, 450 * Math.pow(2, this.intensity * 1.9)) : 20000
    this.filter.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.4)
  }

  private schedule() {
    const ctx = this.ctx
    if (!ctx || !this.track) return
    // menú y final van en corcheas (como la pista original); el resto, en semicorcheas
    const sps = 60 / BPM[this.track] / (this.track === 'menu' || this.track === 'ending' ? 2 : 4)
    // si el hilo principal se ha atascado, salta los pasos perdidos en vez de tocarlos de golpe
    while (this.nextTime < ctx.currentTime - 0.05) {
      this.nextTime += sps
      this.step = (this.step + 1) % 64
    }
    while (this.nextTime < ctx.currentTime + 0.2) {
      this.playStep(this.track, this.step, this.nextTime, sps)
      this.nextTime += sps
      this.step = (this.step + 1) % 64
    }
  }

  private playStep(t: Track, step: number, time: number, sps: number) {
    const bar = Math.floor(step / 16) % 4
    const s = step % 16
    const chord = CHORDS[t][bar]
    switch (t) {
      case 'ibiza':
        return this.stepIbiza(chord, bar, s, time, sps)
      case 'disco':
        return this.stepDisco(chord, bar, s, time, sps)
      case 'casa':
        return this.stepCasa(chord, bar, s, time, sps)
      case 'runway':
        return this.stepRunway(chord, bar, s, time, sps)
      default:
        return this.stepPop(t, chord, bar, s, time, sps)
    }
  }

  // ─────────── Pistas ───────────

  /** Pop de menú y final (la música original del juego, en corcheas). */
  private stepPop(t: Track, chord: number[], bar: number, s: number, time: number, spb: number) {
    if (t !== 'ending') {
      if (s % 4 === 0) this.kick(time)
      if (s === 4 || s === 12) this.snare(time)
      if (s % 2 === 1) this.hat(time, 0.05)
    } else if (s === 0) this.kick(time, 0.5)
    if (s % 2 === 0) this.tone(time, NOTE(chord[0] - 24), spb * 1.6, 'triangle', t === 'ending' ? 0.18 : 0.26, this.pump!)
    if (s === 0) for (const n of chord) this.pad(time, NOTE(n), spb * 15)
    if (t !== 'ending' && s % 2 === 0) this.tone(time, NOTE(chord[(s / 2) % 4] + 12), spb * 0.9, 'square', 0.035, this.pump!)
    const m = MELODY[t][s]
    if (m !== null && bar % 2 === 1) this.bell(time, NOTE(chord[0] + m + 12), spb * 1.8, 0.07)
  }

  /** Balear chill: guitarra española pulsada, shaker, bajo redondo y el mar de fondo. */
  private stepIbiza(chord: number[], bar: number, s: number, time: number, sps: number) {
    if (s === 0 || s === 10) this.kick(time, 0.45)
    if (s === 4 || s === 12) this.rim(time)
    this.noiseHit(time, 0.035, s % 4 === 2 ? 0.05 : 0.022, 7000, 'highpass', this.music!) // shaker
    if (s === 0 || s === 7 || s === 8 || s === 14) this.tone(time, NOTE(chord[0] - 12), sps * 3, 'sine', 0.3, this.pump!)
    // arpegio de guitarra en semicorcheas
    const arp = [0, 2, 1, 3, 2, 1, 3, 2]
    if (s % 2 === 0) this.pluck(time, chord[arp[(s / 2) % 8]] + 12, 0.16, s % 4 === 0 ? -0.25 : 0.25)
    if (s === 0) for (const n of chord) this.pad(time, NOTE(n), sps * 16, 0.018, 1100)
    const m = MELODY.ibiza[s]
    if (m !== null && bar % 2 === 1) this.bell(time, NOTE(chord[0] + m + 24), sps * 5, 0.045)
    // ola del mar cada dos compases
    if (s === 0 && bar % 2 === 0) this.swell(time, sps * 28)
  }

  /** House de discoteca: bombo a negras con «sidechain», charles abierto, palmas y acordes de piano. */
  private stepDisco(chord: number[], bar: number, s: number, time: number, sps: number) {
    if (s % 4 === 0) {
      this.kick(time, 1)
      this.duck(time, sps * 3)
    }
    if (s === 4 || s === 12) this.clap(time, 0.2)
    if (s % 4 === 2) this.noiseHit(time, 0.12, 0.07, 9000, 'highpass', this.music!)
    else this.hat(time, 0.018)
    if (s % 4 === 2) this.tone(time, NOTE(chord[0] - 24), sps * 1.6, 'sawtooth', 0.12, this.pump!, 600)
    if (s === 3 || s === 6 || s === 10) for (const n of chord.slice(1)) this.tone(time, NOTE(n), sps * 1.4, 'triangle', 0.045, this.pump!)
    if (s === 0) for (const n of chord) this.pad(time, NOTE(n), sps * 16, 0.022, 2400)
    const m = MELODY.disco[s]
    if (m !== null && bar >= 2) this.bell(time, NOTE(chord[0] + m + 12), sps * 2, 0.05)
  }

  /** Guitarra de casa: punteo alterno (bajo – agudos) y rasgueo al final de la vuelta. */
  private stepCasa(chord: number[], bar: number, s: number, time: number, sps: number) {
    const [root, a, b, c, d] = chord
    if (s === 0 || s === 8) this.pluck(time, root, 0.24, -0.15)
    if (s === 4 || s === 12) this.pluck(time, a, 0.2, -0.1)
    if (s === 2 || s === 10) this.pluck(time, c, 0.16, 0.2)
    if (s === 6 || s === 14) this.pluck(time, d, 0.15, 0.25)
    if (s === 3 || s === 11) this.pluck(time, b, 0.12, 0.1)
    if (bar === 3 && s === 12) chord.forEach((n, i) => this.pluck(time + i * 0.018, n + 12 * (i ? 0 : 1), 0.1, 0.1 - i * 0.05))
    const m = MELODY.casa[s]
    if (m !== null && bar >= 2) this.bell(time, NOTE(root + 24 + m), sps * 4, 0.035)
  }

  /** Pasarela adaptativa: las capas entran según la intensidad y los tacones marcan el tempo. */
  private stepRunway(chord: number[], bar: number, s: number, time: number, sps: number) {
    const I = this.intensity
    if (s % 4 === 0) {
      this.kick(time, 0.7 + I * 0.1)
      if (I >= 2) this.duck(time, sps * 2.5)
      if (this.walking) this.footstep(time, s % 8 === 0 ? -0.3 : 0.3)
    }
    if (I >= 1 && s % 4 === 2) this.hat(time, 0.05)
    if (I >= 2 && s % 4 !== 2) this.hat(time, 0.02)
    if (I >= 1.5 && (s === 4 || s === 12)) this.clap(time, 0.16)
    if (s % 2 === 0) this.tone(time, NOTE(chord[0] - 24), sps * 1.7, I >= 2 ? 'sawtooth' : 'triangle', 0.2, this.pump!, 900)
    if (s === 0) for (const n of chord) this.pad(time, NOTE(n), sps * 15)
    if (I >= 1.5 && s % 2 === 0) this.tone(time, NOTE(chord[(s / 2) % 4] + 12), sps * 1.8, 'square', 0.03, this.pump!)
    const m = MELODY.runway[s]
    if (m !== null && (I >= 2.5 || (I >= 2 && bar % 2 === 1))) {
      this.bell(time, NOTE(chord[0] + m + 12), sps * 3.6, 0.07)
      if (I >= 2.8) this.tone(time, NOTE(chord[0] + m + 24), sps * 2, 'sawtooth', 0.03, this.pump!, 3000)
    }
    if (I >= 2.8 && s === 0 && bar === 0) this.noiseHit(time, 1.4, 0.07, 6000, 'highpass', this.music!) // platillo
  }

  // ─────────── Instrumentos ───────────

  private env(g: GainNode, time: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, time)
    g.gain.exponentialRampToValueAtTime(peak, time + a)
    g.gain.exponentialRampToValueAtTime(0.0001, time + a + d)
  }

  private tone(time: number, f: number, dur: number, type: OscillatorType, vol: number, out: AudioNode, lowpass?: number) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.value = f
    this.env(g, time, 0.01, vol, dur)
    if (lowpass) {
      const flt = ctx.createBiquadFilter()
      flt.type = 'lowpass'
      flt.frequency.value = lowpass
      o.connect(flt).connect(g).connect(out)
    } else o.connect(g).connect(out)
    o.start(time)
    o.stop(time + dur + 0.05)
  }

  private pad(time: number, f: number, dur: number, vol = 0.03, cutoff = 1800) {
    const ctx = this.ctx!
    const g = ctx.createGain()
    const flt = ctx.createBiquadFilter()
    flt.type = 'lowpass'
    flt.frequency.value = cutoff
    g.gain.setValueAtTime(0.0001, time)
    g.gain.exponentialRampToValueAtTime(vol, time + 0.3)
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur)
    for (const det of [-7, 7]) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      o.detune.value = det
      o.connect(flt)
      o.start(time)
      o.stop(time + dur + 0.1)
    }
    flt.connect(g).connect(this.pump!)
  }

  private bell(time: number, f: number, dur: number, vol: number, out?: AudioNode) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    const o2 = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o2.type = 'sine'
    o.frequency.value = f
    o2.frequency.value = f * 2.01
    const g2 = ctx.createGain()
    g2.gain.value = 0.3
    this.env(g, time, 0.005, vol, dur)
    o.connect(g)
    o2.connect(g2).connect(g)
    g.connect(out ?? this.pump!)
    o.start(time)
    o2.start(time)
    o.stop(time + dur + 0.1)
    o2.stop(time + dur + 0.1)
  }

  /** Cuerda pulsada (Karplus-Strong precalculado por nota): suena a guitarra de nailon. */
  private pluck(time: number, midi: number, vol: number, pan = 0) {
    const ctx = this.ctx!
    let buf = this.plucks.get(midi)
    if (!buf) {
      const sr = ctx.sampleRate
      const len = Math.floor(sr * 1.8)
      buf = ctx.createBuffer(1, len, sr)
      const y = buf.getChannelData(0)
      const N = Math.max(2, Math.round(sr / NOTE(midi)))
      let prev = 0
      for (let i = 0; i < N; i++) {
        // ráfaga inicial suavizada (púa de yema, no de uña)
        prev = prev * 0.5 + (Math.random() * 2 - 1) * 0.5
        y[i] = prev
      }
      const decay = 0.996 - Math.max(0, midi - 60) * 0.00015
      for (let i = N; i < len; i++) y[i] = 0.5 * (y[i - N] + y[i - N - 1 < 0 ? 0 : i - N - 1]) * decay
      this.plucks.set(midi, buf)
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    const g = ctx.createGain()
    g.gain.value = vol * 1.6
    const p = ctx.createStereoPanner()
    p.pan.value = pan
    src.connect(g).connect(p).connect(this.pump!)
    src.start(time)
    src.stop(time + 1.8)
  }

  private kick(time: number, vol = 0.9) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.setValueAtTime(140, time)
    o.frequency.exponentialRampToValueAtTime(45, time + 0.12)
    this.env(g, time, 0.003, vol * 0.8, 0.2)
    o.connect(g).connect(this.music!)
    o.start(time)
    o.stop(time + 0.3)
  }

  /** «Sidechain»: los instrumentos melódicos se apartan cuando entra el bombo. */
  private duck(time: number, len: number) {
    const g = this.pump!.gain
    g.cancelScheduledValues(time)
    g.setValueAtTime(0.35, time)
    g.linearRampToValueAtTime(1, time + len)
  }

  private noiseHit(time: number, dur: number, vol: number, freq: number, type: BiquadFilterType, out: AudioNode, attack = 0.002, pan = 0, q = 1) {
    const ctx = this.ctx!
    const s = ctx.createBufferSource()
    s.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    const g = ctx.createGain()
    this.env(g, time, attack, vol, dur)
    let node: AudioNode = s.connect(f).connect(g)
    if (pan) {
      const p = ctx.createStereoPanner()
      p.pan.value = pan
      node = node.connect(p)
    }
    node.connect(out)
    s.start(time, Math.random() * 0.5)
    s.stop(time + attack + dur + 0.05)
  }

  private snare(time: number) {
    this.noiseHit(time, 0.16, 0.22, 1800, 'bandpass', this.music!)
    this.tone(time, 190, 0.08, 'triangle', 0.15, this.music!)
  }

  private clap(time: number, vol: number, out?: AudioNode, pan = 0) {
    for (let i = 0; i < 3; i++) this.noiseHit(time + i * 0.011, i === 2 ? 0.12 : 0.02, vol, 1500, 'bandpass', out ?? this.music!, 0.001, pan, 1.4)
  }

  private rim(time: number) {
    this.tone(time, 1700, 0.03, 'triangle', 0.05, this.music!)
    this.noiseHit(time, 0.02, 0.06, 3500, 'bandpass', this.music!)
  }

  private hat(time: number, vol: number) {
    this.noiseHit(time, 0.04, vol, 8000, 'highpass', this.music!)
  }

  /** Ola: ruido filtrado que crece y se retira. */
  private swell(time: number, dur: number) {
    const ctx = this.ctx!
    const s = ctx.createBufferSource()
    s.buffer = this.noise
    s.loop = true
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.setValueAtTime(250, time)
    f.frequency.linearRampToValueAtTime(900, time + dur * 0.45)
    f.frequency.linearRampToValueAtTime(300, time + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, time)
    g.gain.linearRampToValueAtTime(0.07, time + dur * 0.45)
    g.gain.linearRampToValueAtTime(0.0001, time + dur)
    s.connect(f).connect(g).connect(this.music!)
    s.start(time)
    s.stop(time + dur + 0.05)
  }

  private impulse(seconds: number): AudioBuffer {
    const ctx = this.ctx!
    const len = Math.floor(ctx.sampleRate * seconds)
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3)
    }
    return buf
  }

  // ─────────── Efectos ───────────

  /** Registra el efecto y lanza su vibración a la vez que el sonido. */
  private fx(name: Sfx, delay = 0): number | null {
    if (!this.ctx) return null
    this.log.push({ name, at: performance.now() })
    if (this.log.length > 40) this.log.shift()
    vibrate(HAPTICS[name], (this.latency() + delay) * 1000)
    markSfxVibration()
    return this.ctx.currentTime + delay
  }

  play(name: Sfx, strength?: number) {
    switch (name) {
      case 'click':
        return this.click()
      case 'sparkle':
        return this.sparkle()
      case 'coin':
        return this.coin()
      case 'shutter':
        return this.shutter()
      case 'fanfare':
        return this.fanfare()
      case 'whoosh':
        return this.whoosh()
      case 'error':
        return this.error()
      case 'fabric':
        return this.fabric()
      case 'zipper':
        return this.zipper()
      case 'heel':
        return this.heel()
      case 'step':
        return this.stepSoft()
      case 'jewel':
        return this.jewel()
      case 'clasp':
        return this.clasp()
      case 'applause':
        return this.applause(strength)
    }
  }

  click() {
    const t = this.fx('click')
    if (t === null) return
    this.tone(t, 1320, 0.06, 'sine', 0.12, this.sfx!)
    this.tone(t + 0.02, 1980, 0.05, 'sine', 0.06, this.sfx!)
  }

  sparkle() {
    const t = this.fx('sparkle')
    if (t === null) return
    const notes = [88, 93, 95, 100, 105]
    notes.forEach((n, i) => this.bell(t + i * 0.045, NOTE(n), 0.35, 0.06, this.sfx!))
  }

  coin() {
    const t = this.fx('coin')
    if (t === null) return
    this.tone(t, NOTE(83), 0.08, 'square', 0.06, this.sfx!)
    this.tone(t + 0.08, NOTE(88), 0.25, 'square', 0.06, this.sfx!)
  }

  shutter() {
    const t = this.fx('shutter')
    if (t === null) return
    this.noiseHit(t, 0.05, 0.4, 3000, 'bandpass', this.sfx!)
    this.noiseHit(t + 0.07, 0.08, 0.3, 2000, 'bandpass', this.sfx!)
    this.bell(t + 0.12, NOTE(96), 0.4, 0.05, this.sfx!)
  }

  fanfare() {
    const t = this.fx('fanfare')
    if (t === null) return
    const seq = [74, 78, 81, 86, 81, 86, 90]
    seq.forEach((n, i) => {
      this.tone(t + i * 0.11, NOTE(n), i === seq.length - 1 ? 0.8 : 0.16, 'sawtooth', 0.05, this.sfx!)
      this.bell(t + i * 0.11, NOTE(n + 12), 0.3, 0.04, this.sfx!)
    })
  }

  whoosh() {
    const t = this.fx('whoosh')
    if (t === null) return
    this.noiseHit(t, 0.35, 0.12, 900, 'bandpass', this.sfx!)
  }

  error() {
    const t = this.fx('error')
    if (t === null) return
    this.tone(t, 330, 0.12, 'triangle', 0.1, this.sfx!)
    this.tone(t + 0.12, 262, 0.18, 'triangle', 0.1, this.sfx!)
  }

  /** Roce de tela: tres barridos suaves de ruido. */
  fabric() {
    const t = this.fx('fabric')
    if (t === null) return
    for (let i = 0; i < 3; i++) this.noiseHit(t + i * 0.055, 0.09, 0.14 - i * 0.03, 2600 + i * 700, 'bandpass', this.sfx!, 0.035, i % 2 ? 0.2 : -0.2, 0.7)
  }

  /** Cremallera: dientes cada vez más rápidos y agudos, y el tope final. */
  zipper() {
    const t = this.fx('zipper')
    if (t === null) return
    let at = 0
    for (let i = 0; i < 16; i++) {
      this.noiseHit(t + at, 0.008, 0.16, 2600 + i * 160, 'bandpass', this.sfx!, 0.001, 0, 4)
      at += 0.028 - i * 0.0011
    }
    this.tone(t + at + 0.02, 2100, 0.03, 'square', 0.03, this.sfx!)
  }

  /** Tacón contra el suelo (con un poco de cuerpo de madera). */
  heel(pan = 0, delay = 0, vol = 1) {
    const t = this.fx('heel', delay)
    if (t === null) return
    this.heelAt(t, pan, vol)
  }

  private heelAt(t: number, pan: number, vol: number) {
    this.noiseHit(t, 0.025, 0.3 * vol, 3800, 'highpass', this.sfx!, 0.001, pan)
    this.tone(t, 950, 0.03, 'triangle', 0.08 * vol, this.sfx!)
    this.tone(t, 170, 0.06, 'sine', 0.18 * vol, this.sfx!)
  }

  /** Paso de zapato plano. */
  stepSoft(pan = 0, delay = 0, vol = 1) {
    const t = this.fx('step', delay)
    if (t === null) return
    this.noiseHit(t, 0.06, 0.18 * vol, 650, 'lowpass', this.sfx!, 0.004, pan)
    this.tone(t, 110, 0.05, 'sine', 0.14 * vol, this.sfx!)
  }

  /** Paso de la pasarela, programado a tempo con la música. */
  private footstep(time: number, pan: number) {
    if (!this.ctx || this.footwear === 'descalza') return
    const delay = Math.max(0, time - this.ctx.currentTime)
    if (this.footwear === 'tacon') this.heel(pan, delay, 0.9)
    else if (this.footwear === 'bota') {
      const t = this.fx('heel', delay)
      if (t !== null) {
        this.tone(t, 140, 0.08, 'sine', 0.22, this.sfx!)
        this.noiseHit(t, 0.05, 0.16, 1400, 'bandpass', this.sfx!, 0.002, pan)
      }
    } else this.stepSoft(pan, delay, 0.9)
  }

  /** Joyas: tintineo de cristal. */
  jewel() {
    const t = this.fx('jewel')
    if (t === null) return
    ;[100, 104, 107].forEach((n, i) => this.bell(t + i * 0.05, NOTE(n + Math.random() * 0.3), 0.25, 0.04, this.sfx!))
  }

  /** Cierre metálico de bolso. */
  clasp() {
    const t = this.fx('clasp')
    if (t === null) return
    this.noiseHit(t, 0.012, 0.25, 4200, 'bandpass', this.sfx!, 0.001, 0, 3)
    this.tone(t, 2400, 0.02, 'square', 0.025, this.sfx!)
    this.noiseHit(t + 0.07, 0.015, 0.2, 3600, 'bandpass', this.sfx!, 0.001, 0, 3)
  }

  /** Aplausos del jurado; `strength` (0 a 1) sube la cantidad de palmas y los vítores. */
  applause(strength = 0.6) {
    const t = this.fx('applause')
    if (t === null) return
    const k = Math.max(0, Math.min(1, strength))
    const dur = 1.6 + k * 1.8
    const n = Math.round(24 + k * 70)
    for (let i = 0; i < n; i++) {
      // más densidad al principio, luego se apaga
      const u = Math.pow(Math.random(), 1.6)
      const at = t + u * dur
      const vol = (0.06 + Math.random() * 0.1) * (1 - u * 0.6)
      this.clap(at, vol, this.sfx!, Math.random() * 1.6 - 0.8)
    }
    if (k >= 0.7) {
      // silbido de ánimo
      const ctx = this.ctx!
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.setValueAtTime(1500, t + 0.3)
      o.frequency.exponentialRampToValueAtTime(2600, t + 0.55)
      o.frequency.exponentialRampToValueAtTime(1900, t + 0.8)
      this.env(g, t + 0.3, 0.05, 0.04, 0.5)
      o.connect(g).connect(this.sfx!)
      o.start(t + 0.3)
      o.stop(t + 0.9)
    }
  }
}

export const audio = new AudioEngine()
