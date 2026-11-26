// EXACT mathematics of Roulette, Tiger Clash and SKYFALL.
//
//   node exact-table-games.js
//
// Roulette and Tiger Clash have a finite, small outcome space, so the real engine code is run once for EVERY
// possible outcome (a stand-in random source returns each outcome in turn) and the results are averaged with the
// exact outcome probabilities. SKYFALL's crash point is continuous, so its numbers come from the closed form of the
// code's formula, and the code's own drawCrashPoint is checked against that formula around every boundary tested.
const { load, writeResult } = require('./common');

/* =============================== ROULETTE =============================== */
const roulette = (() => {
  const { RouletteEngine, resolveBet } = load('roulette/roulette.engine');
  const cfg = load('roulette/roulette.config');
  const engine = new RouletteEngine();
  const pockets = cfg.POCKETS.length;

  // every position the engine accepts
  const ids = [];
  for (let n = 0; n <= 36; n++) ids.push(`straight:${n}`);
  for (let a = 0; a <= 36; a++) for (let b = a + 1; b <= 36; b++) if (resolveBet(`split:${a}-${b}`)) ids.push(`split:${a}-${b}`);
  for (let a = 1; a <= 34; a++) if (resolveBet(`street:${a}`)) ids.push(`street:${a}`);
  for (let a = 1; a <= 33; a++) if (resolveBet(`corner:${a}`)) ids.push(`corner:${a}`);
  for (let a = 1; a <= 31; a++) if (resolveBet(`sixline:${a}`)) ids.push(`sixline:${a}`);
  for (let d = 1; d <= 3; d++) ids.push(`dozen:${d}`, `column:${d}`);
  ids.push('red', 'black', 'odd', 'even', 'low', 'high');

  const fakeRng = (pocketIndex) => ({ int: () => pocketIndex, draws: 1 });
  const rows = [];
  let worstRtpDeviation = 0;
  for (const id of ids) {
    const bet = engine.prepareBet({ bets: [{ id, amount: 100 }] }).bet;
    let returned = 0;
    let wins = 0;
    for (let p = 0; p < pockets; p++) {
      const step = engine.startRound({ bet, rng: fakeRng(p), sessionState: {}, stake: 100, now: new Date(0) });
      returned += step.credit;
      if (step.credit > 0) wins++;
    }
    const rtp = returned / pockets / 100;
    worstRtpDeviation = Math.max(worstRtpDeviation, Math.abs(rtp - 36 / 37));
    rows.push({ id, type: resolveBet(id).type, numbersCovered: resolveBet(id).numbers.length, winningPockets: wins, probability: wins / pockets, rtp });
  }
  const byType = {};
  for (const row of rows) {
    const t = (byType[row.type] ??= { positions: 0, numbersCovered: row.numbersCovered, probability: row.probability, rtp: row.rtp, netPayout: cfg.PAYOUT[row.type] });
    t.positions++;
  }

  // worst case: every position at the table limit in one spin
  const all = ids.map((id) => ({ id, amount: cfg.MAX_PER_POSITION }));
  const prepared = engine.prepareBet({ bets: all });
  let maxCredit = 0;
  let maxPocket = -1;
  for (let p = 0; p < pockets; p++) {
    const step = engine.startRound({ bet: prepared.bet, rng: fakeRng(p), sessionState: {}, stake: prepared.stake, now: new Date(0) });
    if (step.credit > maxCredit) { maxCredit = step.credit; maxPocket = cfg.POCKETS[p]; }
  }
  let sumCredit = 0;
  for (let p = 0; p < pockets; p++) sumCredit += engine.startRound({ bet: prepared.bet, rng: fakeRng(p), sessionState: {}, stake: prepared.stake, now: new Date(0) }).credit;

  return {
    pockets,
    positions: ids.length,
    wheelIsPermutationOf0to36: new Set(cfg.POCKETS).size === 37 && cfg.POCKETS.every((n) => n >= 0 && n <= 36),
    redCount: cfg.RED_NUMBERS.size,
    expectedRtp: 36 / 37,
    worstDeviationFrom36over37: worstRtpDeviation,
    byType,
    tableLimit: { perPosition: cfg.MAX_PER_POSITION, maxEntries: cfg.MAX_BET_ENTRIES },
    maxSingleBetReturn: { straight: cfg.MAX_PER_POSITION * (cfg.PAYOUT.straight + 1) },
    allPositionsAtLimit: {
      positionsStaked: ids.length,
      totalStake: prepared.stake,
      maxReturn: maxCredit,
      atWinningNumber: maxPocket,
      meanReturn: sumCredit / pockets,
      rtp: sumCredit / pockets / prepared.stake,
      maxNetWin: maxCredit - prepared.stake,
    },
  };
})();

/* ============================== TIGER CLASH ============================== */
const tiger = (() => {
  const { TigerClashEngine, payoutFor } = load('tiger-clash/tiger-clash.engine');
  const cfg = load('tiger-clash/tiger-clash.config');
  const engine = new TigerClashEngine();
  const deck = [];
  for (const suit of cfg.SUITS) for (let rank = cfg.MIN_RANK; rank <= cfg.MAX_RANK; rank++) deck.push(`${rank}${suit}`);

  const stake = 100;
  const totals = { tiger: 0, dragon: 0, tie: 0 };
  const outcome = { tiger: 0, dragon: 0, tie: 0 };
  let pairs = 0;
  for (const t of deck) {
    for (const d of deck) {
      if (t === d) continue;
      const arranged = deck.filter((c) => c !== t && c !== d).concat([d, t]); // the engine pops tiger first, then dragon
      const rng = { shuffle: () => arranged.slice(), int: () => 0, draws: 1 };
      pairs++;
      for (const side of ['tiger', 'dragon', 'tie']) {
        const step = engine.startRound({ bet: { side, stake }, rng, sessionState: { deck: [] }, stake, now: new Date(0) });
        totals[side] += step.credit;
        if (side === 'tiger') outcome[step.result.winner]++;
      }
    }
  }
  const rtp = Object.fromEntries(Object.entries(totals).map(([side, sum]) => [side, sum / pairs / stake]));
  const prob = Object.fromEntries(Object.entries(outcome).map(([k, n]) => [k, n / pairs]));
  // conditional tie probability for a deck with ranks counts c: sum c(c-1) / (n(n-1))
  const pTieFull = (13 * 4 * 3) / (52 * 51);
  return {
    orderedCardPairs: pairs,
    probability: prob,
    expectedRtp: rtp,
    houseEdge: Object.fromEntries(Object.entries(rtp).map(([k, v]) => [k, 1 - v])),
    closedForm: { pTie: pTieFull, tiger: 1 - 0.5 * pTieFull, dragon: 1 - 0.5 * pTieFull, tie: 9 * pTieFull },
    payoutTable: cfg.PAYOUT,
    breakEvenTieProbability: 1 / 9,
    maxPayout: { tieBetAtMaxStake: cfg.MAX_STAKE * cfg.PAYOUT.tie, sideBetAtMaxStake: cfg.MAX_STAKE * cfg.PAYOUT.win },
    payoutForCheck: { tigerWin: payoutFor('tiger', 100, 'tiger'), tigerOnTie: payoutFor('tiger', 100, 'tie'), tieOnTie: payoutFor('tie', 100, 'tie'), tieOnWin: payoutFor('tie', 100, 'tiger') },
  };
})();

/* ================================ SKYFALL ================================ */
const skyfall = (() => {
  const { drawCrashPoint } = load('skyfall/skyfall.engine');
  const cfg = load('skyfall/skyfall.config');
  const E = cfg.HOUSE_EDGE;
  const reach = (m) => (1 - E) / m; // P(crash point >= m) for 1 <= m <= MAX_CRASH_MULTIPLIER

  // the code's draw, checked just below and just above the exact threshold of every tested target
  const checks = [];
  const targets = [1.01, 1.1, 1.5, 2, 3, 5, 10, 25, 100, 500, 1000];
  let boundaryErrors = 0;
  for (const m of targets) {
    const u = 1 - (1 - E) / m; // x = (1-E)/(1-u) = m exactly here
    const below = drawCrashPoint({ float: () => u - 1e-9 });
    const above = drawCrashPoint({ float: () => Math.min(u + 1e-9, 1 - 1e-16) });
    const ok = below < m && above >= m;
    if (!ok) boundaryErrors++;
    checks.push({ target: m, thresholdU: u, crashJustBelow: below, crashJustAbove: above, ok });
  }
  const instantCrashU = drawCrashPoint({ float: () => E - 1e-12 }); // U below E => instant crash
  const maxDraw = drawCrashPoint({ float: () => 1 - 1e-16 });

  const rows = targets.map((m) => ({
    target: m,
    probabilityOfPaying: reach(m),
    rtp: m * reach(m),
    standardDeviationOfReturn: Math.sqrt(m * (1 - E) - (1 - E) ** 2),
  }));
  const manual = [1.01, 1.5, 2, 5, 10, 100].map((f) => ({ displayedMultiple: f, rtp: (1 - E) * (f / (f + 0.01)), vsAuto: (1 - E) * (f / (f + 0.01)) - (1 - E) }));

  return {
    houseEdgeSetting: E,
    maxCrashMultiplier: cfg.MAX_CRASH_MULTIPLIER,
    probabilityInstantCrashAt1x_continuous: E,
    probabilityCrashPointEqualsExactly1_00: E + ((1 - E) / 1 - (1 - E) / 1.01),
    medianCrashPoint: (1 - E) / 0.5,
    probabilityOfMaxCrash: (1 - E) / cfg.MAX_CRASH_MULTIPLIER,
    autoCashoutRows: rows,
    manualCashoutRows: manual,
    boundaryChecks: checks,
    boundaryErrors,
    drawJustBelowInstantThreshold: instantCrashU,
    drawAtUnitIntervalTop: maxDraw,
    maxPayout: { perPanel: cfg.MAX_STAKE * cfg.MAX_CRASH_MULTIPLIER, twoPanels: 2 * cfg.MAX_STAKE * cfg.MAX_CRASH_MULTIPLIER },
    maxPayoutProbabilityPerPanel: (1 - E) / cfg.MAX_CRASH_MULTIPLIER,
  };
})();

writeResult('exact-table-games', { roulette, tiger, skyfall });
console.log('roulette: positions', roulette.positions, 'worst |RTP-36/37|', roulette.worstDeviationFrom36over37, 'all-in max return', roulette.allPositionsAtLimit.maxReturn, 'stake', roulette.allPositionsAtLimit.totalStake);
console.log('tiger:', JSON.stringify(tiger.expectedRtp), JSON.stringify(tiger.probability));
console.log('skyfall boundary errors:', skyfall.boundaryErrors, 'P(crash==1.00)', skyfall.probabilityCrashPointEqualsExactly1_00);
