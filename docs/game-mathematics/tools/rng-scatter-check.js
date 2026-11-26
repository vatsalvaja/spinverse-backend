// Direct check of the draw behind the Pharaoh's Fortune free-spin trigger: 15 independent weighted cells per grid.
//   node rng-scatter-check.js <grids> <salt>
// (The same weights, the same SeededRng.weighted call, but no game logic at all.)
const { rngFor, load, writeResult } = require('./common');
const { SYMBOL_WEIGHTS } = load('pharaohs-fortune/pharaohs-fortune.config');
const grids = Number(process.argv[2]), salt = process.argv[3] ?? 'a';
const total = SYMBOL_WEIGHTS.reduce((a, b) => a + b, 0), p = SYMBOL_WEIGHTS[1] / total;
const counts = new Array(16).fill(0);
for (let g = 0; g < grids; g++) {
  const rng = rngFor(`rng-scatter:${salt}`, g);
  let n = 0;
  for (let c = 0; c < 15; c++) if (rng.weighted(SYMBOL_WEIGHTS) === 1) n++;
  counts[n]++;
}
const binom = (k) => { let c = 1; for (let i = 1; i <= k; i++) c = (c * (15 - k + i)) / i; return c * p ** k * (1 - p) ** (15 - k); };
const exp = counts.map((_, k) => grids * binom(k));
const trig = counts.slice(3).reduce((a, b) => a + b, 0), expTrig = exp.slice(3).reduce((a, b) => a + b, 0);
const out = { grids, salt, weightsTotal: total, pScatterPerCell: p, triggerCount: trig, expectedTriggers: expTrig, z: (trig - expTrig) / Math.sqrt(expTrig * (1 - expTrig / grids)), counts: counts.slice(0, 7), expected: exp.slice(0, 7).map((x) => Math.round(x)) };
writeResult(`rng-scatter-check-${salt}`, out);
console.log(JSON.stringify(out));
