// All units are metres and seconds. The basin is sized like the Park Avenue Armory
// installation: a circle roughly 12 m across holding bowls roughly 30 cm across.

export const config = {
  basin: {
    radius: 6,
    depth: 0.35,
    waterColor: 0x1b6fa8,
    floorColor: 0x0d4f7d,
  },

  bowls: {
    // Encounters come from crowding, not from a violent current. A denser basin lets the
    // flow stay slow and even while the bowls still meet often enough to keep ringing.
    count: 280,
    maxCount: 320,
    baseRadius: 0.15,
    spread: 0.35, // radius varies by +/- this fraction of baseRadius
    height: 0.15,
    restitution: 0.45,
    // Fraction of the bowl wall that sits below the waterline.
    draft: 0.55,
  },

  current: {
    strength: 1,
    swirl: 0.022, // rad/s of the basin-wide rotation
    drag: 1.4, // how fast a bowl is pulled toward the local flow velocity
    eddies: {
      strength: 0.18, // m/s of eddy motion on top of the basin rotation
      count: 6,
      longest: 11, // metres, about the width of the basin
      shortest: 3.5,
      // How fast the eddies travel. This is the knob that stops the bowls settling into
      // a fixed arrangement: at 0 the layout still looks the same a minute later, at
      // 0.06 it has completely reorganised.
      speed: 0.06,
    },
  },

  physics: {
    fixedStep: 1 / 120,
    maxStepsPerFrame: 6,
    wallDamping: 0.55,
  },

  audio: {
    masterGain: 0.55,
    reverbWet: 0.42,
    reverbSeconds: 3.5,
    // f0 = pitchK / radius, so small bowls ring high.
    pitchK: 150,
    partials: [1, 2.32, 4.25, 6.63, 9.38, 12.22],
    partialFalloff: 0.62,
    baseDecay: 2,
    // Measured from the simulation: audible strikes run from 0.013 to about 0.08,
    // so these two bracket the real dynamic range rather than a guessed one.
    minImpulse: 0.012,
    maxImpulse: 0.07,
    bowlCooldown: 0.07,
    maxVoices: 32,
  },

  ripples: {
    size: 512,
    damping: 0.994,
    // A ripple crosses the basin in about five seconds and has faded by then.
    dropStrength: 0.9,
    clickStrength: 1.2,
    normalScale: 6,
  },

  render: {
    cameraPitch: 34, // degrees above the water
    cameraDistance: 15.5,
    sunDirection: [0.45, 0.72, 0.53],
    distortion: 0.055,
  },
}
