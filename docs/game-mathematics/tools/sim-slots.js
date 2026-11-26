// Simulates the three slot-style games with the REAL engines.
//   node sim-slots.js <pharaohs-fortune|atlantis-cascade|neon-overdrive> <bet> <paidRounds>
//
// One "round" here is one PAID spin together with the whole feature it triggers (free spins, or Hold & Respin
// which the engine plays inside the same round). Free spins are engine rounds too (stake 0) and are counted
// separately. RTP = everything paid / everything staked.
const { engines, rngFor, Accumulator, Thresholds, writeResult, progress } = require('./common');

const [game, betArg, nArg] = process.argv.slice(2);
const bet = Number(betArg);
const N = Number(nArg);
const engine = engines[game];
if (!engine || !bet || !N) throw new Error('usage: node sim-slots.js <game> <bet> <paidRounds>');

const salt = process.env.SEED_SALT ? `:${process.env.SEED_SALT}` : ''; // a different salt = a different, independent set of seeds
const label = `${game}:${bet}${salt}`;
const now = new Date(0);
let state = engine.createSessionState();

let engineRounds = 0;
let freeSpinRounds = 0;
let totalStake = 0;
let totalPayout = 0;
let invariantViolations = 0;
const violations = [];
const returns = new Accumulator(); // payout / stake per paid round (feature included)
const thresholds = new Thresholds([0.0000001, 1, 2, 5, 10, 25, 50, 100, 250, 500, 1000]);
let paidWinning = 0; // paid rounds (feature included) that paid anything
let baseWinning = 0; // paid spins whose own spin paid something (before any feature)
let featureTriggers = 0;
let freeSpinsAwardedTotal = 0;
const extra = {};
const bump = (key, by = 1) => (extra[key] = (extra[key] ?? 0) + by);
const comp = {}; // credits paid, split by source
const addComp = (key, value) => (comp[key] = (comp[key] ?? 0) + value);
let maxCredit = 0;
let maxCascades = 0;

const check = (condition, message) => {
  if (!condition) {
    invariantViolations++;
    if (violations.length < 10) violations.push(message);
  }
};

for (let paid = 0; paid < N; paid++) {
  progress(label, paid, N);
  let groupStake = 0;
  let groupPayout = 0;
  let first = true;

  do {
    const prepared = engine.prepareBet({ bet }, state);
    const rng = rngFor(label, engineRounds);
    const step = engine.startRound({ bet: prepared.bet, stake: prepared.stake, sessionState: state, rng, now });
    engineRounds++;

    const result = step.result;
    // --- invariants: the paid amount must equal what the result itself reports
    check(step.status === 'SETTLED', 'slot round must settle immediately');
    check(Number.isInteger(step.credit) && step.credit >= 0, `credit must be a whole non-negative number, got ${step.credit}`);
    if (game === 'atlantis-cascade') check(result.payout === step.credit, `payout ${result.payout} != credit ${step.credit}`);
    else check(result.totalPayout === step.credit, `totalPayout ${result.totalPayout} != credit ${step.credit}`);
    if (game === 'neon-overdrive') {
      const bonusTotal = result.bonus ? result.bonus.total : 0;
      check(result.baseWin + bonusTotal === step.credit, 'neon: baseWin + bonus != credit');
    }
    if (game === 'pharaohs-fortune') check(result.linePayout + result.scatterPrize === step.credit, 'pharaoh: line + scatter != credit');
    const session = engine.describeSession(step.sessionState);
    check((session.freeSpinsLeft ?? 0) >= 0, 'freeSpinsLeft went negative');

    // --- tallies
    groupStake += prepared.stake;
    groupPayout += step.credit;
    if (prepared.stake === 0) freeSpinRounds++;
    const isFree = prepared.stake === 0;
    if (game === 'pharaohs-fortune') {
      addComp(isFree ? 'freeSpinLines' : 'baseLines', result.linePayout);
      if (!isFree) addComp('scatterPrize', result.scatterPrize);
    } else if (game === 'neon-overdrive') {
      addComp('baseLines', result.baseWin);
      addComp('holdAndRespinBonus', result.bonus ? result.bonus.total : 0);
    } else {
      addComp(isFree ? 'freeSpins' : 'baseSpin', result.payout);
      addComp('unroundedPayoutFromTotalMultiple', result.totalMultiple * bet); // what the cluster pays add up to without per-cluster rounding
      if (result.steps.length > maxCascades) maxCascades = result.steps.length;
      if (!isFree) bump(`cascades_${Math.min(result.steps.length, 10)}`);
    }
    if (step.credit > maxCredit) maxCredit = step.credit;

    if (first) {
      if (step.credit > 0) baseWinning++;
      if (game === 'pharaohs-fortune') {
        if (result.freeSpinsAwarded > 0) featureTriggers++;
        if (result.lineWins.length > 0) bump('paidSpinsWithLineWin');
        if (result.scatters === 2) bump('twoScatterTeases');
        bump(`scatters_${Math.min(result.scatters, 5)}`);
      }
      if (game === 'atlantis-cascade') {
        if (result.freeSpinsAwarded > 0) featureTriggers++;
        bump(`scatters_${Math.min(result.scatters, 6)}`);
        bump(`scatterSpins_${result.freeSpinsAwarded}`);
      }
      if (game === 'neon-overdrive') {
        const bonus = result.bonus;
        if (bonus) {
          featureTriggers++;
          bump(`finalCores_${bonus.lockedCores.length}`);
          if (bonus.overdrive) bump('overdrive');
          if (bonus.full) bump('fullGrid');
        }
        if (result.lineWins.length > 0) bump('paidSpinsWithLineWin');
      }
    }
    if (result.freeSpinsAwarded) freeSpinsAwardedTotal += result.freeSpinsAwarded;
    state = step.sessionState;
    first = false;
  } while ((engine.describeSession(state).freeSpinsLeft ?? 0) > 0);

  totalStake += groupStake;
  totalPayout += groupPayout;
  const ratio = groupPayout / groupStake;
  returns.add(ratio);
  thresholds.add(ratio);
  if (groupPayout > 0) paidWinning++;
}

const rtp = totalPayout / totalStake;
// Each paid round has equal stake, so the RTP is the mean of the per-round returns and its standard error is returns.se.
writeResult(`${game}-bet${bet}${process.env.SEED_SALT ? '-' + process.env.SEED_SALT : ''}`, {
  game,
  engineVersion: engine.engineVersion,
  bet,
  paidRounds: N,
  engineRounds,
  freeSpinRounds,
  totalStake,
  totalPayout,
  rtp,
  rtpStandardError: returns.se,
  rtp95Interval: [rtp - 1.96 * returns.se, rtp + 1.96 * returns.se],
  standardDeviationPerPaidRound: returns.sd,
  maxReturnObserved: returns.max,
  hitFrequencyIncludingFeature: paidWinning / N,
  baseSpinHitFrequency: baseWinning / N,
  featureTriggerRate: featureTriggers / N,
  freeSpinsAwardedTotal,
  returnThresholds: thresholds.toJSON(),
  componentCredits: comp,
  componentRtp: Object.fromEntries(Object.entries(comp).map(([k, v]) => [k, v / totalStake])),
  maxCreditObserved: maxCredit,
  maxCascadesObserved: maxCascades,
  extra,
  invariantViolations,
  violations,
});
console.log(`${label}: RTP ${(rtp * 100).toFixed(3)}% (+-${(1.96 * returns.se * 100).toFixed(3)})  hit ${(paidWinning / N * 100).toFixed(2)}%  sd ${returns.sd.toFixed(2)}  max ${returns.max.toFixed(1)}x  violations ${invariantViolations}`);
