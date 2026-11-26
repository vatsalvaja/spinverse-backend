// What can be said EXACTLY about Atlantis Cascade, plus a measured breakdown of where its return comes from.
//   node atlantis-checks.js [spins]
//
// Exact: the number of Scatters on the first board (30 independent 2% cells) and so the free-spin trigger.
// NOT closed-form: the return. Cascades refill the board with symbols that copy their neighbours, wilds join
// clusters and are claimed in value order, and the multiplier depends on the cascade index, so the return can only be
// measured. This script measures the pieces (by symbol, by cluster size, by cascade number) from the real engine.
const { engines, rngFor, writeResult, load } = require('./common');

const spins = Number(process.argv[2] ?? 500000);
const cfg = load('atlantis-cascade/atlantis-cascade.config');
const engine = engines['atlantis-cascade'];
const bet = 10;

// ---- exact scatter distribution
const cells = cfg.COLS * cfg.ROWS, p = cfg.SCATTER_PPM / cfg.PPM;
const binom = (n, k) => { let c = 1; for (let i = 1; i <= k; i++) c = (c * (n - k + i)) / i; return c * p ** k * (1 - p) ** (n - k); };
const scatterDistribution = Array.from({ length: cells + 1 }, (_, k) => binom(cells, k));
const pTrigger = scatterDistribution.slice(cfg.FREE_SPINS_TRIGGER).reduce((a, b) => a + b, 0);
const spinsAwarded = scatterDistribution.slice(cfg.FREE_SPINS_TRIGGER).reduce((s, q, i) => s + q * cfg.freeSpinsFor(i + cfg.FREE_SPINS_TRIGGER), 0);

// ---- measured breakdown (base game spins only; free spins are played as the real runtime does)
const now = new Date(0);
let state = engine.createSessionState();
const bySymbol = {}, bySize = {}, byCascade = {}, initialSymbols = {}, freeByMultiplier = {};
let paidSpins = 0, stake = 0, payout = 0, adjacentSame = 0, adjacentPairs = 0, spinsWithAnyCluster = 0, freeSpinsPlayed = 0, freePayout = 0;
const clustersPerSpin = [];
const sizeBucket = (n) => (n >= 15 ? '15+' : n >= 12 ? '12-14' : n >= 9 ? '9-11' : n >= 7 ? '7-8' : '5-6');
let engineRound = 0;

while (paidSpins < spins) {
  const prepared = engine.prepareBet({ bet }, state);
  const step = engine.startRound({ bet: prepared.bet, stake: prepared.stake, sessionState: state, rng: rngFor('atlantis-checks', engineRound++), now });
  const r = step.result;
  if (prepared.stake > 0) {
    paidSpins++;
    stake += prepared.stake;
    // first board only
    const g = r.initial;
    for (let c = 0; c < cfg.COLS; c++) for (let row = 0; row < cfg.ROWS; row++) {
      initialSymbols[g[c][row]] = (initialSymbols[g[c][row]] ?? 0) + 1;
      if (c + 1 < cfg.COLS && g[c][row] === g[c + 1][row] && g[c][row] !== 'scatter') adjacentSame++;
      if (c + 1 < cfg.COLS && g[c][row] !== 'scatter' && g[c + 1][row] !== 'scatter') adjacentPairs++;
    }
    payout += r.payout;
    if (r.steps.length > 0) spinsWithAnyCluster++;
    byCascade[Math.min(r.steps.length, 12)] = (byCascade[Math.min(r.steps.length, 12)] ?? 0) + 1;
    let clusters = 0;
    r.steps.forEach((s, i) => s.clusters.forEach((cl) => {
      clusters++;
      bySymbol[cl.symbol] = (bySymbol[cl.symbol] ?? 0) + cl.payout;
      const key = sizeBucket(cl.size);
      bySize[key] = bySize[key] ?? { clusters: 0, payout: 0 };
      bySize[key].clusters++; bySize[key].payout += cl.payout;
    }));
    clustersPerSpin.push(clusters);
  } else {
    freeSpinsPlayed++; freePayout += r.payout;
  }
  state = step.sessionState;
}

const totalCells = Object.values(initialSymbols).reduce((a, b) => a + b, 0);
writeResult('atlantis-checks', {
  game: 'atlantis-cascade', bet, paidSpins,
  exact: {
    scatterCountDistribution: scatterDistribution.slice(0, 9),
    probabilityOfFreeSpinTrigger: pTrigger,
    oneInSpins: 1 / pTrigger,
    expectedFreeSpinsAwardedPerPaidSpin: spinsAwarded,
    exactlyFourScatters: scatterDistribution[4], exactlyFiveScatters: scatterDistribution[5], sixOrMoreScatters: scatterDistribution.slice(6).reduce((a, b) => a + b, 0),
  },
  measured: {
    baseGameRtp: payout / stake,
    freeSpinsRtpContribution: freePayout / stake,
    spinsWithAtLeastOneCluster: spinsWithAnyCluster / paidSpins,
    cascadesInSpin: Object.fromEntries(Object.entries(byCascade).map(([k, v]) => [k, v / paidSpins])),
    rtpContributionBySymbol: Object.fromEntries(Object.entries(bySymbol).map(([k, v]) => [k, v / stake])),
    rtpContributionByClusterSize: Object.fromEntries(Object.entries(bySize).map(([k, v]) => [k, { clustersPerPaidSpin: v.clusters / paidSpins, rtp: v.payout / stake }])),
    firstBoardSymbolShare: Object.fromEntries(Object.entries(initialSymbols).map(([k, v]) => [k, v / totalCells])),
    chanceTwoHorizontalNeighboursMatch: adjacentSame / adjacentPairs,
    chanceTwoNeighboursMatchIfIndependent: Object.keys(initialSymbols).length ? (() => {
      const w = cfg.SYMBOL_WEIGHTS, tw = w.reduce((a, b) => a + b, 0), wild = cfg.WILD_PPM / cfg.PPM;
      const paying = w.map((x) => ((1 - wild) * x) / tw); // per-cell share of each paying symbol if drawn only from the weights
      return paying.reduce((s, q) => s + q * q, 0) + wild * wild;
    })() : null,
    averageClustersPerPaidSpin: clustersPerSpin.reduce((a, b) => a + b, 0) / paidSpins,
    freeSpinsPlayed,
  },
});
console.log('atlantis checks done: base RTP', payout / stake, 'trigger', pTrigger, '1 in', 1 / pTrigger);
