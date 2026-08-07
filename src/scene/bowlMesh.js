import * as THREE from 'three'
import { config } from '../config.js'
import { CAP_ORDER } from './order.js'

const TILT_STIFFNESS = 90
const TILT_DAMPING = 6
const BOB_STIFFNESS = 150
const BOB_DAMPING = 7
const TILT_KICK = 1.6
const BOB_KICK = 0.6
// Kicks are dealt out by the simulation, which keeps running while the render loop is
// paused. Without a ceiling the bowls would store up every blow and spin when it resumes.
const MAX_TILT_SPEED = 3

const WALL = 0.09

// One shared unit bowl -- radius 1, height 1 -- scaled per instance. Separate meshes
// rather than an InstancedMesh, because each bowl carries its own rocking motion.
function makeGeometry() {
  const steps = 14
  const profile = []

  for (let i = 0; i <= steps; i++) {
    const a = ((i / steps) * Math.PI) / 2
    profile.push(new THREE.Vector2(Math.sin(a), 1 - Math.cos(a)))
  }
  for (let i = steps; i >= 0; i--) {
    const a = ((i / steps) * Math.PI) / 2
    const s = 1 - WALL
    profile.push(new THREE.Vector2(Math.sin(a) * s, (1 - Math.cos(a)) * s + WALL))
  }

  return new THREE.LatheGeometry(profile, 40)
}

// An invisible lid across the mouth of the bowl. It writes only depth, and it is drawn
// after the bowls but before the water, so the water fails the depth test inside the
// bowl and never paints its interior. Outside the mouth the water still covers the
// submerged part of the wall, which is what makes a bowl read as floating in the water
// rather than sitting on top of it.
function makeCaps(count) {
  const geometry = new THREE.CircleGeometry(1 - WALL, 40)
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, 1, 0)

  const caps = new THREE.InstancedMesh(
    geometry,
    new THREE.MeshBasicMaterial({ colorWrite: false }),
    count,
  )
  caps.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  caps.frustumCulled = false
  caps.renderOrder = CAP_ORDER
  caps.count = 0
  return caps
}

function makeMaterial() {
  return new THREE.MeshPhysicalMaterial({
    color: 0xf6f3ec,
    roughness: 0.2,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    side: THREE.DoubleSide,
  })
}

export class BowlMeshes {
  constructor(scene) {
    this.scene = scene
    this.geometry = makeGeometry()
    this.material = makeMaterial()
    this.caps = makeCaps(config.bowls.maxCount)
    this.items = []
    scene.add(this.caps)
  }

  sync(bowls) {
    while (this.items.length > bowls.length) {
      this.scene.remove(this.items.pop().mesh)
    }
    while (this.items.length < bowls.length) {
      const mesh = new THREE.Mesh(this.geometry, this.material)
      this.scene.add(mesh)
      this.items.push({
        mesh,
        tiltX: 0,
        tiltZ: 0,
        tiltVX: 0,
        tiltVZ: 0,
        bob: 0,
        bobV: 0,
        spin: Math.random() * Math.PI * 2,
        spinRate: (Math.random() - 0.5) * 0.5,
      })
    }
  }

  // A strike tips the bowl away from the contact and pushes it down into the water.
  // strength is the normalised 0..1 blow, the same number the audio engine uses.
  kick(index, dirX, dirZ, strength) {
    const item = this.items[index]
    if (!item) return
    item.tiltVZ = clamp(item.tiltVZ - dirX * strength * TILT_KICK)
    item.tiltVX = clamp(item.tiltVX + dirZ * strength * TILT_KICK)
    item.bobV -= strength * BOB_KICK
  }

  update(bowls, dt) {
    const { height, draft } = config.bowls
    const rest = -height * draft

    for (let i = 0; i < bowls.length; i++) {
      const bowl = bowls[i]
      const item = this.items[i]

      item.tiltVX += (-TILT_STIFFNESS * item.tiltX - TILT_DAMPING * item.tiltVX) * dt
      item.tiltVZ += (-TILT_STIFFNESS * item.tiltZ - TILT_DAMPING * item.tiltVZ) * dt
      item.tiltX += item.tiltVX * dt
      item.tiltZ += item.tiltVZ * dt

      item.bobV += (-BOB_STIFFNESS * item.bob - BOB_DAMPING * item.bobV) * dt
      item.bob += item.bobV * dt

      item.spin += item.spinRate * dt

      item.mesh.position.set(bowl.x, rest + item.bob * bowl.r, bowl.y)
      item.mesh.scale.set(bowl.r, height, bowl.r)
      item.mesh.rotation.set(item.tiltX, item.spin, item.tiltZ)

      item.mesh.updateMatrix()
      this.caps.setMatrixAt(i, item.mesh.matrix)
    }

    this.caps.count = bowls.length
    this.caps.instanceMatrix.needsUpdate = true
  }
}

function clamp(v) {
  return Math.max(-MAX_TILT_SPEED, Math.min(MAX_TILT_SPEED, v))
}
