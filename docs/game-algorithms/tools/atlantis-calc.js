// Independent Monte Carlo for Atlantis Cascade. Mirrors the frontend engine.ts cluster finder / pays / multipliers.
// Random source here is a fast seeded PRNG (xoshiro128**) - only for estimating statistics, not for play.
const COLS = 6, ROWS = 5, MIN_CLUSTER = 5;
const PAYING = ['pearl', 'trident', 'crown', 'eye', 'amphora', 'conch', 'crystal', 'scale'];
const PAY = {
  pearl: [1.5, 4, 12, 40, 120], trident: [1.2, 3, 9, 30, 90], crown: [1, 2.5, 7, 22, 70], eye: [0.8, 2, 5, 16, 50],
  amphora: [0.5, 1.2, 3, 10, 30], conch: [0.4, 1, 2.5, 8, 24], crystal: [0.3, 0.8, 2, 6, 18], scale: [0.2, 0.5, 1.5, 4, 12],
};
const WEIGHTS = [['scale', 16], ['crystal', 15], ['conch', 14], ['amphora', 13], ['eye', 10], ['crown', 8], ['trident', 7], ['pearl', 6]];
const WSUM = WEIGHTS.reduce((s, [, w]) => s + w, 0);
const bucketOf = (n) => (n >= 15 ? 4 : n >= 12 ? 3 : n >= 9 ? 2 : n >= 7 ? 1 : 0);
const FREE_MULT_CAP = 25;
const FREE_SPINS_FOR = (s) => (s >= 6 ? 15 : s === 5 ? 12 : 8);
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

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
  return { float: () => next() / 4294967296 };
}

function pick(rng, cfg, near) {
  if (rng.float() < cfg.wild) return 'wild';
  if (cfg.clump > 0 && near) {
    const ok = near.filter((x) => x && x !== 'wild' && x !== 'scatter');
    if (ok.length && rng.float() < cfg.clump) return ok[Math.floor(rng.float() * ok.length)];
  }
  let r = rng.float() * WSUM;
  for (const [s, w] of WEIGHTS) { r -= w; if (r <= 0) return s; }
  return 'scale';
}

function findClusters(grid) {
  const out = [];
  const claimed = new Set();
  for (const sym of PAYING) {
    const seen = new Set();
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) {
      const k0 = c + ':' + r;
      if (grid[c][r] !== sym || seen.has(k0)) continue;
      const cells = [], stack = [[c, r]], wilds = [];
      seen.add(k0);
      while (stack.length) {
        const [x, y] = stack.pop();
        cells.push([x, y]);
        for (const [dx, dy] of DIRS) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
          const k = nx + ':' + ny;
          if (seen.has(k)) continue;
          const s = grid[nx][ny];
          if (s === sym || (s === 'wild' && !claimed.has(k))) { seen.add(k); if (s === 'wild') wilds.push(k); stack.push([nx, ny]); }
        }
      }
      if (cells.length >= MIN_CLUSTER) { wilds.forEach((k) => claimed.add(k)); out.push({ sym, cells, size: cells.length, pay: PAY[sym][bucketOf(cells.length)] }); }
      else wilds.forEach((k) => seen.delete(k));
    }
  }
  return out;
}

// one spin: returns { x (win in bet multiples), scatters, steps, winningSteps }
function spin(rng, cfg, freeMult /* 0 = base game */, scatterChance) {
  let grid = [];
  let scatters = 0;
  for (let c = 0; c < COLS; c++) {
    const col = [];
    for (let r = 0; r < ROWS; r++) {
      if (scatterChance > 0 && rng.float() < scatterChance) { col.push('scatter'); scatters++; } else col.push(pick(rng, cfg, [c > 0 ? grid[c - 1][r] : undefined, r > 0 ? col[r - 1] : undefined]));
    }
    grid.push(col);
  }
  let total = 0, steps = 0, m = freeMult;
  for (let i = 0; i < cfg.maxCascades; i++) {
    const clusters = findClusters(grid);
    if (!clusters.length) break;
    const mult = freeMult ? Math.min(FREE_MULT_CAP, m) : Math.min(10, i + 1);
    total += clusters.reduce((a, c) => a + c.pay, 0) * mult;
    steps++; m++;
    const gone = new Set(clusters.flatMap((cl) => cl.cells.map(([c, r]) => c + ':' + r)));
    const next = [];
    for (let c = 0; c < COLS; c++) {
      const surv = grid[c].filter((_, r) => !gone.has(c + ':' + r));
      const k = ROWS - surv.length;
      const fill = [];
      for (let j = 0; j < k; j++) fill.push(pick(rng, cfg, [c > 0 ? next[c - 1][j] : undefined, j > 0 ? fill[j - 1] : undefined]));
      next.push(fill.concat(surv));
    }
    grid = next;
  }
  return { x: total, scatters, steps, mEnd: m };
}

function freeFeature(rng, cfg, nSpins) {
  let mult = 1, total = 0;
  for (let i = 0; i < nSpins; i++) {
    const r = spin(rng, cfg, mult, 0);
    total += r.x;
    mult = Math.min(FREE_MULT_CAP, r.mEnd); // multiplier carries over; grows by one per winning step (capped when used)
    if (r.mEnd > FREE_MULT_CAP) mult = r.mEnd; // keep counting; cap applied when used
  }
  return total;
}

function run(cfg, N, seed) {
  const rng = makeRng(seed);
  let sum = 0, sumSq = 0, wins = 0, bonusTriggers = 0, bonusSum = 0, baseSum = 0, maxX = 0, maxSteps = 0;
  const tiers = { none: 0, normal: 0, big: 0, super: 0, mega: 0, jackpot: 0 };
  const scatterCounts = {};
  for (let i = 0; i < N; i++) {
    const r = spin(rng, cfg, 0, cfg.scatter);
    let x = r.x;
    baseSum += r.x;
    maxSteps = Math.max(maxSteps, r.steps);
    scatterCounts[r.scatters] = (scatterCounts[r.scatters] || 0) + 1;
    const t = r.x >= 100 ? 'jackpot' : r.x >= 50 ? 'mega' : r.x >= 25 ? 'super' : r.x >= 10 ? 'big' : r.x > 0 ? 'normal' : 'none';
    tiers[t]++;
    let spinWin = r.x > 0;
    if (r.scatters >= 4) {
      bonusTriggers++;
      const f = freeFeature(rng, cfg, FREE_SPINS_FOR(r.scatters));
      bonusSum += f; x += f;
    }
    if (spinWin) wins++;
    sum += x; sumSq += x * x; maxX = Math.max(maxX, x);
  }
  const mean = sum / N, varr = sumSq / N - mean * mean, se = Math.sqrt(varr / N);
  return { N, rtp: mean, se, ci95: [mean - 1.96 * se, mean + 1.96 * se], hitFreq: wins / N, baseRtp: baseSum / N, bonusRate: bonusTriggers / N, bonusAvg: bonusTriggers ? bonusSum / bonusTriggers : 0, maxX, maxSteps, tiers: Object.fromEntries(Object.entries(tiers).map(([k, v]) => [k, v / N])), scatterCounts };
}

module.exports = { run, spin, freeFeature, makeRng, findClusters };

if (require.main === module) {
  const N = Number(process.argv[2] || 200000);
  const seed = Number(process.argv[3] || 20261127);
  const cfg = { wild: 0.015, scatter: 0.02, clump: 0.2, maxCascades: 100 };
  const r = run(cfg, N, seed);
  console.log(JSON.stringify({ cfg, seed, ...r }, null, 1));
}
