// EXACT mathematics of Pharaoh's Fortune, derived from the real configuration and checked against the real
// line evaluator (`evaluateLines`) exported by the compiled engine.
//
//   node exact-pharaoh.js
//
// Method: every cell of the 5x3 grid is an independent weighted draw, so the grid is built reel by reel. A
// small state machine per payline (identical to the rules in evaluateLines) is carried through the five reels
// together with the number of Golden Scarabs seen; the probability of every joint state is propagated exactly.
// The free-spin feature (no re-trigger, no scatters, fixed bet) is a sum of independent free spins, so its
// exact distribution is a convolution.
const { load, rngFor, writeResult } = require('./common');

const cfg = load('pharaohs-fortune/pharaohs-fortune.config');
const { evaluateLines } = load('pharaohs-fortune/pharaohs-fortune.engine');
const { PAYLINES, PAYTABLE, JACKPOT_MULTIPLIER, SYMBOL_ORDER, SYMBOL_WEIGHTS, FREE_SPIN_SYMBOL_WEIGHTS, SCATTER_REWARDS, REELS, ROWS } = cfg;

// ---------- per-line state machine (mirrors evaluateLines) ----------
const stateIds = new Map();
const stateInfo = [];
const idOf = (key, info) => {
  if (!stateIds.has(key)) {
    stateIds.set(key, stateInfo.length);
    stateInfo.push({ key, ...info });
  }
  return stateIds.get(key);
};
const START = idOf('START', { kind: 'start' });
const done = (payout) => idOf(`D${payout}`, { kind: 'done', payout });
const allPharaoh = (count) => idOf(`A${count}`, { kind: 'A', count });
const based = (symbol, count) => idOf(`B:${symbol}:${count}`, { kind: 'B', symbol, count });

function next(stateId, symbol) {
  const state = stateInfo[stateId];
  if (state.kind === 'start') {
    if (symbol === 'scarab') return done(0);
    if (symbol === 'pharaoh') return allPharaoh(1);
    return based(symbol, 1);
  }
  if (state.kind === 'A') {
    if (symbol === 'pharaoh') return state.count + 1 === REELS ? done(JACKPOT_MULTIPLIER) : allPharaoh(state.count + 1);
    if (symbol === 'scarab') return done(0);
    return state.count + 1 === REELS ? done(PAYTABLE[symbol][2]) : based(symbol, state.count + 1);
  }
  if (state.kind === 'B') {
    const table = PAYTABLE[state.symbol];
    if (symbol === state.symbol || symbol === 'pharaoh') {
      return state.count + 1 === REELS ? done(table[2]) : based(state.symbol, state.count + 1);
    }
    return done(state.count >= 3 ? table[state.count - 3] : 0);
  }
  return stateId; // done
}

// ---------- check the state machine against the REAL evaluateLines ----------
function validate(samples) {
  let mismatches = 0;
  for (let i = 0; i < samples; i++) {
    const rng = rngFor('pharaoh-validate', i);
    const rows = [];
    for (let r = 0; r < ROWS; r++) {
      const cells = [];
      for (let c = 0; c < REELS; c++) cells.push(SYMBOL_ORDER[rng.weighted(SYMBOL_WEIGHTS)]);
      rows.push(cells);
    }
    const real = evaluateLines(rows).reduce((sum, win) => sum + win.multiplier, 0);
    let mine = 0;
    PAYLINES.forEach((payline) => {
      let state = START;
      for (let reel = 0; reel < REELS; reel++) state = next(state, rows[payline[reel]][reel]);
      mine += stateInfo[state].payout;
    });
    if (real !== mine) mismatches++;
  }
  return mismatches;
}
const validationSamples = 300000;
const mismatches = validate(validationSamples);
if (mismatches !== 0) throw new Error(`state machine disagrees with evaluateLines on ${mismatches} grids`);

// EXHAUSTIVE check of one payline: every one of the 8^5 symbol sequences on the middle line, scored by the REAL
// evaluateLines (rare paths such as four Pharaohs + one symbol are not reached by random sampling).
function validateEveryLineSequence() {
  let checked = 0;
  let bad = 0;
  const filler = 'anubis';
  for (let code = 0; code < 8 ** REELS; code++) {
    const seq = [];
    let c = code;
    for (let i = 0; i < REELS; i++) { seq.push(SYMBOL_ORDER[c % 8]); c = Math.floor(c / 8); }
    const rows = [Array(REELS).fill(filler), seq, Array(REELS).fill(filler)]; // middle row = payline 1 (index 0)
    const real = evaluateLines(rows).filter((win) => win.line === 0).reduce((sum, win) => sum + win.multiplier, 0);
    let state = START;
    for (let reel = 0; reel < REELS; reel++) state = next(state, seq[reel]);
    const mine = stateInfo[state].kind === 'done' ? stateInfo[state].payout : NaN;
    checked++;
    if (real !== mine) bad++;
  }
  return { checked, bad };
}
const lineCheck = validateEveryLineSequence();
if (lineCheck.bad !== 0) throw new Error(`state machine wrong on ${lineCheck.bad} line sequences`);

// ---------- joint distribution over reels ----------
const RADIX = 64;
function lineDistribution(weights, withScatterCount) {
  const total = weights.reduce((a, b) => a + b, 0);
  const columns = [];
  for (let a = 0; a < 8; a++)
    for (let b = 0; b < 8; b++)
      for (let c = 0; c < 8; c++) {
        const p = (weights[a] * weights[b] * weights[c]) / total ** 3;
        if (p > 0) {
          const symbols = [SYMBOL_ORDER[a], SYMBOL_ORDER[b], SYMBOL_ORDER[c]];
          columns.push({ symbols, p, scarabs: symbols.filter((s) => s === 'scarab').length });
        }
      }
  let dist = new Map([[0, 1]]); // all five lines START (id 0), 0 scarabs
  for (let reel = 0; reel < REELS; reel++) {
    const out = new Map();
    for (const [key, probability] of dist) {
      let rest = Math.floor(key / RADIX ** 5);
      const scarabsSoFar = rest;
      const lineStates = [];
      let k = key % RADIX ** 5;
      for (let i = 0; i < PAYLINES.length; i++) {
        lineStates.push(k % RADIX);
        k = Math.floor(k / RADIX);
      }
      for (const column of columns) {
        let newKey = 0;
        for (let i = PAYLINES.length - 1; i >= 0; i--) {
          const id = next(lineStates[i], column.symbols[PAYLINES[i][reel]]);
          if (id >= RADIX) throw new Error('state id overflow');
          newKey = newKey * RADIX + id;
        }
        const scarabs = withScatterCount ? scarabsSoFar + column.scarabs : 0;
        newKey += scarabs * RADIX ** 5;
        out.set(newKey, (out.get(newKey) ?? 0) + probability * column.p);
      }
    }
    dist = out;
  }
  // final: collapse to (line multiple, scarabs)
  const collapsed = new Map();
  for (const [key, probability] of dist) {
    const scarabs = Math.floor(key / RADIX ** 5);
    let k = key % RADIX ** 5;
    let multiple = 0;
    for (let i = 0; i < PAYLINES.length; i++) {
      const state = stateInfo[k % RADIX];
      if (state.kind !== 'done') throw new Error('line not finished');
      multiple += state.payout;
      k = Math.floor(k / RADIX);
    }
    const id = `${multiple}|${scarabs}`;
    collapsed.set(id, (collapsed.get(id) ?? 0) + probability);
  }
  return { collapsed, states: dist.size };
}

const base = lineDistribution(SYMBOL_WEIGHTS, true);
const free = lineDistribution(FREE_SPIN_SYMBOL_WEIGHTS, false);

// free spin: distribution of the line multiple
const freeY = new Map();
for (const [id, p] of free.collapsed) {
  const multiple = Number(id.split('|')[0]);
  freeY.set(multiple, (freeY.get(multiple) ?? 0) + p);
}
const freeMean = [...freeY].reduce((s, [v, p]) => s + v * p, 0);
const freeSecond = [...freeY].reduce((s, [v, p]) => s + v * v * p, 0);

// base spin: lines + scatter prize
const scatterPrize = (scarabs) => (scarabs >= 4 ? SCATTER_REWARDS[4].multiplier : scarabs === 3 ? SCATTER_REWARDS[3].multiplier : 0);
const freeSpinsFor = (scarabs) => (scarabs >= 4 ? SCATTER_REWARDS[4].freeSpins : scarabs === 3 ? SCATTER_REWARDS[3].freeSpins : 0);

const baseLineMean = [...base.collapsed].reduce((s, [id, p]) => s + Number(id.split('|')[0]) * p, 0);
const scatterCounts = new Map();
for (const [id, p] of base.collapsed) {
  const scarabs = Number(id.split('|')[1]);
  scatterCounts.set(scarabs, (scatterCounts.get(scarabs) ?? 0) + p);
}
const scatterMean = [...scatterCounts].reduce((s, [n, p]) => s + scatterPrize(n) * p, 0);
const pTrigger3 = scatterCounts.get(3) ?? 0;
const pTrigger4 = [...scatterCounts].filter(([n]) => n >= 4).reduce((s, [, p]) => s + p, 0);
const featureMean = (pTrigger3 * 10 + pTrigger4 * 15) * freeMean;
const rtp = baseLineMean + scatterMean + featureMean;

// ---------- exact total distribution (base spin + whole feature) ----------
const maxY = Math.max(...freeY.keys());
function convolvePower(spins) {
  let arr = new Float64Array(1);
  arr[0] = 1;
  for (let n = 0; n < spins; n++) {
    const out = new Float64Array(arr.length + maxY);
    for (let i = 0; i < arr.length; i++) {
      const a = arr[i];
      if (a === 0) continue;
      for (const [v, p] of freeY) out[i + v] += a * p;
    }
    arr = out;
  }
  return arr;
}
const F10 = convolvePower(10);
const F15 = convolvePower(15);

const maxBase = Math.max(...[...base.collapsed.keys()].map((id) => Number(id.split('|')[0]))) + 20;
const size = maxBase + F15.length + 1;
const total = new Float64Array(size);
for (const [id, p] of base.collapsed) {
  const [m, s] = id.split('|').map(Number);
  const offset = m + scatterPrize(s);
  if (s >= 4) F15.forEach((q, i) => (total[offset + i] += p * q));
  else if (s === 3) F10.forEach((q, i) => (total[offset + i] += p * q));
  else total[offset] += p;
}

let mean = 0, second = 0, sum = 0, maxValue = 0;
for (let t = 0; t < size; t++) {
  const q = total[t];
  if (q === 0) continue;
  sum += q;
  mean += t * q;
  second += t * t * q;
  if (q > 0 && t > maxValue) maxValue = t;
}
const variance = second - mean * mean;
const tail = (x) => { let s = 0; for (let t = Math.ceil(x); t < size; t++) s += total[t]; return s; };

const lineWinFrequency = 1 - [...base.collapsed].filter(([id]) => id.startsWith('0|')).reduce((s, [, p]) => s + p, 0);

const out = {
  game: 'pharaohs-fortune',
  engineVersion: '1.0.0',
  method: 'exact joint DP over reels x 5 paylines x scarab count; free spins by convolution',
  validation: { randomGridsChecked: validationSamples, mismatches, everyLineSequenceChecked: lineCheck.checked, lineSequenceMismatches: lineCheck.bad },
  symbolProbabilities: Object.fromEntries(SYMBOL_ORDER.map((s, i) => [s, SYMBOL_WEIGHTS[i] / SYMBOL_WEIGHTS.reduce((a, b) => a + b, 0)])),
  rtp: {
    total: rtp,
    houseEdge: 1 - rtp,
    baseLines: baseLineMean,
    scatterPrize: scatterMean,
    freeSpinsFeature: featureMean,
    meanLineMultipleOfOneFreeSpin: freeMean,
    checkFromDistribution: mean,
  },
  probabilities: {
    anyLineWinOnPaidSpin: lineWinFrequency,
    scatterCount: Object.fromEntries([...scatterCounts].sort((a, b) => a[0] - b[0])),
    triggerFreeSpins: pTrigger3 + pTrigger4,
    exactly3Scarabs: pTrigger3,
    atLeast4Scarabs: pTrigger4,
    paidSpinPaysAnything: 1 - total[0],
    totalMassCheck: sum,
  },
  freeSpinLineMultiple: { mean: freeMean, variance: freeSecond - freeMean ** 2, distribution: Object.fromEntries([...freeY].sort((a, b) => a[0] - b[0])) },
  distributionPerPaidSpin: {
    meanMultipleOfBet: mean,
    variance,
    standardDeviation: Math.sqrt(variance),
    maxMultipleWithPositiveProbability: maxValue,
    atLeast: Object.fromEntries([0.0001, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 5000].map((x) => [`>=${x}x`, tail(x)])),
    stateVectorsReached: { base: base.states, free: free.states },
  },
};
writeResult('exact-pharaoh', out);
console.log(JSON.stringify({ rtp: out.rtp, probabilities: out.probabilities, sd: out.distributionPerPaidSpin.standardDeviation, max: maxValue, mismatches }, null, 1));
