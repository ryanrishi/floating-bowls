import { config } from '../config.js'
import { playStrike } from './bowlVoice.js'

export class AudioEngine {
  constructor() {
    this.ctx = null
    this.activeVoices = 0
    this.lastStrikeAt = new Float32Array(config.bowls.maxCount)
  }

  async start() {
    if (this.ctx) return
    const ctx = new AudioContext()
    await ctx.resume()

    this.master = new GainNode(ctx, { gain: config.audio.masterGain })
    const limiter = new DynamicsCompressorNode(ctx, {
      threshold: -14,
      knee: 12,
      ratio: 6,
      attack: 0.004,
      release: 0.25,
    })
    this.master.connect(limiter).connect(ctx.destination)

    this.bus = new GainNode(ctx)
    this.dry = new GainNode(ctx, { gain: 1 - config.audio.reverbWet })
    this.wet = new GainNode(ctx, { gain: config.audio.reverbWet })
    this.reverb = new ConvolverNode(ctx, { buffer: makeImpulseResponse(ctx) })

    this.bus.connect(this.dry).connect(this.master)
    this.bus.connect(this.reverb).connect(this.wet).connect(this.master)

    this.noise = makeNoiseBuffer(ctx)
    this.ctx = ctx
  }

  setVolume(value) {
    config.audio.masterGain = value
    if (this.master) this.master.gain.value = value
  }

  setReverb(value) {
    config.audio.reverbWet = value
    if (!this.ctx) return
    this.wet.gain.value = value
    this.dry.gain.value = 1 - value * 0.7
  }

  // Bowls collide in bursts. Without a budget one busy frame turns into a wall of
  // noise and the graph starts to glitch, so quiet, repeated and surplus strikes
  // are dropped here rather than in the caller.
  strike(bowl, index, contact) {
    if (!this.ctx) return false
    const { minImpulse, maxImpulse, bowlCooldown, maxVoices } = config.audio

    const impulse = Math.abs(contact.impulse)
    if (impulse < minImpulse) return false
    if (this.activeVoices >= maxVoices) return false

    const now = this.ctx.currentTime
    if (now - this.lastStrikeAt[index] < bowlCooldown) return false
    this.lastStrikeAt[index] = now

    const strength = Math.min(impulse / maxImpulse, 1)
    const sizeRatio = bowl.r / config.bowls.baseRadius

    this.activeVoices++
    playStrike(this.ctx, this.bus, this.noise, {
      f0: config.audio.pitchK / bowl.r,
      amp: strength ** 0.7 * 0.3,
      brightness: 0.5 + 0.45 * strength,
      decay: config.audio.baseDecay * sizeRatio * (0.6 + 0.4 * strength),
      pan: Math.max(-1, Math.min(1, contact.x / config.basin.radius)) * 0.8,
    }, () => {
      this.activeVoices--
    })
    return true
  }
}

function makeImpulseResponse(ctx) {
  const length = Math.floor(ctx.sampleRate * config.audio.reverbSeconds)
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel)
    let lowpassed = 0
    for (let i = 0; i < length; i++) {
      const decay = (1 - i / length) ** 2.6
      lowpassed += ((Math.random() * 2 - 1) - lowpassed) * 0.42
      data[i] = lowpassed * decay
    }
  }
  return buffer
}

function makeNoiseBuffer(ctx) {
  const length = Math.floor(ctx.sampleRate * 0.05)
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}
