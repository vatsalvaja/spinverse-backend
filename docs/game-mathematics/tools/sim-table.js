// Simulations of Roulette, Tiger Clash and SKYFALL with the REAL compiled engines and the real HMAC random stream.
//   node sim-table.js roulette 1000000
//   node sim-table.js tiger 1000000
//   node sim-table.js tiger-count <decks>
//   node sim-table.js skyfall 1000000
//
// Every round gets its own seed, exactly like the runtime (a fresh seed per round; Tiger Clash keeps its deck in
// the session state between rounds).
const { engines, rngFor, Accumulator, writeResult, chiSquarePValue, load } = require('./common');

const [mode, nArg] = process.argv.slice(2);
const N = Number(nArg);
if (!mode || !N) throw new Error('usage: node sim-table.js <roulette|tiger|tiger-count|skyfall> <rounds>');
const now = new Date(0);
const report = (label, accumulator, stakePerRound) => ({
  label,
  rounds: accumulator.n,
  rtp: accumulator.mean / stakePerRound,
  standardError: accumulator.se / stakePerRound,
  ci95: [(accumulator.mean - 1.96 * accumulator.se) / stakePerRound, (accumulator.mean + 1.96 * accumulator.se) / stakePerRound],
});

/* ------------------------------- ROULETTE ------------------------------- */
function roulette() {
  const engine = engines.roulette;
  const positions = ['straight:17', 'split:8-9', 'street:7', 'corner:1', 'sixline:1', 'dozen:2', 'column:3', 'red', 'black', 'odd', 'even', 'low', 'high'];
  const prepared = engine.prepareBet({ bets: positions.map((id) => ({ id, amount: 1 })) });
  const perPosition = Object.fromEntries(positions.map((id) => [id, new Accumulator()]));
  const total = new Accumulator();
  const counts = new Array(37).fill(0);
  const violations = [];
  for (let i = 0; i < N; i++) {
    const step = engine.startRound({ bet: prepared.bet, stake: prepared.stake, sessionState: {}, rng: rngFor('roulette', i), now });
    counts[step.result.winningNumber]++;
    let sum = 0;
    for (const line of step.result.lines) {
      perPosition[line.id].add(line.returned);
      sum += line.returned;
    }
    if (Math.abs(sum - step.credit) > 1e-9 && violations.length < 5) violations.push(`credit ${step.credit} != sum of lines ${sum}`);
    total.add(sum);
  }
  const expected = N / 37;
  const chi = counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0);
  return {
    game: 'roulette',
    spins: N,
    theoreticalRtp: 36 / 37,
    perPosition: Object.fromEntries(Object.entries(perPosition).map(([id, a]) => [id, report(id, a, 1)])),
    allThirteenBetsTogether: report('all 13 positions together', total, positions.length),
    pocketUniformity: { chiSquare: chi, degreesOfFreedom: 36, pValue: chiSquarePValue(chi, 36), minCount: Math.min(...counts), maxCount: Math.max(...counts), expectedPerPocket: expected },
    violations,
  };
}

/* ------------------------------ TIGER CLASH ------------------------------ */
function tigerFlat() {
  const engine = engines['tiger-clash'];
  const stake = 100;
  const out = {};
  for (const side of ['tiger', 'dragon', 'tie']) {
    const acc = new Accumulator();
    let state = engine.createSessionState();
    let ties = 0, reshuffles = 0;
    const violations = [];
    for (let i = 0; i < N; i++) {
      const prepared = engine.prepareBet({ side, stake }, state);
      const step = engine.startRound({ bet: prepared.bet, stake: prepared.stake, sessionState: state, rng: rngFor(`tiger:${side}`, i), now });
      acc.add(step.credit);
      if (step.result.winner === 'tie') ties++;
      if (step.result.reshuffled) reshuffles++;
      if (step.result.tiger.id === step.result.dragon.id && violations.length < 5) violations.push('same card dealt twice');
      state = step.sessionState;
    }
    out[side] = { ...report(`${side} bet`, acc, stake), tieFrequency: ties / N, roundsPerReshuffle: N / reshuffles };
    out[side].violations = violations;
  }
  return { game: 'tiger-clash', rounds: N, stake, theoretical: { tiger: 1 - 1.5 / 51, dragon: 1 - 1.5 / 51, tie: 27 / 51, pTie: 3 / 51 }, results: out };
}

/* A player who only uses what the API shows: the two cards of every finished round and `reshuffled`. */
function tigerCount() {
  const engine = engines['tiger-clash'];
  const DECKS = N;
  const BIG = 10000, SMALL = 1;
  const rankOf = (id) => Number(id.slice(0, -1));

  let rounds = 0;
  const flat = new Accumulator();        // flat 100 stake, side chosen each round by the better expected return
  let edgeRounds = 0;                    // rounds where the tie bet had a positive expectation
  let profitBigUnits = 0;                // profit (in units of the big stake) betting BIG on tie only when 9p>1, SMALL on tiger otherwise
  let stakedBigUnits = 0;
  const perDeck = new Accumulator();
  let maxPTie = 0;
  let sureTies = 0;                      // rounds where the player KNEW the cards tie (p = 1)
  const pTieSeen = [];

  let state = engine.createSessionState();
  let counts = null;
  let n = 0;
  let deckProfit = 0;
  let sessionRound = 0;
  const totalRounds = DECKS * 26;
  for (let i = 0; i < totalRounds; i++) {
    // composition known to the player BEFORE this round
    const reshufflesNext = (engine.describeSession(state).cardsLeftInDeck ?? 0) < 2;
    if (reshufflesNext) {
      counts = new Array(15).fill(0);
      for (let r = 2; r <= 14; r++) counts[r] = 4;
      n = 52;
      if (i > 0) { perDeck.add(deckProfit); deckProfit = 0; }
    }
    let sumPairs = 0;
    for (let r = 2; r <= 14; r++) sumPairs += counts[r] * (counts[r] - 1);
    const pTie = sumPairs / (n * (n - 1));
    if (pTie > maxPTie) maxPTie = pTie;
    if (Math.abs(pTie - 1) < 1e-12) sureTies++;
    const tieEdge = 9 * pTie - 1 > 0;
    if (tieEdge) edgeRounds++;

    // flat stake, best side by expectation
    const side = tieEdge ? 'tie' : 'tiger';
    let prepared = engine.prepareBet({ side, stake: 100 }, state);
    const rng = rngFor('tiger-count', i);
    let step = engine.startRound({ bet: prepared.bet, stake: prepared.stake, sessionState: state, rng, now });
    flat.add(step.credit);

    // bet spreading: BIG on tie only with an edge, SMALL on tiger otherwise (same cards: derive the payout directly)
    const winner = step.result.winner;
    if (tieEdge) { const back = winner === 'tie' ? 9 : 0; profitBigUnits += (back - 1); stakedBigUnits += 1; deckProfit += back - 1; }
    else { const back = winner === 'tiger' ? 2 : winner === 'tie' ? 0.5 : 0; profitBigUnits += (SMALL / BIG) * (back - 1); stakedBigUnits += SMALL / BIG; deckProfit += (SMALL / BIG) * (back - 1); }

    // update what the player has seen
    counts[rankOf(step.result.tiger.id)]--;
    counts[rankOf(step.result.dragon.id)]--;
    n -= 2;
    state = step.sessionState;
    rounds++;
    sessionRound++;
  }
  perDeck.add(deckProfit);
  return {
    game: 'tiger-clash',
    decksPlayed: DECKS,
    rounds,
    note: 'Card counting from the visible cards of finished rounds only (the deck itself is never sent to the player).',
    flatStake100_bestSideEachRound: report('flat 100, tie when 9*p(tie) > 1 else tiger', flat, 100),
    roundsWithPositiveTieExpectation: edgeRounds,
    fractionOfRoundsWithEdge: edgeRounds / rounds,
    maximumConditionalTieProbabilitySeen: maxPTie,
    roundsWhereTheTieWasCertain: sureTies,
    betSpreading: {
      bigStake: BIG,
      smallStake: SMALL,
      description: 'stake 10000 on Tie when the counted tie probability exceeds 1/9, otherwise stake 1 on Tiger',
      profitPerDeckInUnitsOfBigStake: perDeck.mean,
      profitPerDeckStandardError: perDeck.se,
      profitPerDeckCredits: perDeck.mean * BIG,
      profitPerDeckCreditsCi95: [(perDeck.mean - 1.96 * perDeck.se) * BIG, (perDeck.mean + 1.96 * perDeck.se) * BIG],
      overallReturnOnStake: (stakedBigUnits + profitBigUnits) / stakedBigUnits,
      totalStakedInBigUnits: stakedBigUnits,
    },
  };
}

/* -------------------------------- SKYFALL -------------------------------- */
function skyfall() {
  const engine = engines.skyfall;
  const cfg = load('skyfall/skyfall.config');
  const takeoff = cfg.TAKEOFF_MS;
  const FAR = new Date(24 * 3600 * 1000); // far in the future: the flight is over and every automatic cash-out has happened
  const stake = 100;
  const targets = [1.01, 1.1, 1.5, 2, 3, 5, 10, 25, 100, 500, 1000];
  const crashGrid = [1.0, 1.01, 1.5, 2, 5, 10, 100, 1000];
  const crashCounts = new Array(crashGrid.length).fill(0);
  let crashSamples = 0;
  const results = {};
  for (const m of targets) {
    const acc = new Accumulator();
    let wins = 0;
    const violations = [];
    for (let i = 0; i < N; i++) {
      const rng = rngFor(`skyfall:auto:${m}`, i);
      const start = engine.startRound({ bet: { panels: [{ panel: 0, stake, autoCashout: m }] }, stake, sessionState: {}, rng, now });
      const end = engine.resolveRound({ roundState: start.roundState, now: FAR, sessionState: {} });
      if (end.status !== 'SETTLED' && violations.length < 5) violations.push('round not settled after the flight');
      acc.add(end.credit);
      if (end.credit > 0) wins++;
      const crash = end.result.crashPoint;
      crashSamples++;
      crashGrid.forEach((g, k) => { if (crash >= g) crashCounts[k]++; });
    }
    results[m] = { ...report(`auto cash-out ${m}x`, acc, stake), winFrequency: wins / N, theoreticalWinFrequency: 0.95 / m, theoreticalRtp: 0.95, maxPayoutObserved: acc.max, violations };
  }

  // manual cash-out at a fixed point of the flight, through applyAction
  const manual = {};
  for (const f of [1.5, 2, 10]) {
    const acc = new Accumulator();
    const secondsToReach = Math.log(f * (1 + 1e-6)) / cfg.GROWTH;
    const at = new Date(takeoff + secondsToReach * 1000);
    for (let i = 0; i < N; i++) {
      const rng = rngFor(`skyfall:manual:${f}`, i);
      const start = engine.startRound({ bet: { panels: [{ panel: 0, stake }] }, stake, sessionState: {}, rng, now });
      const step = engine.applyAction({ action: { type: 'CASH_OUT', panel: 0 }, roundState: start.roundState, now: at, sessionState: {} });
      acc.add(step.credit);
    }
    manual[f] = { ...report(`manual cash-out at ${f}x`, acc, stake), theoreticalRtp: 0.95 * (f / (f + 0.01)) };
  }

  return {
    game: 'skyfall',
    roundsPerTarget: N,
    stakePerRound: stake,
    automatic: results,
    manual,
    crashPointDistribution: {
      samples: crashSamples,
      points: Object.fromEntries(crashGrid.map((g, k) => [`P(crash>=${g})`, { simulated: crashCounts[k] / crashSamples, theoretical: g <= 1 ? 1 : 0.95 / g }])),
    },
  };
}

const fns = { roulette, tiger: tigerFlat, 'tiger-count': tigerCount, skyfall };
if (!fns[mode]) throw new Error(`unknown mode ${mode}`);
const started = Date.now();
const result = fns[mode]();
result.seconds = (Date.now() - started) / 1000;
writeResult(`sim-${mode}`, result);
console.log(JSON.stringify(result, (k, v) => (typeof v === 'number' ? Number(v.toPrecision(6)) : v), 1).slice(0, 2500));
