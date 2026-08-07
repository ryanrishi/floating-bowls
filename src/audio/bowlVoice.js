import { config } from '../config.js'

// One strike of one bowl, built from scratch and torn down when it has rung out.
// The timbre is modal: a handful of sine partials at inharmonic ratios, each quieter
// and shorter-lived than the last. That fall-off is what makes it read as ceramic
// rather than as an organ.
export function playStrike(ctx, dest, noiseBuffer, voice, onEnded) {
  const { partials, partialFalloff } = config.audio
  const t = ctx.currentTime
  const nyquist = ctx.sampleRate * 0.45

  const panner = new StereoPannerNode(ctx, { pan: voice.pan })
  panner.connect(dest)

  let last = null
  let lastStop = 0

  partials.forEach((ratio, i) => {
    const freq = voice.f0 * ratio * (1 + (Math.random() - 0.5) * 0.006)
    if (freq > nyquist) return

    const peak = voice.amp * partialFalloff ** i * voice.brightness ** i
    if (peak < 1e-4) return

    // Higher modes shed their energy faster, so the tone darkens as it decays.
    const decay = voice.decay / (1 + i * 0.85)
    const gain = new GainNode(ctx, { gain: 0 })
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(peak, t + 0.002)
    gain.gain.exponentialRampToValueAtTime(1e-4, t + decay)

    const osc = new OscillatorNode(ctx, { type: 'sine', frequency: freq })
    osc.connect(gain).connect(panner)
    osc.start(t)
    osc.stop(t + decay + 0.02)

    if (t + decay > lastStop) {
      lastStop = t + decay
      last = osc
    }
  })

  // The contact tick: a very short band of noise around the third partial. Without it
  // a strike sounds struck-by-nothing.
  const tick = new AudioBufferSourceNode(ctx, { buffer: noiseBuffer })
  tick.playbackRate.value = 0.7 + Math.random() * 0.6
  const tickFilter = new BiquadFilterNode(ctx, {
    type: 'bandpass',
    frequency: Math.min(voice.f0 * 3.5, nyquist),
    Q: 1.4,
  })
  const tickGain = new GainNode(ctx)
  tickGain.gain.setValueAtTime(voice.amp * 0.5, t)
  tickGain.gain.exponentialRampToValueAtTime(1e-4, t + 0.012)
  tick.connect(tickFilter).connect(tickGain).connect(panner)
  tick.start(t)
  tick.stop(t + 0.05)

  if (!last) {
    tick.onended = () => {
      panner.disconnect()
      onEnded()
    }
    return
  }

  last.onended = () => {
    panner.disconnect()
    onEnded()
  }
}
