// Monte Carlo for the "any win" frequency of Pharaoh's Fortune and Neon Overdrive (base spins).
const ph = require('./pharaoh-calc.js');
const { linePay: neonLinePay } = require('./neon-calc.js');

function makeRng(seed) {
  let s = [seed >>> 0 || 1, 0x9e3779b9, 0x243f6a88, 0xb7e15162];
  const rotl = (x, k) => (x << k) | (x >>> (32 - k));
  const next = () => {
    const r = Math.imul(rotl(Math.imul(s[1], 5), 7), 9) >>> 0;
    const t = s[1] << 9;
    s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3]; s[2] ^= t; s[3] = rotl(s[3], 11);
    return r;
  };
  for (let i = 0; i < 20; i++) next();
  return { int: (n) => Math.floor((next() / 4294967296) * n) };
}
const picker = (rng, names, weights) => {
  const total = weights.reduce((a, b) => a + b, 0);
  return () => { let r = rng.int(total); for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return names[i]; } return names[names.length - 1]; };
};

// ---- Pharaoh
function pharaoh(N, seed) {
  const rng = makeRng(seed);
  const names = ['pharaoh', 'scarab', 'anubis', 'horus', 'sphinx', 'temple', 'coin', 'jewel'];
  const draw = picker(rng, names, [1, 2, 10, 10, 10, 10, 10, 10]);
  let lineWin = 0, scatterWin = 0, anyWin = 0, lines2plus = 0, scat2 = 0; let sumLine = 0; let maxLine = 0;
  const bigBuckets = { 'none': 0, '<1x': 0, '1-5x': 0, '5-10x': 0, '10-30x': 0, '30x+': 0 };
  for (let i = 0; i < N; i++) {
    const rows = [[], [], []];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) rows[r].push(draw());
    let mult = 0, nLines = 0;
    ph.PAYLINES.forEach((pl) => { const seq = pl.map((row, reel) => rows[row][reel]); const p = ph.linePay(seq); if (p) { mult += p; nLines++; } });
    const scat = rows.flat().filter((s) => s === 'scarab').length;
    const sc = scat >= 3;
    if (mult > 0) lineWin++;
    if (sc) scatterWin++;
    if (mult > 0 || sc) anyWin++;
    if (nLines >= 2) lines2plus++;
    if (scat === 2) scat2++;
    sumLine += mult; maxLine = Math.max(maxLine, mult);
    const tot = mult;
    bigBuckets[tot === 0 ? 'none' : tot < 1 ? '<1x' : tot < 5 ? '1-5x' : tot < 10 ? '5-10x' : tot < 30 ? '10-30x' : '30x+']++;
  }
  return { N, anyWin: anyWin / N, lineWin: lineWin / N, scatterWin: scatterWin / N, twoOrMoreLines: lines2plus / N, twoScatters: scat2 / N, avgLineMult: sumLine / N, maxLineMult: maxLine, buckets: Object.fromEntries(Object.entries(bigBuckets).map(([k, v]) => [k, v / N])) };
}

// ---- Neon (base spin only: any line win or Hold & Respin trigger)
function neon(N, seed) {
  const rng = makeRng(seed);
  const names = ['cell', 'chip', 'crystal', 'visor', 'drone', 'reactor', 'orb'];
  const draw = picker(rng, names, [60, 45, 35, 30, 15, 1, 14]);
  const PAYLINES = [[1,1,1,1,1],[2,2,2,2,2],[0,0,0,0,0],[3,3,3,3,3],[0,1,2,1,0],[3,2,1,2,3],[1,0,0,0,1],[2,3,3,3,2],[0,0,1,2,3],[3,3,2,1,0],[1,2,3,2,1],[2,1,0,1,2]];
  let lineWin = 0, trig = 0, any = 0, sumMult = 0, maxMult = 0, orbs3to5 = 0, multi = 0;
  const buckets = { none: 0, '<1x': 0, '1-5x': 0, '5-20x': 0, '20x+': 0 };
  for (let i = 0; i < N; i++) {
    const grid = []; let orbs = 0;
    for (let reel = 0; reel < 5; reel++) { const col = []; for (let row = 0; row < 4; row++) { const s = draw(); col.push(s); if (s === 'orb') orbs++; } grid.push(col); }
    let mult = 0, nl = 0;
    PAYLINES.forEach((pl) => { const seq = pl.map((row, reel) => grid[reel][row]); const p = neonLinePay(seq); if (p) { mult += p; nl++; } });
    if (mult > 0) lineWin++;
    if (orbs >= 6) trig++;
    if (orbs >= 3 && orbs <= 5) orbs3to5++;
    if (mult > 0 || orbs >= 6) any++;
    if (nl >= 2) multi++;
    sumMult += mult; maxMult = Math.max(maxMult, mult);
    buckets[mult === 0 ? 'none' : mult < 1 ? '<1x' : mult < 5 ? '1-5x' : mult < 20 ? '5-20x' : '20x+']++;
  }
  return { N, anyWin: any / N, lineWin: lineWin / N, trigger: trig / N, twoOrMoreLines: multi / N, avgLineMult: sumMult / N, maxLineMult: maxMult, buckets: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v / N])) };
}

if (require.main === module) {
  console.log(JSON.stringify({ pharaoh: pharaoh(10_000_000, 7), neon: neon(5_000_000, 11) }, null, 1));
}
module.exports = { pharaoh, neon };
