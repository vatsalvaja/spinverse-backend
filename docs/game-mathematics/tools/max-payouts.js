// Largest possible payout of one paid round for the slot games, taken from the real configuration and evaluators.
//   node max-payouts.js
const { load, writeResult } = require('./common');

/* ---------------------------- Pharaoh's Fortune ---------------------------- */
const pharaoh = (() => {
  const cfg = load('pharaohs-fortune/pharaohs-fortune.config');
  const { evaluateLines } = load('pharaohs-fortune/pharaohs-fortune.engine');
  const { ROWS, REELS, SCATTER_REWARDS, BET_STEPS } = cfg;
  const grid = (cell) => Array.from({ length: ROWS }, () => Array(REELS).fill(cell));
  const multiple = (rows) => evaluateLines(rows).reduce((s, w) => s + w.multiplier, 0);

  const allPharaohs = multiple(grid('pharaoh'));
  const cells = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < REELS; c++) cells.push([r, c]);

  const best = {};
  for (const k of [3, 4]) {
    let top = 0;
    (function choose(start, chosen) {
      if (chosen.length === k) {
        const rows = grid('pharaoh');
        chosen.forEach(([r, c]) => (rows[r][c] = 'scarab'));
        top = Math.max(top, multiple(rows));
        return;
      }
      for (let i = start; i < cells.length; i++) choose(i + 1, chosen.concat([cells[i]]));
    })(0, []);
    best[k] = top;
  }
  const reward3 = SCATTER_REWARDS[3], reward4 = SCATTER_REWARDS[4];
  const total3 = best[3] + reward3.multiplier + reward3.freeSpins * allPharaohs;
  const total4 = best[4] + reward4.multiplier + reward4.freeSpins * allPharaohs;
  const maxMultiple = Math.max(total3, total4);
  return {
    allFifteenPharaohsLineMultiple: allPharaohs,
    bestBaseLineMultipleWith3Scarabs: best[3],
    bestBaseLineMultipleWith4Scarabs: best[4],
    maxTotalMultipleWith3Scarabs: total3,
    maxTotalMultipleWith4Scarabs: total4,
    maxMultipleOfBet: maxMultiple,
    maxBet: Math.max(...BET_STEPS),
    maxCredits: maxMultiple * Math.max(...BET_STEPS),
    note: 'Free spins re-use the triggering bet and cannot re-trigger. A free spin that shows 15 Pharaohs pays 5 x 1000 x bet.',
  };
})();

/* ----------------------------- Atlantis Cascade ----------------------------- */
const atlantis = (() => {
  const cfg = load('atlantis-cascade/atlantis-cascade.config');
  const { PAY, COLS, ROWS, MAX_CASCADES, BASE_MULTIPLIER_CAP, FREE_MULTIPLIER_CAP, BET_STEPS, FREE_SPINS_TRIGGER, freeSpinsFor } = cfg;
  const cells = COLS * ROWS;
  const top = Object.entries(PAY).map(([s, p]) => [s, p[4], p[3]]).sort((a, b) => b[1] - a[1]); // [symbol, pay for 15+, pay for 12-14]
  // Best split of the 30 cells into clusters of one or more symbols. Touching clusters need different symbols, and every
  // cluster pays by its size, so the best use of 30 cells is two clusters of 15 cells (pearl 15+ and trident 15+).
  const bestCascade = top[0][1] + top[1][1];
  // pay-per-cell can never exceed this, which bounds ANY board
  const perCellBound = Math.max(...Object.values(PAY).map((p) => Math.max(p[0] / 5, p[1] / 7, p[2] / 9, p[3] / 12, p[4] / 15)));
  const looseCascadeBound = perCellBound * cells;
  let baseBound = 0;
  for (let i = 1; i <= MAX_CASCADES; i++) baseBound += bestCascade * Math.min(BASE_MULTIPLIER_CAP, i);
  const freeSpinBound = MAX_CASCADES * bestCascade * FREE_MULTIPLIER_CAP; // one free spin, multiplier already at the cap
  const mostFreeSpins = freeSpinsFor(6);
  return {
    clusterPayAt15Plus: Object.fromEntries(Object.entries(PAY).map(([s, p]) => [s, p[4]])),
    bestSingleCascadeMultiple: bestCascade,
    perCellPayCeiling: perCellBound,
    looseSingleCascadeBound: looseCascadeBound,
    maxCascadesPerSpin: MAX_CASCADES,
    structuralBoundBaseSpinMultiple: baseBound,
    structuralBoundOneFreeSpinMultiple: freeSpinBound,
    mostFreeSpinsAwarded: mostFreeSpins,
    structuralBoundFeatureMultiple: baseBound + mostFreeSpins * freeSpinBound,
    maxBet: Math.max(...BET_STEPS),
    freeSpinsTrigger: FREE_SPINS_TRIGGER,
    note: 'There is NO win cap in the code. These are mathematical ceilings (every cascade a perfect 210x board, 100 cascades, multiplier at cap); the real probability of anything near them is effectively zero. The largest payout actually observed is in the simulation result.',
  };
})();

writeResult('max-payouts', { pharaoh, atlantis });
console.log(JSON.stringify({ pharaoh, atlantis }, null, 1));
