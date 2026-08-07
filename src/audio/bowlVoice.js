import { config } from '../config.js'

// One strike of one bowl, built from scratch and torn down when it has rung out.
// The timbre is modal: a handful of sine partials at inharmonic ratios, each quieter
// and shorter-lived than the last. That fall-off is what makes it read as ceramic
// rather than as an organ.
export function playStrike(ctx, dest, noiseBuffer, voice, onEnded) {
  const { partials, partialFalloff, damping } = config.audio
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

    // Damping follows frequency, not mode number. A struck object loses its high modes
    // roughly in proportion to their pitch, so the top of the spectrum is gone within a
    // few tens of milliseconds and only the bottom two modes are left ringing. Tying
    // this to the mode index instead lets a 12 kHz partial sing for a quarter of a
    // second, which is exactly what makes a struck object sound like metal.
    const decay = voice.decay / ratio ** damping
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

  // The contact tick. Ceramic-on-ceramic contact is a broad click rather than a pitched
  // ring, so the band is wide and low-Q -- a narrow one adds its own metallic tone.
  const tick = new AudioBufferSourceNode(ctx, { buffer: noiseBuffer })
  tick.playbackRate.value = 0.7 + Math.random() * 0.6
  const tickFilter = new BiquadFilterNode(ctx, {
    type: 'bandpass',
    frequency: Math.min(voice.f0 * 2.4, nyquist),
    Q: 0.8,
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
