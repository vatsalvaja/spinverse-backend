const { load } = require('./common');
const { read, group, pct, mult, oneIn, sci, table, pool, zScore } = require('./report-lib');

module.exports = function pharaohDoc() {
  const cfg = load('pharaohs-fortune/pharaohs-fortune.config');
  const { evaluateLines } = load('pharaohs-fortune/pharaohs-fortune.engine');
  const ex = read('exact-pharaoh');
  const combos = read('pharaoh-combos');
  const mx = read('max-payouts').pharaoh;
  const names = ['pharaohs-fortune-bet50', ...'bcdefghijk'.split('').map((s) => `pharaohs-fortune-bet50-${s}`)];
  const sim = pool(names);
  const z = zScore(sim.rtp, ex.rtp.total, sim.se);
  const scatterChecks = ['a', 'b'].map((s) => read(`rng-scatter-check-${s}`));

  const W = cfg.SYMBOL_WEIGHTS, TW = W.reduce((a, b) => a + b, 0);
  const FW = cfg.FREE_SPIN_SYMBOL_WEIGHTS, FTW = FW.reduce((a, b) => a + b, 0);
  const sp = ex.symbolProbabilities;

  // ---- worked examples, scored by the REAL evaluator
  const exampleRows = [
    ['anubis', 'coin', 'jewel', 'temple', 'horus'],
    ['anubis', 'pharaoh', 'anubis', 'sphinx', 'coin'],
    ['coin', 'jewel', 'coin', 'temple', 'jewel'],
  ];
  const exWins = evaluateLines(exampleRows);
  const exTotal = exWins.reduce((s, w) => s + w.multiplier, 0);
  const wildRows = [
    ['sphinx', 'coin', 'jewel', 'temple', 'horus'],
    ['pharaoh', 'pharaoh', 'sphinx', 'pharaoh', 'coin'],
    ['coin', 'jewel', 'coin', 'temple', 'jewel'],
  ];
  const wildWins = evaluateLines(wildRows);
  const scarabStart = evaluateLines([
    ['coin', 'jewel', 'coin', 'temple', 'jewel'],
    ['scarab', 'anubis', 'anubis', 'anubis', 'anubis'],
    ['coin', 'jewel', 'coin', 'temple', 'jewel'],
  ]);
  const fourWildThenSymbol = evaluateLines([
    ['coin', 'jewel', 'coin', 'temple', 'jewel'],
    ['pharaoh', 'pharaoh', 'pharaoh', 'pharaoh', 'horus'],
    ['jewel', 'coin', 'temple', 'jewel', 'coin'],
  ]);
  const fourWildThenScarab = evaluateLines([
    ['coin', 'jewel', 'coin', 'temple', 'jewel'],
    ['pharaoh', 'pharaoh', 'pharaoh', 'pharaoh', 'scarab'],
    ['jewel', 'coin', 'temple', 'jewel', 'coin'],
  ]);
  const lineDesc = (wins) => (wins.length ? wins.map((w) => `line ${w.line + 1}: ${w.symbol} ×${w.count} = ${w.multiplier}×`).join('; ') : 'no win');

  const paidGroup = (symbolList, label) => {
    const rows = [3, 4, 5].map((c) => combos.rows.find((r) => r.symbol === symbolList[0] && r.count === c));
    return rows.map((r) => [label, `${r.count} in a row`, `${r.multiple}×`, pct(r.probability, 4), oneIn(r.probability), pct(r.rtpPerLine * 5, 3)]);
  };
  const jackpot = combos.rows.find((r) => r.symbol === 'pharaoh');

  const sc = ex.probabilities.scatterCount;
  const freq = (p) => (p > 0.5 ? 'more often than not' : oneIn(p));
  const tails = ex.distributionPerPaidSpin.atLeast;
  const free = ex.freeSpinLineMultiple;

  return `# Pharaoh's Fortune — mathematical report

> Source analysed: \`src/modules/game-engine/engines/pharaohs-fortune/pharaohs-fortune.engine.ts\` and \`pharaohs-fortune.config.ts\` (engine version ${ex.engineVersion}), plus the shared random stream \`engines/shared/rng.ts\`. Nothing was modified.
>
> **Method:** the return and every probability below are **exact** (computed by dynamic programming over the real configuration and cross-checked against the real line evaluator on all ${group(ex.validation.everyLineSequenceChecked)} symbol sequences of a payline). They are then compared with **${group(sim.paidRounds)} simulated paid spins** run through the real compiled engine.

## 1. Result at a glance

| | |
| --- | --- |
| **Theoretical RTP** | **${pct(ex.rtp.total, 3)}** |
| **House edge** | **${pct(ex.rtp.houseEdge, 3)}** |
| Simulated RTP (${group(sim.paidRounds)} paid spins, ${sim.runs.length} independent seed sets) | ${pct(sim.rtp, 3)} ± ${pct(1.96 * sim.se, 3)} (95% interval) — z = ${z.toFixed(2)} against theory |
| A paid spin pays something | ${pct(ex.probabilities.paidSpinPaysAnything, 2)} (${oneIn(ex.probabilities.paidSpinPaysAnything)}) |
| A payline wins on a spin | ${pct(ex.probabilities.anyLineWinOnPaidSpin, 2)} |
| Free spins triggered | ${pct(ex.probabilities.triggerFreeSpins, 3)} (${oneIn(ex.probabilities.triggerFreeSpins)}) |
| Standard deviation of one paid spin | ${ex.distributionPerPaidSpin.standardDeviation.toFixed(2)}× the bet |
| Largest possible payout | ${group(mx.maxMultipleOfBet)}× the bet (${group(mx.maxCredits)} credits at the top bet of ${mx.maxBet}) — practically unreachable |
| Does the code produce the RTP its design implies? | Yes: simulation agrees with the exact figure. The source states no target RTP; the figure follows from the weights marked ASSUMPTION in the config |

## 2. Rules and mechanics (as implemented)

- **Grid:** ${cfg.REELS} reels × ${cfg.ROWS} rows = 15 cells. **Paylines:** ${cfg.PAYLINES.length} fixed lines (middle, top, bottom, V, inverted V).
- **Bet:** one of ${cfg.BET_STEPS.join(', ')} credits (\`BET_STEPS\`). The **whole bet** is the stake; the paytable multiples are multiples of the **total bet** (not of a per-line bet). The 5 lines all pay on that same bet.
- **Symbols:** Pharaoh (wild), Golden Scarab (scatter), Anubis, Horus, Sphinx (high), Temple, Coin, Jewel (low).
- **Line wins** (\`evaluateLines\`): a line pays from the leftmost reel; the Pharaoh substitutes for every symbol except the Scarab; the line is paid as its **first non-Pharaoh symbol**; three, four or five matching symbols (wilds count) pay; a line that starts with a Scarab, or whose first non-Pharaoh symbol is a Scarab, pays nothing; five Pharaohs on a line pay the jackpot (${cfg.JACKPOT_MULTIPLIER}×). Wins on different lines add up. A line gives at most one result: it is paid as its first non-Pharaoh symbol with the length that symbol reaches (no separate 3-of-a-kind plus 4-of-a-kind).
- **Scatter:** Golden Scarabs anywhere on the 15 cells (no line needed): **3 = ${cfg.SCATTER_REWARDS[3].multiplier}× bet + ${cfg.SCATTER_REWARDS[3].freeSpins} free spins**; **4 or more = ${cfg.SCATTER_REWARDS[4].multiplier}× bet + ${cfg.SCATTER_REWARDS[4].freeSpins} free spins**.
- **Free spins:** cost nothing, use the bet that triggered them, **cannot be re-triggered**, and never contain a Scarab (the free-spin weights set Scarab to 0). They pay line wins only.
- **Settlement:** every spin (paid or free) is one round, settled immediately. Credit paid = line payout + scatter prize, all whole credits (paytable multiples and bets are integers, so there is no rounding).

### Paytable (multiples of the total bet)

${table(['Symbol', '3 in a row', '4 in a row', '5 in a row'], Object.entries(cfg.PAYTABLE).map(([s, p]) => [s, `${p[0]}×`, `${p[1]}×`, `${p[2]}×`]), 'lrrr')}

Five Pharaohs on a line: **${cfg.JACKPOT_MULTIPLIER}×**. Scatter: see above.

## 3. How the random numbers produce an outcome

1. The server creates a fresh 256-bit seed per round from the operating system's secure random source and shows its SHA-256 commitment. The stream is HMAC-SHA256 in counter mode keyed by that seed (\`engines/shared/rng.ts\`).
2. The engine draws **15 cells, row by row**, each with \`rng.weighted(weights)\`: one unbiased integer in [0, total weight) (rejection sampling, no modulo bias) mapped to a symbol. Cells are **independent**.
3. Everything else (lines, scatter, free-spin bookkeeping) is deterministic arithmetic on those 15 symbols. The draw never reads the bet; the bet only multiplies the result afterwards.

Symbol probabilities per cell (weights ${cfg.SYMBOL_ORDER.map((s, i) => `${s} ${W[i]}`).join(', ')}; total ${TW}):

${table(['Symbol', 'Weight', 'Paid spin (÷' + TW + ')', 'Free spin (÷' + FTW + ')'], cfg.SYMBOL_ORDER.map((s, i) => [s, String(W[i]), pct(W[i] / TW, 3), FW[i] ? pct(FW[i] / FTW, 3) : '0 (never appears)']), 'lrrr')}

> The weights are marked **ASSUMPTION** in the source (the original game plays a scripted demo, so it defines no symbol frequencies). They are the single input that sets the RTP.

## 4. Winning and losing probabilities

**One payline** (5 independent cells; exact):

${table(['Symbol', 'Combination', 'Pays', 'Probability on one line', 'Frequency', 'RTP contribution (all 5 lines)'],
  [
    ...paidGroup(['anubis'], 'Anubis, Horus, Sphinx (each)'),
    ...paidGroup(['temple'], 'Temple, Coin, Jewel (each)'),
    ['Pharaoh', '5 Pharaohs', `${jackpot.multiple}×`, sci(jackpot.probability), oneIn(jackpot.probability), pct(jackpot.rtpPerLine * 5, 5)],
  ], 'llrrrr')}

"3 in a row" means **exactly** three from the left (the fourth cell breaks the line), and includes lines completed with Pharaohs. A line wins with probability **${pct(combos.probabilityWinOnALine, 3)}**; the expected pay of one line is **${combos.expectedMultiplePerLine.toFixed(5)}× the bet** (×5 lines = ${(combos.expectedMultiplePerLine * 5).toFixed(5)}×, the base-game line RTP).

**Whole spin** (all 5 lines, scatter; exact):

${table(['Event on a paid spin', 'Probability', 'Frequency'], [
  ['At least one payline wins', pct(ex.probabilities.anyLineWinOnPaidSpin, 3), oneIn(ex.probabilities.anyLineWinOnPaidSpin)],
  ['0 Scarabs', pct(sc['0'], 3), freq(sc['0'])],
  ['1 Scarab', pct(sc['1'], 3), oneIn(sc['1'])],
  ['2 Scarabs (no prize — a near miss)', pct(sc['2'], 3), oneIn(sc['2'])],
  ['**3 Scarabs** (5× + 10 free spins)', pct(sc['3'], 4), oneIn(sc['3'])],
  ['**4 or more Scarabs** (20× + 15 free spins)', pct(ex.probabilities.atLeast4Scarabs, 4), oneIn(ex.probabilities.atLeast4Scarabs)],
  ['Free spins triggered', pct(ex.probabilities.triggerFreeSpins, 4), oneIn(ex.probabilities.triggerFreeSpins)],
  ['The spin pays anything (lines or scatter)', pct(ex.probabilities.paidSpinPaysAnything, 3), oneIn(ex.probabilities.paidSpinPaysAnything)],
  ['The spin pays nothing', pct(1 - ex.probabilities.paidSpinPaysAnything, 3), freq(1 - ex.probabilities.paidSpinPaysAnything)],
], 'lrr')}

A free spin, for comparison, has weights ${FTW} in total (no Scarab), so each cell is slightly more likely to be a paying symbol or the wild: one free spin returns on average **${free.mean.toFixed(4)}× the bet in line wins** (against ${(combos.expectedMultiplePerLine * 5).toFixed(4)}× for a paid spin's lines).

## 5. Payout calculation with practical examples

*Credit paid = (sum of the multiples of every winning line × bet) + (scatter multiple × bet).* All examples below were scored by the **real engine evaluator**.

**Example 1 — a wild completes a line (bet 50).** Middle row: Anubis, Pharaoh, Anubis, Sphinx, Coin. Result: ${lineDesc(exWins)}. Pays ${exTotal}× × 50 = **${group(exTotal * 50)} credits**.

**Example 2 — the line takes its first non-wild symbol (bet 100).** Middle row: Pharaoh, Pharaoh, Sphinx, Pharaoh, Coin. Result: ${lineDesc(wildWins)}. The first non-Pharaoh symbol is the Sphinx, the Pharaohs count as Sphinx, the Coin ends the line: Sphinx ×4 = 12× → **${group(wildWins.reduce((s, w) => s + w.multiplier, 0) * 100)} credits**.

**Example 3 — a Scarab at the start kills the line.** Middle row: Scarab, Anubis, Anubis, Anubis, Anubis. Result: ${lineDesc(scarabStart)} (even though four Anubis follow).

**Example 4 — four wilds then a symbol pays as five of that symbol (bet 50).** Pharaoh ×4 then Horus: ${lineDesc(fourWildThenSymbol)}. Horus ×5 = 40× → **${group(40 * 50)} credits**. **But** Pharaoh ×4 then a Scarab: ${lineDesc(fourWildThenScarab)} — the four wilds pay nothing because the line's first non-wild symbol is the Scarab.

**Example 5 — scatter (bet 100).** Three Scarabs anywhere: 5 × 100 = **500 credits immediately** plus 10 free spins at a bet of 100 (free). On average each free spin returns ${free.mean.toFixed(3)}× the bet, so a 3-Scarab trigger is worth on average **${(5 + 10 * free.mean).toFixed(2)}× the bet** (${group((5 + 10 * free.mean) * 100, 0)} credits at bet 100). Four or more Scarabs are worth **${(20 + 15 * free.mean).toFixed(2)}× the bet** on average.

**Example 6 — jackpot (bet 50).** Five Pharaohs on one line: ${cfg.JACKPOT_MULTIPLIER} × 50 = **${group(cfg.JACKPOT_MULTIPLIER * 50)} credits** (one in ${group(Math.round(1 / jackpot.probability))} lines, so about 1 in ${group(Math.round(1 / (ex.distributionPerPaidSpin.atLeast['>=1000x'])))} spins).

## 6. Theoretical RTP and house edge (exact)

${table(['Component', 'Share of the bet returned'], [
  ['Line wins in paid spins', pct(ex.rtp.baseLines, 3)],
  ['Scatter prize (5× / 20×)', pct(ex.rtp.scatterPrize, 3)],
  ['Free spins (lines only)', pct(ex.rtp.freeSpinsFeature, 3)],
  ['**Total RTP**', `**${pct(ex.rtp.total, 3)}**`],
  ['**House edge**', `**${pct(ex.rtp.houseEdge, 3)}**`],
], 'lr')}

How it is derived: a payline's pay is a function of 5 independent cells, so the expected line multiple is a sum over the ${group(8 ** 5)} sequences (${combos.expectedMultiplePerLine.toFixed(6)}×); ×5 lines = ${ex.rtp.baseLines.toFixed(6)}. The scatter prize is ${cfg.SCATTER_REWARDS[3].multiplier}×P(3 Scarabs) + ${cfg.SCATTER_REWARDS[4].multiplier}×P(≥4) = ${ex.rtp.scatterPrize.toFixed(6)}. The feature adds (P(3)×10 + P(≥4)×15) × ${free.mean.toFixed(6)} = ${ex.rtp.freeSpinsFeature.toFixed(6)}. The joint distribution over the five (overlapping) lines was propagated reel by reel to obtain the full payout distribution (section 7), and its mean (${ex.rtp.checkFromDistribution.toFixed(9)}) equals the sum above.

The jackpot is a negligible part of the RTP: ${cfg.JACKPOT_MULTIPLIER} × ${sci(jackpot.probability)} × 5 lines = **${pct(jackpot.rtpPerLine * 5, 5)}**.

## 7. Volatility and payout distribution

${table(['Payout of one paid spin (feature included) at least…', 'Probability', 'Frequency'], [1, 5, 10, 25, 50, 100, 250, 1000].map((x) => [`${x}× the bet`, tails[`>=${x}x`] >= 1e-4 ? pct(tails[`>=${x}x`], 3) : sci(tails[`>=${x}x`]), oneIn(tails[`>=${x}x`])]), 'lrr')}

- Payouts of 250× and 1000× have almost the same probability (they differ only in the twelfth decimal): in practice the only way to reach 250× or more is the 1000× jackpot line, because the next largest single-line prize is 40× and even a 15-free-spin bonus almost never passes 100×.
- Standard deviation of one paid spin: **${ex.distributionPerPaidSpin.standardDeviation.toFixed(3)}× the bet** (simulation: ${sim.sd.toFixed(3)}).
- Hit frequency ${pct(ex.probabilities.paidSpinPaysAnything, 1)}: most spins lose; most wins are small (2×–5×).
- **Classification: medium-high volatility** (convention used across these reports: standard deviation per round of 2–5× the stake = medium, over 5× = high). Variance comes from the scatter/free-spin feature (about ${pct((ex.rtp.scatterPrize + ex.rtp.freeSpinsFeature) / ex.rtp.total, 0)} of the return arrives in ${pct(ex.probabilities.triggerFreeSpins, 1)} of spins) and the 40×/15× five-of-a-kind lines.

## 8. Maximum possible payout

| Quantity | Value |
| --- | --- |
| All 15 cells Pharaoh (base spin, no scatter) | ${group(mx.allFifteenPharaohsLineMultiple)}× the bet (5 lines × ${cfg.JACKPOT_MULTIPLIER}×) |
| Best base spin that also triggers 15 free spins (4 Scarabs) | ${group(mx.bestBaseLineMultipleWith4Scarabs)}× lines + 20× scatter |
| **Largest total for one paid spin** (4 Scarabs, then 15 free spins that each show 15 Pharaohs) | **${group(mx.maxMultipleOfBet)}× the bet** = **${group(mx.maxCredits)} credits** at bet ${mx.maxBet} |
| Probability of that outcome | below 1 in 10^300 (15 free spins × 15 cells all Pharaoh, each cell ${pct(FW[0] / FTW, 2)}) — effectively zero |
| Largest payout in ${group(sim.paidRounds)} simulated paid spins | ${sim.maxReturn.toFixed(0)}× the bet |
| Probability a paid spin pays ≥ ${cfg.JACKPOT_MULTIPLIER}× | ${sci(tails['>=1000x'])} (${oneIn(tails['>=1000x'])}) |

There is **no win cap** in the code. The nominal maximum is huge but the realistic top prize is the single 1000× jackpot line, which is about one spin in 175 million.

## 9. Configurable parameters (all in \`pharaohs-fortune.config.ts\`)

| Parameter | Effect |
| --- | --- |
| \`SYMBOL_WEIGHTS\` (ASSUMPTION) | Probability of every symbol on paid spins; the main RTP lever. Raising the wild or a high symbol raises line wins; raising the Scarab raises scatter/free-spin frequency |
| \`FREE_SPIN_SYMBOL_WEIGHTS\` | Same for free spins (derived from the above with Scarab = 0) |
| \`PAYTABLE\`, \`JACKPOT_MULTIPLIER\` | Line payouts (linear effect on that part of the RTP) |
| \`SCATTER_REWARDS\` | Scatter multiple and number of free spins (linear on the scatter and feature parts) |
| \`PAYLINES\` | Which cells form lines (changes correlation and, if lines are added, the RTP) |
| \`BET_STEPS\` | Allowed bets; RTP does not depend on the bet (all payouts are whole numbers) |
| \`WIN_LEVELS\` | Display labels only; no effect on payouts |

Changing any of these changes the RTP, so the engine version string must be bumped (the source says so).

## 10. Simulation against theory (${group(sim.paidRounds)} paid spins through the real engine)

${table(['Seed set', 'Paid spins', 'RTP', '± 95%'], sim.runs.map((r, i) => [String(i + 1), group(r.paidRounds), pct(r.rtp, 3), pct(1.96 * r.rtpStandardError, 3)]).concat([['**All pooled**', `**${group(sim.paidRounds)}**`, `**${pct(sim.rtp, 3)}**`, `**${pct(1.96 * sim.se, 3)}**`], ['**Exact (theory)**', '', `**${pct(ex.rtp.total, 3)}**`, '']]), 'lrrr')}

| Quantity | Exact | Simulated (pooled) |
| --- | --- | --- |
| RTP | ${pct(ex.rtp.total, 3)} | ${pct(sim.rtp, 3)} |
| Line wins, paid spins | ${pct(ex.rtp.baseLines, 3)} | ${pct(sim.comps.baseLines, 3)} |
| Scatter prize | ${pct(ex.rtp.scatterPrize, 3)} | ${pct(sim.comps.scatterPrize, 3)} |
| Free-spin lines | ${pct(ex.rtp.freeSpinsFeature, 3)} | ${pct(sim.comps.freeSpinLines, 3)} |
| Free spins triggered | ${pct(ex.probabilities.triggerFreeSpins, 3)} | ${pct(sim.trigger, 3)} |
| Spin pays anything | ${pct(ex.probabilities.paidSpinPaysAnything, 2)} | ${pct(sim.hit, 2)} |
| Standard deviation | ${ex.distributionPerPaidSpin.standardDeviation.toFixed(3)} | ${sim.sd.toFixed(3)} |

Note on sampling: with a standard deviation of ${sim.sd.toFixed(1)}× per spin, one million spins give an RTP only to about ±0.67 points, which is why several seed sets are pooled. The first three seed sets happened to land ~0.5 points high; the later eight did not, and the pooled result agrees with theory (z = ${z.toFixed(2)}). As a separate check on the random draw behind the scatter (no game code involved), ${group(scatterChecks.reduce((s, c) => s + c.grids, 0))} grids of 15 weighted cells were drawn with the same \`SeededRng.weighted\` call: ${group(scatterChecks.reduce((s, c) => s + c.triggerCount, 0))} grids had 3 or more Scarabs against ${group(Math.round(scatterChecks.reduce((s, c) => s + c.expectedTriggers, 0)))} expected (z = ${((scatterChecks.reduce((s, c) => s + c.triggerCount - c.expectedTriggers, 0)) / Math.sqrt(scatterChecks.reduce((s, c) => s + c.expectedTriggers, 0))).toFixed(2)}). Invariant checks ran on every simulated round (credit equals line payout plus scatter prize; whole credits; free spins never negative): **${sim.violations} violations**.

## 11. Findings

- **Payout calculation bugs: none found.** The credit paid always equals line payout + scatter prize in every one of ${group(sim.paidRounds)} simulated rounds plus their free spins, and the line evaluator matches an independent state machine on every possible line.
- **Expected RTP:** ${pct(ex.rtp.total, 2)} (house edge ${pct(ex.rtp.houseEdge, 2)}). It is the exact consequence of the assumed weights; the source gives no target. (No comparison with the other games is made in this report.)
- **Rule note (not a bug):** Pharaoh ×4 + Scarab pays nothing, while Pharaoh ×4 + any paying symbol pays five-of-a-kind. This follows the stated rule "a line whose first non-wild symbol is a Scarab pays nothing".
- **Payout exposure:** the nominal maximum (${group(mx.maxMultipleOfBet)}× bet = ${group(mx.maxCredits)} credits) is large on paper, but its probability is zero for all practical purposes; the realistic worst case is a ${cfg.JACKPOT_MULTIPLIER}× line (${group(cfg.JACKPOT_MULTIPLIER * Math.max(...cfg.BET_STEPS))} credits at bet ${Math.max(...cfg.BET_STEPS)}), once in ~175 million spins. **Not unusual in practice.**
- **Server-authoritative:** yes. The client sends only the bet amount (validated against \`BET_STEPS\`); the symbols come from a server-side seed; free spins are carried in server session state (\`freeSpinsLeft\`, \`freeBet\`), never supplied by the client. In \`game-rounds.service.ts\` the seed is made by \`createRoundSeed()\` (OS secure random) and the result is written to the round together with the wallet debit and credit; no endpoint accepts a result or a payout. (Only this game's path was reviewed; a general review of the other games and of the random stream is outside this report.)

## 12. Reproduce

\`\`\`bash
npm run build                               # writes dist/ only
cd docs/game-mathematics/tools
node exact-pharaoh.js                       # exact RTP, distribution (about 1 minute)
node pharaoh-combos.js                      # one-line combination table
node max-payouts.js                         # maximum payout
SEED_SALT=b node sim-slots.js pharaohs-fortune 50 1000000   # one million paid spins (change SEED_SALT for another seed set)
\`\`\`
`;
};
