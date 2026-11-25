# Atlantis Cascade

A sunken-city game where wins vanish and new symbols tumble in, so one spin can turn into a chain of wins. Free demo credits only.

> **Bottom line:** with the assumptions below (see [What is assumed](#8-what-is-taken-from-the-existing-game-and-what-is-assumed)), the game returns about **96.7%** of every bet on average (measured: 96.70%, margin of error ±0.40 points), and **55%** of spins pay something. The return is extremely sensitive to one assumption, so please read section 8.

---

## 1. How the game works

The board is **6 columns × 5 rows = 30 cells**. There are no paylines. Instead you win with **clusters**: groups of **5 or more identical symbols that touch each other** (up, down, left or right; diagonals do not count).

| Symbol | Role |
| --- | --- |
| Pearl, Trident, Crown, Eye, Amphora, Conch, Crystal, Scale | The eight paying symbols (Pearl is the most valuable, Scale the least) |
| **Wild** | Counts as any paying symbol. It can join a cluster of any of them. |
| **Scatter** (heart) | Pays nothing by itself. **4 or more** on the first board start free spins. |

You choose a **bet** of 10, 25, 50, 100, 250, 500 or 1000 demo credits.

## 2. How a round starts and ends

**Start.** You pick a bet. The server checks it and takes it from your balance.

**The round.**
1. A first board of 30 symbols is drawn.
2. Every winning cluster is paid, then **removed**.
3. The symbols above drop down to fill the gaps and **new symbols fall in** from the top.
4. If the new board has winning clusters, they pay as well (with a higher multiplier) and the process repeats. This is called a **cascade**.
5. It stops when a board has no cluster of 5 or more.

**End.** The server pays the total of all clusters and reports the whole sequence (the first board, every cascade, every refill) so the screen can replay it. The round is already finished by then.

## 3. How winning and losing are decided

### What counts as a cluster

- 5 or more cells holding the same paying symbol that are connected through their neighbours above, below, left or right.
- A **Wild** counts as that symbol, so it can join and connect clusters of any symbol.
- The server checks the symbols from the **most valuable** (Pearl) down to the least (Scale). A Wild that is used by a cluster belongs to that cluster only; a Wild that did not end up in any cluster stays free for the next symbol checked.

### How much a cluster pays

The pay depends on the symbol and on how many cells are in the cluster. Pays are **multiples of your bet**:

| Symbol | 5-6 cells | 7-8 | 9-11 | 12-14 | 15 or more |
| --- | --- | --- | --- | --- | --- |
| Pearl | 1.5× | 4× | 12× | 40× | 120× |
| Trident | 1.2× | 3× | 9× | 30× | 90× |
| Crown | 1× | 2.5× | 7× | 22× | 70× |
| Eye | 0.8× | 2× | 5× | 16× | 50× |
| Amphora | 0.5× | 1.2× | 3× | 10× | 30× |
| Conch | 0.4× | 1× | 2.5× | 8× | 24× |
| Crystal | 0.3× | 0.8× | 2× | 6× | 18× |
| Scale | 0.2× | 0.5× | 1.5× | 4× | 12× |

### The cascade multiplier

In normal play the multiplier grows with every cascade of the same spin:

| Cascade | 1st | 2nd | 3rd | 4th | ... | 10th or later |
| --- | --- | --- | --- | --- | --- | --- |
| Multiplier | ×1 | ×2 | ×3 | ×4 | ... | ×10 (the maximum) |

A cluster's payout is: **bet × table pay × multiplier**, rounded to a whole credit (each cluster is rounded separately).

### Free spins

If the **first** board has **4 or more Scatters** you win free spins:

| Scatters | Free spins |
| --- | --- |
| 4 | 8 |
| 5 | 12 |
| 6 or more | 15 |

Free spins cost nothing and use the bet that triggered them. During free spins the multiplier **does not restart** at ×1 each cascade: it starts at ×1 and **grows by one for every winning cascade, carrying over from spin to spin**, up to ×25. No Scatters appear during free spins, so they cannot be triggered again. Everything won in the free spins is paid as it happens and a final bonus total is reported.

### Losing

A spin loses when the first board has no cluster of 5 or more. You keep nothing from that bet (the 4-or-more-Scatter free spins are the only extra).

## 4. The complete algorithm, step by step

1. **Check the bet** (one of the seven sizes), or use the saved bet during free spins. Take the stake (free spins cost nothing).
2. **Draw the first board.** Go through the 30 cells column by column, top to bottom. For each cell:
   - In a normal spin there is a **2%** chance that it is a Scatter (it cannot be in free spins).
   - Otherwise draw a symbol (next step).
3. **Draw one symbol** (used for the first board and for every refill):
   - There is a **1.5%** chance it is a **Wild**.
   - Otherwise, if there is a neighbour that was already placed (the cell to the left or the cell above) holding a paying symbol, there is a **20%** chance the new symbol simply **copies one of those neighbours** (picked at random if there are two). This makes clusters more likely ("clumping").
   - Otherwise draw one of the eight paying symbols with these relative chances: Scale 16, Crystal 15, Conch 14, Amphora 13, Eye 10, Crown 8, Trident 7, Pearl 6 (so Scale is the most common and Pearl the rarest).
4. **Find clusters** as described in section 3. If there are none, the spin ends.
5. **Pay the clusters** at the current multiplier.
6. **Remove the clusters.** In every column the surviving symbols fall to the bottom; the empty space on top is refilled with new symbols (step 3).
7. Go back to step 4. (As a safety rule only, a spin stops after 100 cascades; this has never come close to happening.)
8. **Free spins:** after the whole spin, if it was a normal spin with 4 or more Scatters, set up the free spins. After a free spin, update how many are left, the carried-over multiplier and the bonus total.

## 5. Winning and losing chances

### Scatters and free spins (exact)

With a 2% Scatter chance in each of the 30 cells:

| Scatters on the first board | Chance | Roughly |
| --- | --- | --- |
| 0 | 54.55% | |
| 1 | 33.40% | |
| 2 | 9.88% | |
| 3 (a tease: nothing happens) | 1.88% | 1 in 53 |
| 4 | 0.259% | 1 in 386 |
| 5 | 0.0275% | 1 in 3,634 |
| 6 or more | 0.0025% | 1 in 39,780 |
| **4 or more: free spins** | **0.289%** | **1 in 346** |

### Everything else (from 2,000,000 simulated spins)

A cascading game has far too many possible paths to add up by hand, so these were measured by simulating **2 million spins** with exactly the rules in section 4.

| Measure | Result |
| --- | --- |
| Spins that pay anything | **55.0%** (1 spin in 1.8) |
| Spins that pay nothing | **45.0%** |
| Return from normal play (no free spins) | 88.6% |
| Extra return from free spins | about 8.1% |
| **Total return to player** | **96.7%** (95% confidence range 96.3% to 97.1%) |
| Free spins triggered (measured) | 0.293% (about 1 in 341), in line with the exact 1 in 346 |
| Average total won in one free-spins feature (including its 8 to 15 spins) | about **27.6×** the bet |
| Most cascades seen in one spin | 12 |
| Biggest win seen in a whole round | about 397× the bet |

How big are the wins? (win in one spin of normal play, as a multiple of the bet, before free spins):

| Win size | Chance |
| --- | --- |
| Nothing | 44.96% |
| More than 0 but under 10× | 54.34% |
| 10× to 24.99× ("big") | 0.65% |
| 25× to 49.99× ("super") | 0.046% |
| 50× to 99.99× ("mega") | 0.005% |
| 100× or more ("jackpot") | 0.0003% (about 1 in 330,000) |

## 6. Random numbers and fairness

- Every round has a fresh secret seed from the operating system's secure random source. See [the shared explanation](README.md#random-numbers-and-fairness).
- Every symbol, every Scatter, Wild and "copy a neighbour" decision comes from that seed, in a fixed order, with unbiased picking. The same seed, bet and game version always replay the identical board and cascades.
- The whole spin (first board, every cascade and every refill) is decided before anything is shown. Free spins get their own fresh seeds.

## 7. Payout examples

Amounts are demo credits. The board below was produced with the same rules (abbreviations: CR Crown, EY Eye, CO Conch, CY Crystal, PE Pearl, SC Scale, AM Amphora, TR Trident). Brackets mark the winning cluster. The columns are the six columns of the board.

**Example: a spin with two cascades. Bet 100.**

Board before cascade 1 (multiplier ×1):
```
 [CR] EY  CO  CY  CR  CY
 [CR] EY  PE  SC  AM  AM
 [CR] CY  AM  CY  AM  EY
 [CR] CY  TR  AM  CO  EY
 [CR] EY  CY  CY  PE  CO
```
The whole first column is **5 Crowns** (touching vertically): a 5-cell Crown cluster pays 1× × the ×1 multiplier × 100 = **100**. The five Crowns vanish and five new symbols fall into the first column.

Board before cascade 2 (multiplier ×2):
```
  SC  EY  CO  CY  CR  CY
  SC  EY  PE  SC  AM  AM
 [CY][CY] AM  CY  AM  EY
 [CY][CY] TR  AM  CO  EY
 [CY] EY  CY  CY  PE  CO
```
The new symbols created a 5-cell **Crystal** cluster: 0.3× × the ×2 multiplier × 100 = **60**. The Crystals vanish, new symbols fall in, and the new board has no cluster of 5.

**Total won: 100 + 60 = 160** (1.6× the bet). Profit 60.

**Example: a spin with no cluster.** Bet 50. The first board has no 5 touching identical symbols (a Wild can join but there is still no group of 5). Payout **0**. You lose the 50.

**Example: the free-spins multiplier.** A spin with 4 Scatters starts **8 free spins**. In free spin 1 there is one winning cascade: it pays at ×1, then the multiplier becomes ×2. Free spin 2 has two winning cascades: the first pays at ×2, the second at ×3, and the multiplier becomes ×4 for free spin 3. If a free spin has no winning cascade the multiplier simply stays where it is. It never goes above ×25.

## 8. What is taken from the existing game, and what is assumed

**Taken from the existing game (not changed):** the 6×5 board, the 5-cell minimum, the four-direction connection rule, the paytable, the way sizes map to pays, the Wild rule (including how Wilds are shared between clusters), the cascade multiplier (×1 to ×10), the free-spin counts (8/12/15) and trigger (4+ Scatters), the free-spin multiplier (carries over, +1 per winning cascade, maximum ×25), the relative chances of the eight paying symbols (16/15/14/13/10/8/7/6), and the seven bet sizes.

**ASSUMPTIONS (the existing game never says):**

1. **How often a Wild appears: 1.5%** per new symbol. (The existing demo script uses between 0% and 2%.)
2. **How often a Scatter appears: 2%** per cell of the first board, never in refills and never in free spins.
3. **Clumping: 20%.** The existing demo uses a "clump" setting between 0.2 and 0.66 to make clusters appear on purpose in its scripted spins. Plain independent draws almost never make clusters (the game would return only about 13%), so some clumping is needed. 0.2 is the lowest value the demo itself uses.
4. **A safety limit of 100 cascades** per spin. This is not a game rule.

**Important: the return depends enormously on the clumping setting.** Approximate results for the same game with only the clumping changed (100,000 spins each):

| Clumping | Return to player |
| --- | --- |
| 0% (no copying) | about 13% |
| **20% (used)** | **about 96%** |
| 30% | about 236% |
| 45% | about 950% |
| 55% | about 2,600% |

The settings the existing demo uses to show off big wins (0.3 to 0.66) would make the real game pay many times more than it takes. The value 20% was chosen because it is the demo's own lowest setting and gives a return just under 100%; it is **not** a rule of the game. The game's owner should decide the intended design. To change it, edit `atlantis-cascade.config.ts`, then re-run `tools/atlantis-calc.js`.
