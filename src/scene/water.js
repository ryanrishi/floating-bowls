import * as THREE from 'three'
import { Reflector } from 'three/addons/objects/Reflector.js'
import { config } from '../config.js'
import { WATER_ORDER } from './order.js'

// Reflector gives a true mirrored render of the scene. Its stock material is replaced
// here so the reflection can be distorted by the ripple height field instead of by a
// scrolling normal map -- a scrolling map would smear the waves and break the link
// between a collision and the ring it spreads.
export function createWater(rippleTexture) {
  const water = new Reflector(new THREE.CircleGeometry(config.basin.radius, 160), {
    textureWidth: 1024,
    textureHeight: 1024,
    clipBias: 0.003,
  })
  // Reflector takes its mirror plane from the object's local +Z, so the disc has to be
  // laid flat by rotating the object. Baking the rotation into the geometry instead
  // leaves the object unrotated and reflects the scene across a vertical plane.
  water.rotation.x = -Math.PI / 2
  water.position.y = 0.001
  water.renderOrder = WATER_ORDER

  const stock = water.material
  const surface = new THREE.ShaderMaterial({
    // See order.js: the water leaves the depth buffer alone so the bowl caps can keep
    // it out of the bowls.
    depthWrite: false,
    uniforms: {
      tDiffuse: { value: stock.uniforms.tDiffuse.value },
      textureMatrix: { value: stock.uniforms.textureMatrix.value },
      tRipples: { value: rippleTexture },
      uWaterColor: { value: new THREE.Color(config.basin.waterColor) },
      uSun: { value: new THREE.Vector3(...config.render.sunDirection).normalize() },
      uDistortion: { value: config.render.distortion },
      uNormalScale: { value: config.ripples.normalScale },
      uTexel: { value: 1 / config.ripples.size },
      uBasinRadius: { value: config.basin.radius },
    },
    vertexShader: /* glsl */ `
      uniform mat4 textureMatrix;
      uniform float uBasinRadius;
      varying vec4 vReflectCoord;
      varying vec2 vBasinUv;
      varying vec3 vWorld;

      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vBasinUv = world.xz / (2.0 * uBasinRadius) + 0.5;
        vReflectCoord = textureMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform sampler2D tRipples;
      uniform vec3 uWaterColor;
      uniform vec3 uSun;
      uniform float uDistortion;
      uniform float uNormalScale;
      uniform float uTexel;
      varying vec4 vReflectCoord;
      varying vec2 vBasinUv;
      varying vec3 vWorld;

      vec3 surfaceNormal() {
        float left  = texture2D(tRipples, vBasinUv - vec2(uTexel, 0.0)).r;
        float right = texture2D(tRipples, vBasinUv + vec2(uTexel, 0.0)).r;
        float down  = texture2D(tRipples, vBasinUv - vec2(0.0, uTexel)).r;
        float up    = texture2D(tRipples, vBasinUv + vec2(0.0, uTexel)).r;
        return normalize(vec3((left - right) * uNormalScale, 1.0, (down - up) * uNormalScale));
      }

      void main() {
        vec3 normal = surfaceNormal();
        vec4 coord = vReflectCoord;
        coord.xy += normal.xz * uDistortion * coord.w;
        vec3 reflection = texture2DProj(tDiffuse, coord).rgb;

        vec3 viewDir = normalize(cameraPosition - vWorld);
        float fresnel = mix(0.05, 1.0, pow(1.0 - max(dot(viewDir, normal), 0.0), 4.0));

        vec3 halfway = normalize(uSun + viewDir);
        float glint = pow(max(dot(normal, halfway), 0.0), 320.0) * 2.5;

        vec3 color = mix(uWaterColor, reflection, clamp(fresnel * 1.2, 0.0, 1.0)) + glint;
        gl_FragColor = vec4(color, 1.0);

        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })

  water.material = surface
  stock.dispose()

  return water
}
