# Floating Bowls

Porcelain bowls drift on a slow current in a round basin. They strike each other at
random and ring. Nothing is composed: the music is a by-product of the physics.

After [*Clinamen*](https://www.armoryonpark.org/season-events/2026-season/clinamen/) by
Céleste Boursier-Mougenot.

```
npm install
npm run dev
```

Add `?debug` to the URL to draw the physics circles over the render.

## How it works

A 2D simulation of circles drifting on a flow field is the only source of truth. Each
step it returns the collisions that happened, and each collision feeds three consumers:

| Consumer | What it does |
|---|---|
| `src/audio/` | Modal synthesis — sine partials at bell ratios, pitch from bowl radius |
| `src/scene/ripples.js` | Drops a bump into a GPU height field that the water shader reads |
| `src/scene/bowlMesh.js` | Rocks both bowls on a damped spring |

Physics and sound run off a worker timer (`src/clock.worker.js`) rather than
`requestAnimationFrame`, so the basin keeps playing while the tab is hidden. Drawing
stays on `requestAnimationFrame`, which correctly stops when nobody is watching.

There are no binary assets. The reverb impulse response, the environment map and the
water normals are all generated at runtime.

Every tunable number lives in `src/config.js`. The one to know about is
`current.eddies.speed`: set it to 0 and the bowls settle into a fixed arrangement and
hold it. See the comment at the top of `src/physics/current.js` for why.
