// Rule quirks measured exactly (what-if arithmetic only: nothing in the engines is changed).
//   node quirks.js
//
// Neon Overdrive: a payline made of Arc Reactors followed by another symbol is paid as that other symbol, even when the
// leading Reactors alone would pay more (for example Reactor Reactor Reactor Cell Chip pays 4 x Cell = 1.2x, while three
// Reactors on their own pay 5x). This measures how often that happens and what the "pay the better of the two" rule would
// have returned instead.
const { load, writeResult } = require('./common');

const cfg = load('neon-overdrive/neon-overdrive.config');
const { evaluateLines } = load('neon-overdrive/neon-overdrive.engine');
const { PAYLINES, PAYS, SYMBOL_ORDER, SYMBOL_WEIGHTS, TOTAL_SYMBOL_WEIGHT, REELS, ROWS } = cfg;

const N = SYMBOL_ORDER.length;
const prob = SYMBOL_WEIGHTS.map((w) => w / TOTAL_SYMBOL_WEIGHT);
let engineExpected = 0, betterExpected = 0, pQuirk = 0, shortfallWhenQuirk = 0;
for (let code = 0; code < N ** REELS; code++) {
  const seq = [];
  let c = code, p = 1;
  for (let i = 0; i < REELS; i++) { const s = c % N; c = Math.floor(c / N); seq.push(SYMBOL_ORDER[s]); p *= prob[s]; }
  const grid = Array.from({ length: REELS }, () => Array(ROWS).fill('cell'));
  for (let reel = 0; reel < REELS; reel++) grid[reel][PAYLINES[0][reel]] = seq[reel];
  const win = evaluateLines(grid).find((w) => w.line === 0);
  const enginePay = win ? win.multiplier : 0;
  let lead = 0;
  while (lead < REELS && seq[lead] === 'reactor') lead++;
  const reactorOnly = lead >= 3 ? PAYS.reactor[lead - 3] : 0;
  const better = Math.max(enginePay, reactorOnly);
  engineExpected += enginePay * p;
  betterExpected += better * p;
  if (better > enginePay) { pQuirk += p; shortfallWhenQuirk += (better - enginePay) * p; }
}
const lines = PAYLINES.length;
const out = {
  neonOverdrive: {
    perLineExpected: { asCoded: engineExpected, payTheBetterOfTheTwo: betterExpected },
    rtpAsCoded: undefined,
    rtpContributionOfTheRuleAcrossAllLines: lines * (betterExpected - engineExpected),
    probabilityPerLineThatTheRuleCostsThePlayer: pQuirk,
    probabilityPerSpinThatAtLeastOneLineIsAffectedApprox: 1 - (1 - pQuirk) ** lines,
    averageShortfallWhenAffected: shortfallWhenQuirk / pQuirk,
  },
};
writeResult('quirks', out);
console.log(JSON.stringify(out, null, 1));
