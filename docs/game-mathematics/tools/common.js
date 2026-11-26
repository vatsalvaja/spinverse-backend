// Shared helpers for the game-mathematics tools.
//
// IMPORTANT: these tools run the REAL compiled game engines (not a re-statement of their rules), so build first:
//   npm run build        (writes dist/; nothing in src/ is touched)
// Every script writes its results as JSON into ./results/.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const ENGINES = path.resolve(__dirname, '../../../dist/modules/game-engine/engines');

const load = (relative) => require(path.join(ENGINES, relative));
const { SeededRng } = load('shared/rng');
const { createGameEngines } = load('game-engine-list');

const engines = Object.fromEntries(createGameEngines().map((engine) => [engine.gameId, engine]));

/** Deterministic seed per round, so every simulation is exactly repeatable. */
const seedFor = (label, index) => crypto.createHash('sha256').update(`${label}:${index}`).digest('hex');
const rngFor = (label, index) => new SeededRng(seedFor(label, index));

/** Running mean / variance / min / max (Welford). */
class Accumulator {
  constructor() {
    this.n = 0;
    this.mean = 0;
    this.m2 = 0;
    this.min = Infinity;
    this.max = -Infinity;
  }
  add(x) {
    this.n++;
    const delta = x - this.mean;
    this.mean += delta / this.n;
    this.m2 += delta * (x - this.mean);
    if (x < this.min) this.min = x;
    if (x > this.max) this.max = x;
  }
  get variance() {
    return this.n > 1 ? this.m2 / (this.n - 1) : 0;
  }
  get sd() {
    return Math.sqrt(this.variance);
  }
  /** Standard error of the mean. */
  get se() {
    return this.n > 0 ? Math.sqrt(this.variance / this.n) : 0;
  }
}

/** Counts how many values reach each threshold (>=). */
class Thresholds {
  constructor(limits) {
    this.limits = limits;
    this.counts = limits.map(() => 0);
    this.total = 0;
  }
  add(x) {
    this.total++;
    this.limits.forEach((limit, i) => {
      if (x >= limit) this.counts[i]++;
    });
  }
  toJSON() {
    return Object.fromEntries(this.limits.map((limit, i) => [`>=${limit}`, this.counts[i] / this.total]));
  }
}

function writeResult(name, data) {
  const dir = path.join(__dirname, 'results');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.json`), JSON.stringify(data, null, 2) + '\n');
}

function progress(label, i, n) {
  if (i > 0 && i % 100000 === 0) process.stderr.write(`${label}: ${i}/${n}\n`);
}

/** Regularised upper incomplete gamma Q(a, x) (Numerical Recipes), for chi-square p-values. */
function gammaQ(a, x) {
  if (x <= 0) return 1;
  const gln = lgamma(a);
  if (x < a + 1) {
    let sum = 1 / a;
    let del = sum;
    let ap = a;
    for (let n = 0; n < 1000; n++) {
      ap++;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-14) break;
    }
    return 1 - sum * Math.exp(-x + a * Math.log(x) - gln);
  }
  let b = x + 1 - a;
  let c = 1 / 1e-300;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return Math.exp(-x + a * Math.log(x) - gln) * h;
}

function lgamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const coefficient of c) ser += coefficient / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/** P-value of a chi-square statistic with `df` degrees of freedom. */
const chiSquarePValue = (statistic, df) => gammaQ(df / 2, statistic / 2);

module.exports = { engines, load, SeededRng, seedFor, rngFor, Accumulator, Thresholds, writeResult, progress, chiSquarePValue };
