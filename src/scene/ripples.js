import * as THREE from 'three'
import { config } from '../config.js'

// A height field over the basin, stepped on the GPU. Every collision drops a bump into
// it, so the waves you see always start where a sound was made. The red channel holds
// the surface height and the green channel its velocity; the water shader reads the red
// channel and takes its gradient for the normal.
export class Ripples {
  constructor(renderer) {
    this.renderer = renderer
    const size = config.ripples.size

    const options = {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
    }
    this.targets = [
      new THREE.WebGLRenderTarget(size, size, options),
      new THREE.WebGLRenderTarget(size, size, options),
    ]

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    this.simMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tState: { value: null },
        uTexel: { value: 1 / size },
        uDamping: { value: config.ripples.damping },
      },
      vertexShader: QUAD_VERTEX,
      fragmentShader: /* glsl */ `
        uniform sampler2D tState;
        uniform float uTexel;
        uniform float uDamping;
        varying vec2 vUv;

        void main() {
          vec2 state = texture2D(tState, vUv).rg;
          float sum =
            texture2D(tState, vUv + vec2(uTexel, 0.0)).r +
            texture2D(tState, vUv - vec2(uTexel, 0.0)).r +
            texture2D(tState, vUv + vec2(0.0, uTexel)).r +
            texture2D(tState, vUv - vec2(0.0, uTexel)).r;

          float velocity = (state.g + (sum * 0.25 - state.r) * 0.55) * uDamping;
          float height = (state.r + velocity) * 0.999;
          gl_FragColor = vec4(height, velocity, 0.0, 1.0);
        }
      `,
    })
    this.simQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.simMaterial)
    this.simScene = new THREE.Scene()
    this.simScene.add(this.simQuad)

    this.dropMaterial = new THREE.ShaderMaterial({
      uniforms: { uStrength: { value: 1 } },
      blending: THREE.AdditiveBlending,
      depthTest: false,
      vertexShader: QUAD_VERTEX,
      fragmentShader: /* glsl */ `
        uniform float uStrength;
        varying vec2 vUv;
        void main() {
          float d = min(length(vUv - 0.5) * 2.0, 1.0);
          gl_FragColor = vec4(uStrength * (0.5 + 0.5 * cos(3.14159265 * d)), 0.0, 0.0, 1.0);
        }
      `,
    })
    this.dropQuad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.dropMaterial)
    this.dropScene = new THREE.Scene()
    this.dropScene.add(this.dropQuad)

    this.clear()
  }

  get texture() {
    return this.targets[0].texture
  }

  clear() {
    const previous = this.renderer.getRenderTarget()
    for (const target of this.targets) {
      this.renderer.setRenderTarget(target)
      this.renderer.clear(true, false, false)
    }
    this.renderer.setRenderTarget(previous)
  }

  // x and y are basin coordinates in metres; radius is also in metres.
  drop(x, y, radius, strength) {
    const basin = config.basin.radius
    this.dropQuad.position.set(x / basin, y / basin, 0)
    const diameter = (2 * radius) / basin
    this.dropQuad.scale.set(diameter, diameter, 1)
    this.dropMaterial.uniforms.uStrength.value = strength

    const previous = this.renderer.getRenderTarget()
    const autoClear = this.renderer.autoClear
    this.renderer.autoClear = false
    this.renderer.setRenderTarget(this.targets[0])
    this.renderer.render(this.dropScene, this.camera)
    this.renderer.autoClear = autoClear
    this.renderer.setRenderTarget(previous)
  }

  update() {
    this.simMaterial.uniforms.tState.value = this.targets[0].texture
    const previous = this.renderer.getRenderTarget()
    this.renderer.setRenderTarget(this.targets[1])
    this.renderer.render(this.simScene, this.camera)
    this.renderer.setRenderTarget(previous)
    this.targets.reverse()
  }
}

const QUAD_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
