import { config } from '../config.js'

// The flow field standing in for the submerged jets of the installation: a slow rotation
// of the whole basin plus a travelling spectrum of eddies.
//
// The eddies come from a stream function -- a sum of travelling sine waves -- so the
// velocity is divergence-free by construction, and a divergence-free flow neither gathers
// nor scatters the bowls. Only inertia does: a bowl lags the water and so gets thrown out
// of every eddy core onto the strain lines between them.
//
// That is why the eddies travel. Held still they have fixed strain lines, the bowls
// settle onto the same ones and stay there, and the basin holds one arrangement
// indefinitely. Each mode moves at its own rate instead, sweeping the strain lines
// through the basin so the layout never finishes reorganising.
//
// Nothing here pushes the bowls radially. An earlier version pulled them inward near the
// wall to stop them centrifuging into the rim, but a radial pull is a sink, and a sink
// packs bowls together everywhere it acts -- it turned out to be the single biggest
// cause of the clumping it was meant to prevent. Travelling eddies do not centrifuge, so
// the basin stays evenly filled on its own.
let modes = []
let time = 0

// The modes are derived from config, so they have to be rebuilt whenever it changes
// rather than frozen at import.
export function resetFlow() {
  modes = buildModes()
  time = 0
}

function buildModes() {
  const { count, longest, shortest, speed } = config.current.eddies
  const built = []

  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1)
    const wavelength = longest * (shortest / longest) ** t
    const k = (Math.PI * 2) / wavelength
    // The golden angle spreads the directions without ever repeating one.
    const angle = i * 2.399963229
    // Big eddies carry more of the energy, as they do in a real basin.
    const velocity = Math.sqrt(wavelength / longest)

    built.push({
      kx: Math.cos(angle) * k,
      ky: Math.sin(angle) * k,
      amplitude: velocity / k,
      omega: speed * k * (0.6 + 0.5 * t),
      phase: i * 1.7,
    })
  }

  const total = built.reduce((s, m) => s + m.amplitude * Math.hypot(m.kx, m.ky), 0)
  for (const m of built) m.amplitude /= total
  return built
}

export function advance(dt) {
  time += dt
}

export function velocityAt(x, y, out) {
  const { swirl, eddies, strength } = config.current

  let vx = -y * swirl
  let vy = x * swirl

  for (const m of modes) {
    // u = -dPsi/dy, v = dPsi/dx for Psi = amplitude * sin(k.x + omega t + phase).
    const wave = Math.cos(m.kx * x + m.ky * y + m.omega * time + m.phase) * m.amplitude
    vx -= m.ky * wave * eddies.strength
    vy += m.kx * wave * eddies.strength
  }

  out.x = vx * strength
  out.y = vy * strength
  return out
}
