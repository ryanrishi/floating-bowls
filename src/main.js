import * as THREE from 'three'
import { config } from './config.js'
import { World } from './physics/world.js'
import { AudioEngine } from './audio/engine.js'
import { createStage } from './scene/stage.js'
import { Ripples } from './scene/ripples.js'
import { createWater } from './scene/water.js'
import { BowlMeshes } from './scene/bowlMesh.js'
import { createControls } from './ui/controls.js'
import { createDebugOverlay } from './debug.js'

const { renderer, scene, camera } = createStage(document.getElementById('stage'))
const ripples = new Ripples(renderer)
const water = createWater(ripples.texture)
scene.add(water)

const world = new World()
const meshes = new BowlMeshes(scene)
const audio = new AudioEngine()
const debug = createDebugOverlay(camera, world)

meshes.sync(world.bowls)

createControls({
  onStart: () => audio.start(),
  onCount: (value) => {
    world.setCount(value)
    meshes.sync(world.bowls)
  },
  onCurrent: (value) => {
    config.current.strength = value
  },
  onSpread: (value) => world.setSpread(value),
  onReverb: (value) => audio.setReverb(value),
  onVolume: (value) => audio.setVolume(value),
})

const pointer = new THREE.Vector2()
const raycaster = new THREE.Raycaster()
const waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
const hit = new THREE.Vector3()

addEventListener('pointerdown', (event) => {
  if (event.target.closest('#panel') || event.target.closest('.overlay')) return
  pointer.x = (event.clientX / innerWidth) * 2 - 1
  pointer.y = -(event.clientY / innerHeight) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
  if (!raycaster.ray.intersectPlane(waterPlane, hit)) return
  if (Math.hypot(hit.x, hit.z) > config.basin.radius) return

  ripples.drop(hit.x, hit.z, 0.9, -config.ripples.clickStrength)
  world.splash(hit.x, hit.z, 2.0, 0.6)
})

// The piece is split across two clocks. The simulation and the sound run off a worker
// timer, which a hidden tab does not throttle, so the basin keeps playing when you look
// away. Drawing runs off requestAnimationFrame, which a hidden tab stops -- as it should,
// since there is nobody watching.
const pendingRipples = []
let simulatedAt = performance.now()
let drawnAt = performance.now()

new Worker(new URL('./clock.worker.js', import.meta.url), { type: 'module' }).onmessage =
  simulate

function simulate() {
  const now = performance.now()
  const dt = Math.min((now - simulatedAt) / 1000, 0.05)
  simulatedAt = now

  // One collision, three consumers: it is heard, it spreads a wave, and it rocks both
  // bowls. Nothing in the piece is driven from anywhere else.
  const contacts = world.update(dt)
  const watching = !document.hidden

  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts.items[i]
    if (contact.impulse < config.audio.minImpulse) continue

    const a = world.bowls[contact.a]
    audio.strike(a, contact.a, contact)
    audio.strike(world.bowls[contact.b], contact.b, contact)
    if (!watching) continue

    const strength = Math.min(contact.impulse / config.audio.maxImpulse, 1)
    meshes.kick(contact.a, -contact.nx, -contact.ny, strength)
    meshes.kick(contact.b, contact.nx, contact.ny, strength)

    // Ripples are injected by the renderer, so they queue until the next frame. The
    // cap keeps the queue from growing without bound if frames are slow or stopped.
    if (pendingRipples.length < 64) {
      pendingRipples.push({ x: contact.x, y: contact.y, radius: a.r * 1.8, strength })
    }
  }
}

function draw(now) {
  requestAnimationFrame(draw)
  const dt = Math.min((now - drawnAt) / 1000, 0.05)
  drawnAt = now

  for (const r of pendingRipples) {
    ripples.drop(r.x, r.y, r.radius, -config.ripples.dropStrength * r.strength)
  }
  pendingRipples.length = 0

  ripples.update()
  meshes.update(world.bowls, dt)
  water.material.uniforms.tRipples.value = ripples.texture

  renderer.render(scene, camera)
  debug.draw()
}

requestAnimationFrame(draw)
