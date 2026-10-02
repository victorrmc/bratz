// Audio 100 % sintetizado con Web Audio: música pop original y efectos.
// Arranca tras la primera interacción del usuario.

type Track = 'menu' | 'runway' | 'ending'

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

// Progresión original en Re mayor: I – vi – IV – V (con séptimas)
const CHORDS: Record<Track, number[][]> = {
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
}
const BPM: Record<Track, number> = { menu: 112, runway: 122, ending: 92 }
// Melodía (semitonos sobre la tónica de cada acorde), 16 corcheas por compás
const MELODY: Record<Track, (number | null)[]> = {
  menu: [7, null, 9, 7, 4, null, 2, 4, 7, null, 12, null, 11, 9, 7, null],
  runway: [12, null, null, 12, 10, null, 7, null, 12, null, 15, 14, 12, null, 10, null],
  ending: [4, null, 7, null, 11, null, 12, null, 11, null, 7, null, 4, null, 2, null],
}

class AudioEngine {
  ctx: AudioContext | null = null
  master: GainNode | null = null
  music: GainNode | null = null
  sfx: GainNode | null = null
  noise: AudioBuffer | null = null
  private track: Track | null = null
  private step = 0
  private nextTime = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private volume = 0.7
  private muted = false

  /** Debe llamarse dentro de un gesto del usuario. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      this.ctx = new AC()
      this.master = this.ctx.createGain()
      const comp = this.ctx.createDynamicsCompressor()
      comp.threshold.value = -14
      comp.ratio.value = 3
      this.master.connect(comp).connect(this.ctx.destination)
      this.music = this.ctx.createGain()
      this.music.gain.value = 0.5
      this.music.connect(this.master)
      this.sfx = this.ctx.createGain()
      this.sfx.gain.value = 0.8
      this.sfx.connect(this.master)
      const len = this.ctx.sampleRate
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
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

  private applyVolume() {
    if (!this.master || !this.ctx) return
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume * 0.9, this.ctx.currentTime, 0.05)
  }

  playTrack(t: Track) {
    if (!this.ctx) return
    if (this.track === t) return
    this.track = t
    this.step = 0
    this.nextTime = this.ctx.currentTime + 0.1
    if (!this.timer) this.timer = setInterval(() => this.schedule(), 50)
  }

  stopMusic() {
    this.track = null
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private schedule() {
    const ctx = this.ctx
    if (!ctx || !this.track) return
    const spb = 60 / BPM[this.track] / 2 // corchea
    while (this.nextTime < ctx.currentTime + 0.2) {
      this.playStep(this.track, this.step, this.nextTime, spb)
      this.nextTime += spb
      this.step = (this.step + 1) % 64
    }
  }

  private playStep(t: Track, step: number, time: number, spb: number) {
    const bar = Math.floor(step / 16) % 4
    const s = step % 16
    const chord = CHORDS[t][bar]
    // batería
    if (t !== 'ending') {
      if (s % 4 === 0) this.kick(time)
      if (s === 4 || s === 12) this.snare(time)
      if (s % 2 === 1 || t === 'runway') this.hat(time, s % 2 ? 0.05 : 0.025)
    } else if (s === 0) this.kick(time, 0.5)
    // bajo
    if (s % 2 === 0) this.tone(time, NOTE(chord[0] - 24), spb * 1.6, 'triangle', t === 'ending' ? 0.18 : 0.26, this.music!)
    // acordes (pad)
    if (s === 0) for (const n of chord) this.pad(time, NOTE(n), spb * 15)
    // arpegio brillante
    if (t !== 'ending' && s % 2 === 0) this.tone(time, NOTE(chord[(s / 2) % 4] + 12), spb * 0.9, 'square', 0.035, this.music!)
    // melodía
    const m = MELODY[t][s]
    if (m !== null && bar % 2 === 1) this.bell(time, NOTE(chord[0] + m + 12), spb * 1.8, 0.07)
  }

  private env(g: GainNode, time: number, a: number, peak: number, d: number) {
    g.gain.setValueAtTime(0.0001, time)
    g.gain.exponentialRampToValueAtTime(peak, time + a)
    g.gain.exponentialRampToValueAtTime(0.0001, time + a + d)
  }

  private tone(time: number, f: number, dur: number, type: OscillatorType, vol: number, out: AudioNode) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.value = f
    this.env(g, time, 0.01, vol, dur)
    o.connect(g).connect(out)
    o.start(time)
    o.stop(time + dur + 0.05)
  }

  private pad(time: number, f: number, dur: number) {
    const ctx = this.ctx!
    const g = ctx.createGain()
    const flt = ctx.createBiquadFilter()
    flt.type = 'lowpass'
    flt.frequency.value = 1800
    g.gain.setValueAtTime(0.0001, time)
    g.gain.exponentialRampToValueAtTime(0.03, time + 0.3)
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
    flt.connect(g).connect(this.music!)
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
    g.connect(out ?? this.music!)
    o.start(time)
    o2.start(time)
    o.stop(time + dur + 0.1)
    o2.stop(time + dur + 0.1)
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

  private noiseHit(time: number, dur: number, vol: number, freq: number, type: BiquadFilterType, out: AudioNode) {
    const ctx = this.ctx!
    const s = ctx.createBufferSource()
    s.buffer = this.noise
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    const g = ctx.createGain()
    this.env(g, time, 0.002, vol, dur)
    s.connect(f).connect(g).connect(out)
    s.start(time, Math.random() * 0.5)
    s.stop(time + dur + 0.05)
  }

  private snare(time: number) {
    this.noiseHit(time, 0.16, 0.22, 1800, 'bandpass', this.music!)
    this.tone(time, 190, 0.08, 'triangle', 0.15, this.music!)
  }

  private hat(time: number, vol: number) {
    this.noiseHit(time, 0.04, vol, 8000, 'highpass', this.music!)
  }

  // ─────────── Efectos ───────────
  click() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.tone(t, 1320, 0.06, 'sine', 0.12, this.sfx!)
    this.tone(t + 0.02, 1980, 0.05, 'sine', 0.06, this.sfx!)
  }

  sparkle() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const notes = [88, 93, 95, 100, 105]
    notes.forEach((n, i) => this.bell(t + i * 0.045, NOTE(n), 0.35, 0.06, this.sfx!))
  }

  coin() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.tone(t, NOTE(83), 0.08, 'square', 0.06, this.sfx!)
    this.tone(t + 0.08, NOTE(88), 0.25, 'square', 0.06, this.sfx!)
  }

  shutter() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.noiseHit(t, 0.05, 0.4, 3000, 'bandpass', this.sfx!)
    this.noiseHit(t + 0.07, 0.08, 0.3, 2000, 'bandpass', this.sfx!)
    this.bell(t + 0.12, NOTE(96), 0.4, 0.05, this.sfx!)
  }

  fanfare() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const seq = [74, 78, 81, 86, 81, 86, 90]
    seq.forEach((n, i) => {
      this.tone(t + i * 0.11, NOTE(n), i === seq.length - 1 ? 0.8 : 0.16, 'sawtooth', 0.05, this.sfx!)
      this.bell(t + i * 0.11, NOTE(n + 12), 0.3, 0.04, this.sfx!)
    })
  }

  whoosh() {
    if (!this.ctx) return
    this.noiseHit(this.ctx.currentTime, 0.35, 0.12, 900, 'bandpass', this.sfx!)
  }

  error() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.tone(t, 330, 0.12, 'triangle', 0.1, this.sfx!)
    this.tone(t + 0.12, 262, 0.18, 'triangle', 0.1, this.sfx!)
  }
}

export const audio = new AudioEngine()

/** Vibración háptica si el dispositivo la soporta. */
export function buzz(ms = 12) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(ms)
  } catch {
    /* sin vibración */
  }
}
