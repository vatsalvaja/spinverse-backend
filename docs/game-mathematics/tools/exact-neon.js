// EXACT mathematics of Neon Overdrive from the real configuration and the real line evaluator.
//
//   node exact-neon.js
//
// Why this is exact:
//  * Cells are independent draws, and a payline reads one cell per reel, so the expected pay of a payline is
//    a sum over the 7^5 symbol sequences scored by the REAL evaluateLines. Expectation is linear, so the total
//    over 12 paylines is the sum of the per-line expectations (no need to model how lines overlap).
//  * The Hold & Respin feature only depends on HOW MANY cores there are, and every core's value is an
//    independent draw, so the expected feature pay is (mean core value) x E[locked cores x overdrive factor]
//    plus the Grand bonus; the locked-core count is an exact Markov chain (locked cells, respins left).
const { load, writeResult } = require('./common');

const cfg = load('neon-overdrive/neon-overdrive.config');
const { evaluateLines } = load('neon-overdrive/neon-overdrive.engine');
const {
  PAYLINES, SYMBOL_ORDER, SYMBOL_WEIGHTS, TOTAL_SYMBOL_WEIGHT, ORB_VALUES, ORB_VALUE_WEIGHTS, CELLS, REELS, ROWS,
  HOLD_TRIGGER, OVERDRIVE_AT, OVERDRIVE_MULTIPLIER, GRAND_BONUS, START_RESPINS, RESPIN_CORE_CHANCE,
} = cfg;

const probOf = SYMBOL_WEIGHTS.map((w) => w / TOTAL_SYMBOL_WEIGHT);
const N = SYMBOL_ORDER.length;

// ---------- 1. expected line multiple, per payline, with the real evaluator ----------
const perLine = PAYLINES.map(() => ({ expected: 0, pWin: 0, byCount: { 3: 0, 4: 0, 5: 0 }, bySymbol: {} }));
for (let code = 0; code < N ** REELS; code++) {
  const seq = [];
  let c = code;
  let p = 1;
  for (let i = 0; i < REELS; i++) {
    const s = c % N;
    c = Math.floor(c / N);
    seq.push(SYMBOL_ORDER[s]);
    p *= probOf[s];
  }
  PAYLINES.forEach((rows, line) => {
    const grid = Array.from({ length: REELS }, () => Array(ROWS).fill('cell'));
    for (let reel = 0; reel < REELS; reel++) grid[reel][rows[reel]] = seq[reel];
    const win = evaluateLines(grid).find((w) => w.line === line);
    if (win) {
      const stats = perLine[line];
      stats.expected += win.multiplier * p;
      stats.pWin += p;
      stats.byCount[win.count] += p;
      stats.bySymbol[`${win.symbol}x${win.count}`] = (stats.bySymbol[`${win.symbol}x${win.count}`] ?? 0) + p;
    }
  });
}
const lineExpected = perLine.map((l) => l.expected);
const baseLinesRtp = lineExpected.reduce((a, b) => a + b, 0);

// ---------- 2. orbs in the base grid ----------
const pOrb = probOf[SYMBOL_ORDER.indexOf('orb')];
const binom = (n, k, p) => {
  let c = 1;
  for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i;
  return c * p ** k * (1 - p) ** (n - k);
};
const orbCount = Array.from({ length: CELLS + 1 }, (_, k) => binom(CELLS, k, pOrb));
const pTrigger = orbCount.slice(HOLD_TRIGGER).reduce((a, b) => a + b, 0);

// ---------- 3. Hold & Respin: exact Markov chain of the locked-core count ----------
const pRespin = RESPIN_CORE_CHANCE.numerator / RESPIN_CORE_CHANCE.denominator;
const finalLocked = new Array(CELLS + 1).fill(0); // distribution of final locked cores, given trigger (joint with trigger)
for (let start = HOLD_TRIGGER; start <= CELLS; start++) {
  let states = new Map([[`${start}|${START_RESPINS}`, orbCount[start]]]);
  while (states.size > 0) {
    const nextStates = new Map();
    for (const [key, probability] of states) {
      const [locked, respins] = key.split('|').map(Number);
      if (locked >= CELLS || respins <= 0) { finalLocked[locked] += probability; continue; }
      const empty = CELLS - locked;
      for (let landed = 0; landed <= empty; landed++) {
        const q = binom(empty, landed, pRespin);
        if (q === 0) continue;
        const target = landed > 0 ? `${locked + landed}|${START_RESPINS}` : `${locked}|${respins - 1}`;
        nextStates.set(target, (nextStates.get(target) ?? 0) + probability * q);
      }
    }
    states = nextStates;
  }
}
const valueTotal = ORB_VALUE_WEIGHTS.reduce((a, b) => a + b, 0);
const meanValue = ORB_VALUES.reduce((s, v, i) => s + v * ORB_VALUE_WEIGHTS[i], 0) / valueTotal;
const meanValueSq = ORB_VALUES.reduce((s, v, i) => s + v * v * ORB_VALUE_WEIGHTS[i], 0) / valueTotal;
const varValue = meanValueSq - meanValue ** 2;

let corePointsMean = 0, grandMean = 0, bonusSecond = 0, expectedLocked = 0;
for (let L = HOLD_TRIGGER; L <= CELLS; L++) {
  const q = finalLocked[L];
  if (!q) continue;
  const factor = L >= OVERDRIVE_AT ? OVERDRIVE_MULTIPLIER : 1;
  const grand = L >= CELLS ? GRAND_BONUS : 0;
  const mean = factor * L * meanValue;
  const variance = factor ** 2 * L * varValue;
  corePointsMean += q * mean;
  grandMean += q * grand;
  bonusSecond += q * (variance + (mean + grand) ** 2);
  expectedLocked += q * L;
}
const bonusRtp = corePointsMean + grandMean;
const bonusVariance = bonusSecond - bonusRtp ** 2;
const rtp = baseLinesRtp + bonusRtp;

const overdriveProb = finalLocked.slice(OVERDRIVE_AT).reduce((a, b) => a + b, 0);

// ---------- 4. theoretical maximum payout of one round ----------
// Non-orb cells all Arc Reactors (the best symbol, and wild); exactly 6 orbs (the minimum to trigger) placed to
// hurt the lines least; the feature then ends full of value-40 cores under Overdrive plus the Grand bonus.
let bestLineMultiple = 0;
const cells = [];
for (let reel = 0; reel < REELS; reel++) for (let row = 0; row < ROWS; row++) cells.push([reel, row]);
(function choose(start, chosen) {
  if (chosen.length === HOLD_TRIGGER) {
    const grid = Array.from({ length: REELS }, () => Array(ROWS).fill('reactor'));
    chosen.forEach(([reel, row]) => (grid[reel][row] = 'orb'));
    const total = evaluateLines(grid).reduce((s, w) => s + w.multiplier, 0);
    if (total > bestLineMultiple) bestLineMultiple = total;
    return;
  }
  for (let i = start; i < cells.length; i++) choose(i + 1, chosen.concat([cells[i]]));
})(0, []);
const maxCoreValue = Math.max(...ORB_VALUES);
const maxBonusMultiple = CELLS * maxCoreValue * OVERDRIVE_MULTIPLIER + GRAND_BONUS;
const maxMultiple = bestLineMultiple + maxBonusMultiple;
const allReactor = evaluateLines(Array.from({ length: REELS }, () => Array(ROWS).fill('reactor'))).reduce((s, w) => s + w.multiplier, 0);

const out = {
  game: 'neon-overdrive',
  engineVersion: '1.0.0',
  method: 'exact: per-payline enumeration with the real evaluator + exact Markov chain for Hold & Respin',
  symbolProbabilities: Object.fromEntries(SYMBOL_ORDER.map((s, i) => [s, probOf[i]])),
  rtp: {
    total: rtp,
    houseEdge: 1 - rtp,
    baseLines: baseLinesRtp,
    holdAndRespinBonus: bonusRtp,
    ofWhichCorePoints: corePointsMean,
    ofWhichGrandBonus: grandMean,
  },
  perPayline: { expectedMultiple: lineExpected, probabilityOfWin: perLine.map((l) => l.pWin), line1: perLine[0] },
  orbs: { probabilityPerCell: pOrb, countDistribution: orbCount },
  holdAndRespin: {
    probabilityOfTrigger: pTrigger,
    oneInSpins: 1 / pTrigger,
    finalLockedCoresDistributionJointWithTrigger: finalLocked,
    expectedLockedCoresGivenTrigger: expectedLocked / pTrigger,
    probabilityOverdrive: overdriveProb,
    probabilityFullGrid: finalLocked[CELLS],
    oneInSpinsFullGrid: finalLocked[CELLS] ? 1 / finalLocked[CELLS] : null,
    meanCoreValue: meanValue,
    coreValueStandardDeviation: Math.sqrt(varValue),
    coreValueProbabilities: Object.fromEntries(ORB_VALUES.map((v, i) => [v, ORB_VALUE_WEIGHTS[i] / valueTotal])),
    bonusMeanMultipleOfBetPerRound: bonusRtp,
    bonusStandardDeviationPerRound: Math.sqrt(bonusVariance),
    meanBonusGivenTrigger: bonusRtp / pTrigger,
  },
  maximum: {
    bestBaseLineMultipleWithSixOrbs: bestLineMultiple,
    allReactorLineMultiple: allReactor,
    maxBonusMultiple,
    maxMultipleOfBet: maxMultiple,
    atBet500: maxMultiple * 500,
  },
};
writeResult('exact-neon', out);
console.log(JSON.stringify({ rtp: out.rtp, lineExpected, trigger: out.holdAndRespin, maximum: out.maximum }, null, 1));
