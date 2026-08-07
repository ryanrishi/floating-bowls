import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { config } from '../config.js'

export const GROUND_LAYER = 1

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05

  const scene = new THREE.Scene()

  // The bowls are glazed porcelain, so almost all of their character comes from what
  // they reflect. RoomEnvironment gives that for free, with no HDR file to ship.
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

  scene.add(makeSky())
  scene.add(...makeBasin())

  const sun = new THREE.DirectionalLight(0xfff3e0, 2.4)
  sun.position.set(...config.render.sunDirection).multiplyScalar(30)
  scene.add(sun)
  scene.add(new THREE.AmbientLight(0x88aacc, 0.35))

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 500)
  const pitch = THREE.MathUtils.degToRad(config.render.cameraPitch)
  camera.position.set(
    0,
    Math.sin(pitch) * config.render.cameraDistance,
    Math.cos(pitch) * config.render.cameraDistance,
  )
  camera.lookAt(0, 0, 0)
  camera.layers.enable(GROUND_LAYER)

  function resize() {
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  addEventListener('resize', resize)
  resize()

  return { renderer, scene, camera, resize }
}

// The water is only as interesting as what it has to reflect. This stands in for the
// lit ceiling of a hall: dark at the horizon, pale overhead, with one soft skylight in
// the sun's direction that the waves break up into moving glints.
function makeSky() {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x93a9bb) },
      uBottom: { value: new THREE.Color(0x0b1720) },
      uGlow: { value: new THREE.Color(0xfdf4e4) },
      uSun: { value: new THREE.Vector3(...config.render.sunDirection).normalize() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uBottom;
      uniform vec3 uGlow;
      uniform vec3 uSun;
      varying vec3 vDirection;
      void main() {
        vec3 sky = mix(uBottom, uTop, smoothstep(-0.05, 0.75, vDirection.y));
        float skylight = pow(max(dot(vDirection, uSun), 0.0), 12.0);
        gl_FragColor = vec4(mix(sky, uGlow, skylight * 0.85), 1.0);
        #include <colorspace_fragment>
      }
    `,
  })
  return new THREE.Mesh(new THREE.SphereGeometry(200, 48, 24), material)
}

function makeBasin() {
  const { radius, depth, floorColor } = config.basin

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 128),
    new THREE.MeshStandardMaterial({ color: floorColor, roughness: 0.85 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -depth

  const inner = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, depth, 128, 1, true),
    new THREE.MeshStandardMaterial({
      color: floorColor,
      roughness: 0.8,
      side: THREE.BackSide,
    }),
  )
  inner.position.y = -depth / 2

  const rimHeight = 0.14
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(radius + 0.09, radius + 0.09, depth + rimHeight, 128, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x2b3238, roughness: 0.6, side: THREE.DoubleSide }),
  )
  rim.position.y = rimHeight / 2 - depth / 2

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(90, 64),
    new THREE.MeshStandardMaterial({ color: 0x14181c, roughness: 0.95 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -depth - 0.005
  // Mirrored in the water this disc becomes a ceiling, and its far edge draws a hard
  // horizontal band across the basin. It is kept out of the reflection entirely.
  ground.layers.set(GROUND_LAYER)

  return [floor, inner, rim, ground]
}
