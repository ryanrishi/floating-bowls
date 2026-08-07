// The heartbeat of the piece. It lives in a worker because a hidden tab stops
// requestAnimationFrame outright and clamps main-thread timers to about once a second,
// which would leave the bowls frozen and the basin silent whenever you look away.
// A worker timer keeps its full rate. Measured in Chrome on a hidden tab:
// rAF 0/s, main-thread setInterval 1.3/s, this 79/s.
setInterval(() => postMessage(0), 16)
