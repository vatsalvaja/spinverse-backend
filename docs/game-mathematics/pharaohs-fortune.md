# Pharaoh's Fortune — mathematical report

> Source analysed: `src/modules/game-engine/engines/pharaohs-fortune/pharaohs-fortune.engine.ts` and `pharaohs-fortune.config.ts` (engine version 1.0.0), plus the shared random stream `engines/shared/rng.ts`. Nothing was modified.
>
> **Method:** the return and every probability below are **exact** (computed by dynamic programming over the real configuration and cross-checked against the real line evaluator on all 32,768 symbol sequences of a payline). They are then compared with **11,000,000 simulated paid spins** run through the real compiled engine.

## 1. Result at a glance

| | |
| --- | --- |
| **Theoretical RTP** | **88.781%** |
| **House edge** | **11.219%** |
| Simulated RTP (11,000,000 paid spins, 11 independent seed sets) | 88.895% ± 0.200% (95% interval) — z = 1.11 against theory |
| A paid spin pays something | 15.76% (1 in 6) |
| A payline wins on a spin | 14.75% |
| Free spins triggered | 1.093% (1 in 91) |
| Standard deviation of one paid spin | 3.39× the bet |
| Largest possible payout | 78,020× the bet (39,010,000 credits at the top bet of 500) — practically unreachable |
| Does the code produce the RTP its design implies? | Yes: simulation agrees with the exact figure. The source states no target RTP; the figure follows from the weights marked ASSUMPTION in the config |

## 2. Rules and mechanics (as implemented)

- **Grid:** 5 reels × 3 rows = 15 cells. **Paylines:** 5 fixed lines (middle, top, bottom, V, inverted V).
- **Bet:** one of 10, 20, 50, 100, 250, 500 credits (`BET_STEPS`). The **whole bet** is the stake; the paytable multiples are multiples of the **total bet** (not of a per-line bet). The 5 lines all pay on that same bet.
- **Symbols:** Pharaoh (wild), Golden Scarab (scatter), Anubis, Horus, Sphinx (high), Temple, Coin, Jewel (low).
- **Line wins** (`evaluateLines`): a line pays from the leftmost reel; the Pharaoh substitutes for every symbol except the Scarab; the line is paid as its **first non-Pharaoh symbol**; three, four or five matching symbols (wilds count) pay; a line that starts with a Scarab, or whose first non-Pharaoh symbol is a Scarab, pays nothing; five Pharaohs on a line pay the jackpot (1000×). Wins on different lines add up. A line gives at most one result: it is paid as its first non-Pharaoh symbol with the length that symbol reaches (no separate 3-of-a-kind plus 4-of-a-kind).
- **Scatter:** Golden Scarabs anywhere on the 15 cells (no line needed): **3 = 5× bet + 10 free spins**; **4 or more = 20× bet + 15 free spins**.
- **Free spins:** cost nothing, use the bet that triggered them, **cannot be re-triggered**, and never contain a Scarab (the free-spin weights set Scarab to 0). They pay line wins only.
- **Settlement:** every spin (paid or free) is one round, settled immediately. Credit paid = line payout + scatter prize, all whole credits (paytable multiples and bets are integers, so there is no rounding).

### Paytable (multiples of the total bet)

| Symbol | 3 in a row | 4 in a row | 5 in a row |
| --- | ---: | ---: | ---: |
| anubis | 4× | 12× | 40× |
| horus | 4× | 12× | 40× |
| sphinx | 4× | 12× | 40× |
| temple | 2× | 5× | 15× |
| coin | 2× | 5× | 15× |
| jewel | 2× | 5× | 15× |

Five Pharaohs on a line: **1000×**. Scatter: see above.

## 3. How the random numbers produce an outcome

1. The server creates a fresh 256-bit seed per round from the operating system's secure random source and shows its SHA-256 commitment. The stream is HMAC-SHA256 in counter mode keyed by that seed (`engines/shared/rng.ts`).
2. The engine draws **15 cells, row by row**, each with `rng.weighted(weights)`: one unbiased integer in [0, total weight) (rejection sampling, no modulo bias) mapped to a symbol. Cells are **independent**.
3. Everything else (lines, scatter, free-spin bookkeeping) is deterministic arithmetic on those 15 symbols. The draw never reads the bet; the bet only multiplies the result afterwards.

Symbol probabilities per cell (weights pharaoh 1, scarab 2, anubis 10, horus 10, sphinx 10, temple 10, coin 10, jewel 10; total 63):

| Symbol | Weight | Paid spin (÷63) | Free spin (÷61) |
| --- | ---: | ---: | ---: |
| pharaoh | 1 | 1.587% | 1.639% |
| scarab | 2 | 3.175% | 0 (never appears) |
| anubis | 10 | 15.873% | 16.393% |
| horus | 10 | 15.873% | 16.393% |
| sphinx | 10 | 15.873% | 16.393% |
| temple | 10 | 15.873% | 16.393% |
| coin | 10 | 15.873% | 16.393% |
| jewel | 10 | 15.873% | 16.393% |

> The weights are marked **ASSUMPTION** in the source (the original game plays a scripted demo, so it defines no symbol frequencies). They are the single input that sets the RTP.

## 4. Winning and losing probabilities

**One payline** (5 independent cells; exact):

| Symbol | Combination | Pays | Probability on one line | Frequency | RTP contribution (all 5 lines) |
| --- | --- | ---: | ---: | ---: | ---: |
| Anubis, Horus, Sphinx (each) | 3 in a row | 4× | 0.4390% | 1 in 228 | 8.781% |
| Anubis, Horus, Sphinx (each) | 4 in a row | 12× | 0.0767% | 1 in 1,304 | 4.602% |
| Anubis, Horus, Sphinx (each) | 5 in a row | 40× | 0.0162% | 1 in 6,162 | 3.246% |
| Temple, Coin, Jewel (each) | 3 in a row | 2× | 0.4390% | 1 in 228 | 4.390% |
| Temple, Coin, Jewel (each) | 4 in a row | 5× | 0.0767% | 1 in 1,304 | 1.918% |
| Temple, Coin, Jewel (each) | 5 in a row | 15× | 0.0162% | 1 in 6,162 | 1.217% |
| Pharaoh | 5 Pharaohs | 1000× | 1.01e-9 | 1 in 992,436,543 | 0.00050% |

"3 in a row" means **exactly** three from the left (the fourth cell breaks the line), and includes lines completed with Pharaohs. A line wins with probability **3.192%**; the expected pay of one line is **0.14492× the bet** (×5 lines = 0.72462×, the base-game line RTP).

**Whole spin** (all 5 lines, scatter; exact):

| Event on a paid spin | Probability | Frequency |
| --- | ---: | ---: |
| At least one payline wins | 14.752% | 1 in 7 |
| 0 Scarabs | 61.637% | more often than not |
| 1 Scarab | 30.313% | 1 in 3 |
| 2 Scarabs (no prize — a near miss) | 6.957% | 1 in 14 |
| **3 Scarabs** (5× + 10 free spins) | 0.9884% | 1 in 101 |
| **4 or more Scarabs** (20× + 15 free spins) | 0.1046% | 1 in 956 |
| Free spins triggered | 1.0931% | 1 in 91 |
| The spin pays anything (lines or scatter) | 15.758% | 1 in 6 |
| The spin pays nothing | 84.242% | more often than not |

A free spin, for comparison, has weights 61 in total (no Scarab), so each cell is slightly more likely to be a paying symbol or the wild: one free spin returns on average **0.8106× the bet in line wins** (against 0.7246× for a paid spin's lines).

## 5. Payout calculation with practical examples

*Credit paid = (sum of the multiples of every winning line × bet) + (scatter multiple × bet).* All examples below were scored by the **real engine evaluator**.

**Example 1 — a wild completes a line (bet 50).** Middle row: Anubis, Pharaoh, Anubis, Sphinx, Coin. Result: line 1: anubis ×3 = 4×. Pays 4× × 50 = **200 credits**.

**Example 2 — the line takes its first non-wild symbol (bet 100).** Middle row: Pharaoh, Pharaoh, Sphinx, Pharaoh, Coin. Result: line 1: sphinx ×4 = 12×. The first non-Pharaoh symbol is the Sphinx, the Pharaohs count as Sphinx, the Coin ends the line: Sphinx ×4 = 12× → **1,200 credits**.

**Example 3 — a Scarab at the start kills the line.** Middle row: Scarab, Anubis, Anubis, Anubis, Anubis. Result: no win (even though four Anubis follow).

**Example 4 — four wilds then a symbol pays as five of that symbol (bet 50).** Pharaoh ×4 then Horus: line 1: horus ×5 = 40×. Horus ×5 = 40× → **2,000 credits**. **But** Pharaoh ×4 then a Scarab: no win — the four wilds pay nothing because the line's first non-wild symbol is the Scarab.

**Example 5 — scatter (bet 100).** Three Scarabs anywhere: 5 × 100 = **500 credits immediately** plus 10 free spins at a bet of 100 (free). On average each free spin returns 0.811× the bet, so a 3-Scarab trigger is worth on average **13.11× the bet** (1,311 credits at bet 100). Four or more Scarabs are worth **32.16× the bet** on average.

**Example 6 — jackpot (bet 50).** Five Pharaohs on one line: 1000 × 50 = **50,000 credits** (one in 992,436,543 lines, so about 1 in 174,942,750 spins).

## 6. Theoretical RTP and house edge (exact)

| Component | Share of the bet returned |
| --- | ---: |
| Line wins in paid spins | 72.462% |
| Scatter prize (5× / 20×) | 7.035% |
| Free spins (lines only) | 9.284% |
| **Total RTP** | **88.781%** |
| **House edge** | **11.219%** |

How it is derived: a payline's pay is a function of 5 independent cells, so the expected line multiple is a sum over the 32,768 sequences (0.144923×); ×5 lines = 0.724615. The scatter prize is 5×P(3 Scarabs) + 20×P(≥4) = 0.070349. The feature adds (P(3)×10 + P(≥4)×15) × 0.810584 = 0.092844. The joint distribution over the five (overlapping) lines was propagated reel by reel to obtain the full payout distribution (section 7), and its mean (0.887808892) equals the sum above.

The jackpot is a negligible part of the RTP: 1000 × 1.01e-9 × 5 lines = **0.00050%**.

## 7. Volatility and payout distribution

| Payout of one paid spin (feature included) at least… | Probability | Frequency |
| --- | ---: | ---: |
| 1× the bet | 15.758% | 1 in 6 |
| 5× the bet | 4.310% | 1 in 23 |
| 10× the bet | 2.296% | 1 in 44 |
| 25× the bet | 0.413% | 1 in 242 |
| 50× the bet | 0.034% | 1 in 2,924 |
| 100× the bet | 2.73e-6 | 1 in 366,056 |
| 250× the bet | 5.72e-9 | 1 in 174,909,009 |
| 1000× the bet | 5.72e-9 | 1 in 174,942,750 |

- Payouts of 250× and 1000× have almost the same probability (they differ only in the twelfth decimal): in practice the only way to reach 250× or more is the 1000× jackpot line, because the next largest single-line prize is 40× and even a 15-free-spin bonus almost never passes 100×.
- Standard deviation of one paid spin: **3.390× the bet** (simulation: 3.392).
- Hit frequency 15.8%: most spins lose; most wins are small (2×–5×).
- **Classification: medium-high volatility** (convention used across these reports: standard deviation per round of 2–5× the stake = medium, over 5× = high). Variance comes from the scatter/free-spin feature (about 18% of the return arrives in 1.1% of spins) and the 40×/15× five-of-a-kind lines.

## 8. Maximum possible payout

| Quantity | Value |
| --- | --- |
| All 15 cells Pharaoh (base spin, no scatter) | 5,000× the bet (5 lines × 1000×) |
| Best base spin that also triggers 15 free spins (4 Scarabs) | 3,000× lines + 20× scatter |
| **Largest total for one paid spin** (4 Scarabs, then 15 free spins that each show 15 Pharaohs) | **78,020× the bet** = **39,010,000 credits** at bet 500 |
| Probability of that outcome | below 1 in 10^300 (15 free spins × 15 cells all Pharaoh, each cell 1.64%) — effectively zero |
| Largest payout in 11,000,000 simulated paid spins | 142× the bet |
| Probability a paid spin pays ≥ 1000× | 5.72e-9 (1 in 174,942,750) |

There is **no win cap** in the code. The nominal maximum is huge but the realistic top prize is the single 1000× jackpot line, which is about one spin in 175 million.

## 9. Configurable parameters (all in `pharaohs-fortune.config.ts`)

| Parameter | Effect |
| --- | --- |
| `SYMBOL_WEIGHTS` (ASSUMPTION) | Probability of every symbol on paid spins; the main RTP lever. Raising the wild or a high symbol raises line wins; raising the Scarab raises scatter/free-spin frequency |
| `FREE_SPIN_SYMBOL_WEIGHTS` | Same for free spins (derived from the above with Scarab = 0) |
| `PAYTABLE`, `JACKPOT_MULTIPLIER` | Line payouts (linear effect on that part of the RTP) |
| `SCATTER_REWARDS` | Scatter multiple and number of free spins (linear on the scatter and feature parts) |
| `PAYLINES` | Which cells form lines (changes correlation and, if lines are added, the RTP) |
| `BET_STEPS` | Allowed bets; RTP does not depend on the bet (all payouts are whole numbers) |
| `WIN_LEVELS` | Display labels only; no effect on payouts |

Changing any of these changes the RTP, so the engine version string must be bumped (the source says so).

## 10. Simulation against theory (11,000,000 paid spins through the real engine)

| Seed set | Paid spins | RTP | ± 95% |
| --- | ---: | ---: | ---: |
| 1 | 1,000,000 | 89.346% | 0.665% |
| 2 | 1,000,000 | 89.048% | 0.664% |
| 3 | 1,000,000 | 89.487% | 0.669% |
| 4 | 1,000,000 | 89.032% | 0.666% |
| 5 | 1,000,000 | 89.081% | 0.667% |
| 6 | 1,000,000 | 88.570% | 0.665% |
| 7 | 1,000,000 | 89.060% | 0.670% |
| 8 | 1,000,000 | 88.886% | 0.666% |
| 9 | 1,000,000 | 88.522% | 0.662% |
| 10 | 1,000,000 | 88.444% | 0.661% |
| 11 | 1,000,000 | 88.368% | 0.659% |
| **All pooled** | **11,000,000** | **88.895%** | **0.200%** |
| **Exact (theory)** |  | **88.781%** |  |

| Quantity | Exact | Simulated (pooled) |
| --- | --- | --- |
| RTP | 88.781% | 88.895% |
| Line wins, paid spins | 72.462% | 72.488% |
| Scatter prize | 7.035% | 7.067% |
| Free-spin lines | 9.284% | 9.339% |
| Free spins triggered | 1.093% | 1.099% |
| Spin pays anything | 15.76% | 15.78% |
| Standard deviation | 3.390 | 3.392 |

Note on sampling: with a standard deviation of 3.4× per spin, one million spins give an RTP only to about ±0.67 points, which is why several seed sets are pooled. The first three seed sets happened to land ~0.5 points high; the later eight did not, and the pooled result agrees with theory (z = 1.11). As a separate check on the random draw behind the scatter (no game code involved), 10,000,000 grids of 15 weighted cells were drawn with the same `SeededRng.weighted` call: 108,962 grids had 3 or more Scarabs against 109,308 expected (z = -1.05). Invariant checks ran on every simulated round (credit equals line payout plus scatter prize; whole credits; free spins never negative): **0 violations**.

## 11. Findings

- **Payout calculation bugs: none found.** The credit paid always equals line payout + scatter prize in every one of 11,000,000 simulated rounds plus their free spins, and the line evaluator matches an independent state machine on every possible line.
- **Expected RTP:** 88.78% (house edge 11.22%). It is the exact consequence of the assumed weights; the source gives no target. (No comparison with the other games is made in this report.)
- **Rule note (not a bug):** Pharaoh ×4 + Scarab pays nothing, while Pharaoh ×4 + any paying symbol pays five-of-a-kind. This follows the stated rule "a line whose first non-wild symbol is a Scarab pays nothing".
- **Payout exposure:** the nominal maximum (78,020× bet = 39,010,000 credits) is large on paper, but its probability is zero for all practical purposes; the realistic worst case is a 1000× line (500,000 credits at bet 500), once in ~175 million spins. **Not unusual in practice.**
- **Server-authoritative:** yes. The client sends only the bet amount (validated against `BET_STEPS`); the symbols come from a server-side seed; free spins are carried in server session state (`freeSpinsLeft`, `freeBet`), never supplied by the client. In `game-rounds.service.ts` the seed is made by `createRoundSeed()` (OS secure random) and the result is written to the round together with the wallet debit and credit; no endpoint accepts a result or a payout. (Only this game's path was reviewed; a general review of the other games and of the random stream is outside this report.)

## 12. Reproduce

```bash
npm run build                               # writes dist/ only
cd docs/game-mathematics/tools
node exact-pharaoh.js                       # exact RTP, distribution (about 1 minute)
node pharaoh-combos.js                      # one-line combination table
node max-payouts.js                         # maximum payout
SEED_SALT=b node sim-slots.js pharaohs-fortune 50 1000000   # one million paid spins (change SEED_SALT for another seed set)
```
