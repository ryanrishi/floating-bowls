import { config } from '../config.js'
import { advance, resetFlow, velocityAt } from './current.js'

const flow = { x: 0, y: 0 }

class Bowl {
  constructor(x, y, variation) {
    this.x = x
    this.y = y
    this.vx = 0
    this.vy = 0
    this.variation = variation
    this.setSpread(config.bowls.spread)
  }

  setSpread(spread) {
    this.r = config.bowls.baseRadius * (1 + spread * this.variation)
    this.mass = this.r * this.r
    this.invMass = 1 / this.mass
  }
}

// Collision records are pooled: the render loop reads them and drops them within the
// same frame, so there is no reason to allocate hundreds of objects per second.
class ContactPool {
  constructor() {
    this.items = []
    this.length = 0
  }

  reset() {
    this.length = 0
  }

  push() {
    if (this.length === this.items.length) {
      this.items.push({ a: 0, b: 0, x: 0, y: 0, nx: 0, ny: 0, impulse: 0 })
    }
    return this.items[this.length++]
  }
}

export class World {
  constructor() {
    this.bowls = []
    this.contacts = new ContactPool()
    this.accumulator = 0
    this.cells = new Map()
    resetFlow()
    this.setCount(config.bowls.count)
  }

  get maxRadius() {
    return config.bowls.baseRadius * (1 + config.bowls.spread)
  }

  setCount(n) {
    while (this.bowls.length > n) this.bowls.pop()
    while (this.bowls.length < n) {
      const spot = this.findFreeSpot()
      if (!spot) break
      this.bowls.push(new Bowl(spot.x, spot.y, Math.random() * 2 - 1))
    }
  }

  setSpread(spread) {
    config.bowls.spread = spread
    for (const bowl of this.bowls) bowl.setSpread(spread)
  }

  findFreeSpot() {
    const limit = config.basin.radius - this.maxRadius * 1.5
    for (let attempt = 0; attempt < 60; attempt++) {
      const a = Math.random() * Math.PI * 2
      const d = Math.sqrt(Math.random()) * limit
      const x = Math.cos(a) * d
      const y = Math.sin(a) * d
      const clear = this.bowls.every((b) => {
        const need = b.r + this.maxRadius
        return (b.x - x) ** 2 + (b.y - y) ** 2 > need * need
      })
      if (clear) return { x, y }
    }
    return null
  }

  // Advances by whole fixed steps and returns every contact made along the way.
  update(dt) {
    const { fixedStep, maxStepsPerFrame } = config.physics
    this.contacts.reset()
    this.accumulator = Math.min(this.accumulator + dt, fixedStep * maxStepsPerFrame)
    while (this.accumulator >= fixedStep) {
      this.step(fixedStep)
      this.accumulator -= fixedStep
    }
    return this.contacts
  }

  step(dt) {
    advance(dt)

    const { drag } = config.current
    const base = config.bowls.baseRadius

    for (const b of this.bowls) {
      velocityAt(b.x, b.y, flow)
      // A bowl's inertia grows with its area while the water's grip on it grows only
      // with its girth, so a big bowl answers the current more slowly than a small one.
      // Neighbours of different sizes therefore drift apart and overtake each other,
      // and that -- not being herded into a crowd -- is what makes them meet.
      const pull = 1 - Math.exp((-drag * base * dt) / b.r)
      b.vx += (flow.x - b.vx) * pull
      b.vy += (flow.y - b.vy) * pull
      b.x += b.vx * dt
      b.y += b.vy * dt
    }

    this.resolveWalls()
    this.resolveCollisions()
  }

  resolveWalls() {
    const { wallDamping } = config.physics
    for (const b of this.bowls) {
      const d = Math.hypot(b.x, b.y)
      const limit = config.basin.radius - b.r
      if (d <= limit || d < 1e-6) continue

      const nx = b.x / d
      const ny = b.y / d
      b.x = nx * limit
      b.y = ny * limit

      const radial = b.vx * nx + b.vy * ny
      if (radial > 0) {
        b.vx -= (1 + wallDamping) * radial * nx
        b.vy -= (1 + wallDamping) * radial * ny
      }
    }
  }

  buildGrid() {
    const cell = this.maxRadius * 2
    this.cellSize = cell
    for (const bucket of this.cells.values()) bucket.length = 0
    for (let i = 0; i < this.bowls.length; i++) {
      const b = this.bowls[i]
      const key = cellKey(Math.floor(b.x / cell), Math.floor(b.y / cell))
      let bucket = this.cells.get(key)
      if (!bucket) this.cells.set(key, (bucket = []))
      bucket.push(i)
    }
  }

  resolveCollisions() {
    this.buildGrid()
    const cell = this.cellSize
    const { restitution } = config.bowls
    const massRef = config.bowls.baseRadius * config.bowls.baseRadius

    for (let i = 0; i < this.bowls.length; i++) {
      const a = this.bowls[i]
      const cx = Math.floor(a.x / cell)
      const cy = Math.floor(a.y / cell)

      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const bucket = this.cells.get(cellKey(cx + ox, cy + oy))
          if (!bucket) continue

          for (const j of bucket) {
            // Each pair is visited once: the lower index always does the work.
            if (j <= i) continue
            const b = this.bowls[j]

            const dx = b.x - a.x
            const dy = b.y - a.y
            const sum = a.r + b.r
            const distSq = dx * dx + dy * dy
            if (distSq >= sum * sum || distSq < 1e-9) continue

            const dist = Math.sqrt(distSq)
            const nx = dx / dist
            const ny = dy / dist

            const correction = ((sum - dist) * 0.8) / (a.invMass + b.invMass)
            a.x -= nx * correction * a.invMass
            a.y -= ny * correction * a.invMass
            b.x += nx * correction * b.invMass
            b.y += ny * correction * b.invMass

            const approach = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
            if (approach >= 0) continue

            const j0 = (-(1 + restitution) * approach) / (a.invMass + b.invMass)
            a.vx -= j0 * a.invMass * nx
            a.vy -= j0 * a.invMass * ny
            b.vx += j0 * b.invMass * nx
            b.vy += j0 * b.invMass * ny

            const contact = this.contacts.push()
            contact.a = i
            contact.b = j
            contact.x = a.x + nx * a.r
            contact.y = a.y + ny * a.r
            contact.nx = nx
            contact.ny = ny
            contact.impulse = j0 / massRef
          }
        }
      }
    }
  }

  // Used by the click interaction: shove everything near a point outward.
  splash(x, y, radius, strength) {
    for (const b of this.bowls) {
      const dx = b.x - x
      const dy = b.y - y
      const d = Math.hypot(dx, dy)
      if (d > radius || d < 1e-4) continue
      const falloff = (1 - d / radius) * strength
      b.vx += (dx / d) * falloff
      b.vy += (dy / d) * falloff
    }
  }
}

// Cell indices stay well inside +/-512 for any basin and bowl size used here, so this
// packs a coordinate pair into one integer without any chance of two cells colliding.
function cellKey(x, y) {
  return (x + 512) * 1024 + (y + 512)
}
