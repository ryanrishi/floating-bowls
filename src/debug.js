import * as THREE from 'three'
import { config } from './config.js'

// Enabled with ?debug. Draws the physics circles over the render, which is the quickest
// way to see whether what you hear and what you see actually agree.
export function createDebugOverlay(camera, world) {
  const canvas = document.getElementById('debug')
  if (!new URLSearchParams(location.search).has('debug')) {
    return { draw() {} }
  }

  canvas.hidden = false
  const ctx = canvas.getContext('2d')
  const point = new THREE.Vector3()

  function project(x, y, z) {
    point.set(x, y, z).project(camera)
    return {
      x: ((point.x + 1) / 2) * canvas.width,
      y: ((1 - point.y) / 2) * canvas.height,
    }
  }

  return {
    draw() {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
      ctx.strokeStyle = 'rgba(255, 96, 96, 0.9)'
      ctx.lineWidth = 1

      for (const bowl of world.bowls) {
        const center = project(bowl.x, 0, bowl.y)
        const edge = project(bowl.x + bowl.r, 0, bowl.y)
        ctx.beginPath()
        ctx.arc(center.x, center.y, Math.hypot(edge.x - center.x, edge.y - center.y), 0, Math.PI * 2)
        ctx.stroke()
      }

      ctx.strokeStyle = 'rgba(96, 200, 255, 0.9)'
      ctx.beginPath()
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * Math.PI * 2
        const p = project(Math.cos(a) * config.basin.radius, 0, Math.sin(a) * config.basin.radius)
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)
      }
      ctx.stroke()
    },
  }
}
