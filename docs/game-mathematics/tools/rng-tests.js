// Statistical checks of the real random stream (SeededRng, HMAC-SHA256 counter mode) as the games use it.
//   node rng-tests.js
//
// Every test uses one fresh seed per "round" (as the runtime does) and the real SeededRng methods the engines call.
// A p-value below about 0.001 would be suspicious; with ~12 independent tests a few values between 0.01 and 0.1 are normal.
const crypto = require('node:crypto');
const { SeededRng, rngFor, chiSquarePValue, load, writeResult } = require('./common');
const { seedCommitment, createRoundSeed } = load('shared/rng');

const results = {};
const addTest = (name, data) => {
  results[name] = data;
  console.log(name.padEnd(46), JSON.stringify(data, (k, v) => (typeof v === 'number' ? Number(v.toPrecision(5)) : v)).slice(0, 220));
};
const chiSquare = (observed, expected) => observed.reduce((s, o, i) => s + (o - expected[i]) ** 2 / expected[i], 0);

// 1. int(37): the roulette wheel
{
  const rounds = 1_000_000, perRound = 10, counts = new Array(37).fill(0);
  for (let i = 0; i < rounds; i++) { const rng = rngFor('rng:int37', i); for (let k = 0; k < perRound; k++) counts[rng.int(37)]++; }
  const e = (rounds * perRound) / 37;
  const chi = chiSquare(counts, counts.map(() => e));
  addTest('int(37) uniform, 10M draws', { chiSquare: chi, df: 36, pValue: chiSquarePValue(chi, 36), min: Math.min(...counts), max: Math.max(...counts), expected: e });
}

// 2. first draw of a round (the only draw of a roulette spin)
{
  const rounds = 4_000_000, counts = new Array(37).fill(0);
  for (let i = 0; i < rounds; i++) counts[rngFor('rng:first', i).int(37)]++;
  const e = rounds / 37;
  const chi = chiSquare(counts, counts.map(() => e));
  addTest('first draw of 4M different seeds, int(37)', { chiSquare: chi, df: 36, pValue: chiSquarePValue(chi, 36) });
}

// 3. weighted(): Neon Overdrive cells -> number of Overdrive Cores in a 20-cell grid ~ Binomial(20, 0.07)
{
  const { SYMBOL_WEIGHTS, SYMBOL_ORDER } = load('neon-overdrive/neon-overdrive.config');
  const orbIndex = SYMBOL_ORDER.indexOf('orb');
  const grids = 2_000_000, cells = 20, p = SYMBOL_WEIGHTS[orbIndex] / SYMBOL_WEIGHTS.reduce((a, b) => a + b, 0);
  const binom = (n, k) => { let c = 1; for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i; return c * p ** k * (1 - p) ** (n - k); };
  const counts = new Array(cells + 1).fill(0);
  for (let g = 0; g < grids; g++) {
    const rng = rngFor('rng:neon-orbs', g);
    let orbs = 0;
    for (let c = 0; c < cells; c++) if (rng.weighted(SYMBOL_WEIGHTS) === orbIndex) orbs++;
    counts[orbs]++;
  }
  const bins = 8; // 0..6 and 7+
  const obs = [], exp = [];
  for (let k = 0; k < bins - 1; k++) { obs.push(counts[k]); exp.push(grids * binom(cells, k)); }
  obs.push(counts.slice(bins - 1).reduce((a, b) => a + b, 0));
  exp.push(grids - exp.reduce((a, b) => a + b, 0));
  const chi = chiSquare(obs, exp);
  const trig = counts.slice(6).reduce((a, b) => a + b, 0);
  let pTrig = 0; for (let k = 6; k <= cells; k++) pTrig += binom(cells, k);
  const z = (trig - grids * pTrig) / Math.sqrt(grids * pTrig * (1 - pTrig));
  addTest('Neon: orbs per 20-cell grid ~ Binomial(20,.07)', { grids, chiSquare: chi, df: bins - 1, pValue: chiSquarePValue(chi, bins - 1), triggerCount: trig, expectedTriggers: grids * pTrig, zScore: z });
}

// 4. float(): mean, variance, KS, serial correlation
{
  const n = 4_000_000, values = new Float64Array(n);
  let sum = 0, sumSq = 0, lag = 0, prev = 0;
  let rng = null;
  for (let i = 0; i < n; i++) {
    if (i % 4 === 0) rng = rngFor('rng:float', i / 4); // one seed per group of 4 consecutive draws (the stream must be created ONCE per group)
    const v = rng.float();
    values[i] = v; sum += v; sumSq += v * v;
    if (i > 0) lag += (v - 0.5) * (prev - 0.5);
    prev = v;
  }
  const mean = sum / n, variance = sumSq / n - mean * mean;
  values.sort();
  let d = 0;
  for (let i = 0; i < n; i++) d = Math.max(d, Math.abs((i + 1) / n - values[i]), Math.abs(i / n - values[i]));
  const bins = new Array(100).fill(0);
  for (const v of values) bins[Math.min(99, Math.floor(v * 100))]++;
  const chi = chiSquare(bins, bins.map(() => n / 100));
  addTest('float(): 4M draws', { mean, expectedMean: 0.5, variance, expectedVariance: 1 / 12, ksStatistic: d, ksCritical1pct: 1.63 / Math.sqrt(n), chiSquare100bins: chi, pValue: chiSquarePValue(chi, 99), lag1Correlation: lag / n / (1 / 12), minValue: values[0], maxValue: values[n - 1] });
}

// 5. shuffle(): the 52-card deck of Tiger Clash
{
  const rounds = 600_000, deck = Array.from({ length: 52 }, (_, i) => i);
  const posOfCard0 = new Array(52).fill(0), lastTwoSameRank = { n: 0 }, topCard = new Array(52).fill(0);
  for (let i = 0; i < rounds; i++) {
    const shuffled = rngFor('rng:shuffle', i).shuffle(deck);
    posOfCard0[shuffled.indexOf(0)]++;
    topCard[shuffled[51]]++;
    if (shuffled[51] % 13 === shuffled[50] % 13) lastTwoSameRank.n++; // card id mod 13 = rank
  }
  const e = rounds / 52;
  const chiPos = chiSquare(posOfCard0, posOfCard0.map(() => e));
  const chiTop = chiSquare(topCard, topCard.map(() => e));
  const pTie = 3 / 51, z = (lastTwoSameRank.n - rounds * pTie) / Math.sqrt(rounds * pTie * (1 - pTie));
  addTest('shuffle: where card 0 lands (52 positions)', { chiSquare: chiPos, df: 51, pValue: chiSquarePValue(chiPos, 51) });
  addTest('shuffle: which card is on top (52 cards)', { chiSquare: chiTop, df: 51, pValue: chiSquarePValue(chiTop, 51) });
  addTest('shuffle: top two cards share a rank (= tie)', { observed: lastTwoSameRank.n, expected: rounds * pTie, zScore: z, observedRate: lastTwoSameRank.n / rounds, theoretical: pTie });
}

// 6. chance(): exact parts per million (Atlantis Cascade wild 1.5%, scatter 2%)
{
  const n = 4_000_000; let wild = 0, scatter = 0;
  for (let i = 0; i < n; i++) { const rng = rngFor('rng:chance', i); if (rng.chance(15000, 1000000)) wild++; if (rng.chance(20000, 1000000)) scatter++; }
  const z = (x, p) => (x - n * p) / Math.sqrt(n * p * (1 - p));
  addTest('chance(15000/1e6) and chance(20000/1e6)', { wildRate: wild / n, wildZ: z(wild, 0.015), scatterRate: scatter / n, scatterZ: z(scatter, 0.02) });
}

// 7. large range without modulo bias
{
  const n = 2_000_000, limit = 3_000_000_000; let low = 0;
  for (let i = 0; i < n; i++) if (rngFor('rng:big', i).int(limit) < limit / 2) low++;
  addTest('int(3e9): share below the middle', { rate: low / n, expected: 0.5, zScore: (low - n / 2) / Math.sqrt(n / 4) });
}

// 8. properties the audit relies on
{
  const seed = createRoundSeed();
  const a = new SeededRng(seed), b = new SeededRng(seed);
  const same = Array.from({ length: 1000 }, () => a.int(1000) === b.int(1000)).every(Boolean);
  const other = new SeededRng(createRoundSeed());
  const differs = Array.from({ length: 50 }, () => new SeededRng(seed).int(2 ** 31) !== other.int(2 ** 31)).some(Boolean);
  const commitmentOk = seedCommitment(seed) === crypto.createHash('sha256').update(Buffer.from(seed, 'hex')).digest('hex');
  const seeds = new Set(Array.from({ length: 100000 }, () => createRoundSeed()));
  addTest('determinism / commitment / seed uniqueness', { sameSeedSameStream: same, differentSeedDifferentStream: differs, commitmentIsSha256OfSeedBytes: commitmentOk, seedLengthBits: seed.length * 4, uniqueSeedsIn100000: seeds.size });
}

writeResult('rng-tests', results);
