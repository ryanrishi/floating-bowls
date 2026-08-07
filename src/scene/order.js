// Draw order matters here, so it lives in one place rather than being scattered.
//
//   0  basin, rim, sky, bowls   write depth as usual
//   1  bowl caps                depth only, sealing each bowl's mouth
//   2  water                    depth-tested but writes no depth
//
// The water is last and writes no depth so that it covers the submerged part of each
// bowl wall, while the caps stop it from reaching inside the bowls.
export const CAP_ORDER = 1
export const WATER_ORDER = 2
