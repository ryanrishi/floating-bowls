import { config } from '../config.js'

export function createControls({ onStart, onCount, onCurrent, onSpread, onReverb, onVolume }) {
  const overlay = document.getElementById('start')
  const panel = document.getElementById('panel')
  const body = document.getElementById('panel-body')
  const toggle = document.getElementById('panel-toggle')

  document.getElementById('start-button').addEventListener('click', async () => {
    await onStart()
    overlay.classList.add('leaving')
    overlay.addEventListener('transitionend', () => overlay.remove(), { once: true })
    panel.hidden = false
  })

  toggle.addEventListener('click', () => {
    body.hidden = !body.hidden
    toggle.textContent = body.hidden ? '+' : '−'
    toggle.setAttribute('aria-expanded', String(!body.hidden))
  })

  bind('count', config.bowls.count, onCount, (v) => v)
  bind('current', config.current.strength, onCurrent, (v) => v.toFixed(2))
  bind('spread', config.bowls.spread, onSpread, (v) => v.toFixed(2))
  bind('reverb', config.audio.reverbWet, onReverb, (v) => v.toFixed(2))
  bind('volume', config.audio.masterGain, onVolume, (v) => v.toFixed(2))
}

function bind(id, initial, handler, format) {
  const input = document.getElementById(id)
  const readout = document.querySelector(`output[data-for="${id}"]`)
  input.value = initial

  const apply = () => {
    const value = Number(input.value)
    readout.textContent = format(value)
    handler(value)
  }

  input.addEventListener('input', apply)
  readout.textContent = format(Number(input.value))
}
