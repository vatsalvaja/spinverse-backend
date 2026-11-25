# Neon Overdrive

A cyberpunk slot with 12 paylines and a **Hold & Respin** bonus where glowing Overdrive Cores lock in place and carry prizes. Free demo credits only.

> **Bottom line:** with the symbol chances assumed below (see [What is assumed](#8-what-is-taken-from-the-existing-game-and-what-is-assumed)), the game returns **89.70%** of every bet on average, **42.9%** of spins pay something, and the Hold & Respin bonus appears about once every **517** spins.

---

## 1. How the game works

The screen is **5 reels × 4 rows = 20 windows**. You win in two ways: with **lines** in the normal game, and with the **Hold & Respin bonus**.

| Symbol | Role |
| --- | --- |
| Plasma Cell, Quantum Chip, Circuit Crystal, Holo Visor, Cyber Drone | The five paying symbols (Cell the lowest, Drone the highest) |
| **Arc Reactor** | **Wild.** Stands in for any paying symbol. Five Reactors pay the biggest line prize. |
| **Overdrive Core** (the glowing orb) | Pays nothing on a line (it **breaks** a line). **6 or more anywhere** start Hold & Respin. Each core carries a points value. |

There are **12 paylines**: fixed paths across the 5 reels (rows are counted from 1 at the top to 4 at the bottom). Lines 1 to 4 are the four straight rows (2nd, 3rd, 1st, 4th row), lines 5 and 6 are a "V" and an upside-down "V", and lines 7 to 12 are the other zig-zag and diagonal shapes of the game.

You choose a **bet** of 10, 20, 50, 100, 200 or 500 demo credits. The bet covers all 12 lines.

## 2. How a round starts and ends

**Start.** You pick a bet. The server checks it and takes it from your balance.

**The spin.** The 20 windows are filled. Line wins are worked out. If there are **6 or more Overdrive Cores**, the Hold & Respin bonus plays out immediately, **inside the same round**.

**End.** The server adds the line wins and the bonus (if any), pays the total and reports everything: the grid, the winning lines and, for a bonus, every respin. The round is already finished when you see it.

## 3. How winning and losing are decided

### Line wins

A line pays when it shows **3, 4 or 5 matching symbols in a row, counting from the first (left) reel**. Rules:

- Counting starts at reel 1 and symbols must be next to each other.
- The **Arc Reactor** counts as whatever paying symbol it helps. A line made only of Reactors pays as Reactors.
- An **Overdrive Core breaks the line** (it counts as nothing).
- Every winning line is paid and the amounts are added together.

**Line pays** (multiples of your **total bet**):

| Symbol | 3 in a row | 4 in a row | 5 in a row |
| --- | --- | --- | --- |
| Plasma Cell | 0.4× | 1.2× | 3× |
| Quantum Chip | 0.6× | 2× | 5× |
| Circuit Crystal | 1× | 4× | 10× |
| Holo Visor | 2× | 8× | 25× |
| Cyber Drone | 4× | 15× | 50× |
| Arc Reactor | 5× | 25× | 100× |

The total is rounded to a whole credit (with the six allowed bet sizes it is always already whole).

### Hold & Respin

**Trigger:** 6 or more Overdrive Cores anywhere in the 20 windows.

1. The cores **lock** where they are, each carrying its **value** (1, 2, 3, 4, 5, 6, 8, 10 or 40).
2. You get **3 respins**. On each respin, **every empty window** spins again. Any window that shows a core locks it too.
3. **Whenever at least one new core lands, the respin counter goes back to 3.** If nothing lands, you lose one respin.
4. The bonus ends when **all 20 windows are full** or **the respins run out**.
5. **OVERDRIVE:** if **10 or more cores** are locked at the end, every core is worth **double**.
6. **Grand bonus:** if all 20 windows are full, you also win **100× your bet**.

**Prize:** each core pays its value × your bet (×2 with Overdrive). Add the Grand bonus for a full grid. This is added to any line wins from the same spin.

### Losing

A spin loses when no line wins and there are fewer than 6 cores. (3, 4 or 5 cores are only a "tease": nothing is paid.)

## 4. The complete algorithm, step by step

1. **Check the bet** is one of the six sizes and take the stake.
2. **Fill the grid,** reel by reel, top to bottom. For each window draw one of the 7 symbols (the Arc Reactor and the Overdrive Core included) with the chances in the table below. If it is a core, draw its value (next table).
3. **Check the 12 lines** with the rules in section 3 and add the multipliers of every winning line. Multiply by the bet.
4. **Count the cores.** If fewer than 6, skip to step 8.
5. **Lock** all the cores. Start with 3 respins.
6. **Respin loop** (repeat while there is at least one empty window and at least one respin left): go through every empty window; each one has a **7%** chance to show a new core (and if so draw its value). Lock them. If at least one landed, respins go back to 3; otherwise subtract 1.
7. **Score the bonus:** decide Overdrive (10 or more cores) and the Grand bonus (20 cores) and add up the core prizes.
8. **Pay** line wins plus the bonus prize.

### The symbol chances (an assumption)

| Symbol | Weight (out of 200) | Chance in a window |
| --- | --- | --- |
| Plasma Cell | 60 | 30.0% |
| Quantum Chip | 45 | 22.5% |
| Circuit Crystal | 35 | 17.5% |
| Holo Visor | 30 | 15.0% |
| Cyber Drone | 15 | 7.5% |
| Arc Reactor | 1 | 0.5% |
| Overdrive Core | 14 | 7.0% |

### The core values (an assumption)

A core's value is drawn so that small values are common and big ones rare: the chance of a value is proportional to 1 divided by the value.

| Core value | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 40 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Chance | 37.0% | 18.5% | 12.3% | 9.3% | 7.4% | 6.2% | 4.6% | 3.7% | 0.93% |

The average core is worth about **3.33×** the bet.

### Respin landing chance (an assumption)

During Hold & Respin each empty window has a **7%** chance per respin to show a core, which is exactly the chance a window has to show a core in the normal game (a respin is just another spin of that window).

## 5. Winning and losing chances

### Normal game

| Event | Chance | Roughly |
| --- | --- | --- |
| At least one line wins | 42.76% | 1 in 2.3 |
| Two or more lines at once | 13.24% | 1 in 7.6 |
| Hold & Respin triggers (6 or more cores) | **0.1933%** (exact) | **1 in 517** |
| 3 to 5 cores (tease, nothing paid) | 15.9% (exact) | 1 in 6.3 |
| **Anything paid** (a line win or a bonus) | **42.91%** | |
| **Nothing paid** | **57.09%** | |

(The line-win figures come from 5 million simulated spins, accurate to about ±0.03%; the bonus-trigger and tease figures are exact.)

How big are the line wins on a spin (5 million simulated spins)?

| Line wins total | Chance |
| --- | --- |
| Nothing | 57.24% |
| Under 1× the bet | 18.62% |
| 1× to 4.9× | 21.58% |
| 5× to 19.9× | 2.44% |
| 20× or more | 0.12% |

The biggest line win seen in 5 million spins was 100× the bet.

### Hold & Respin (exact, once it has triggered)

How many cores are locked when the bonus ends:

| Cores locked | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Chance | 4.1% | 3.6% | 4.5% | 5.5% | 6.7% | 7.9% | 9.0% | 10.1% | 10.7% | 10.8% | 9.9% | 8.1% | 5.5% | 2.8% | 0.8% |

- OVERDRIVE (10 or more cores): **82.3%** of bonuses.
- Full grid and the Grand bonus: **0.81%** of bonuses (about 1 in 123).
- The average bonus pays **83.3× the bet** (this average includes the rare Grand bonuses and 40-value cores).
- On average a bonus ends with about 13 cores locked.

### Return to player (exact)

| Source | Share of every bet returned |
| --- | --- |
| Line wins | 73.60% |
| Hold & Respin bonus | 16.10% |
| **Total** | **89.70%** |

On average a player gets back about 89.7 credits for every 100 staked and the game keeps about 10.3.

## 6. Random numbers and fairness

- A fresh secret seed from the operating system's secure random source is used for every round. See [the shared explanation](README.md#random-numbers-and-fairness).
- The 20 symbols, every core value and every respin landing come from that seed in a fixed order, with unbiased picking. The same seed, bet and game version reproduce the same grid and the same respins.
- The whole feature is decided before anything is shown. Your screen only replays the respins the server reports.

## 7. Payout examples

Amounts are demo credits.

**Example A: a line win with a Reactor.** Bet **50**. The grid (reels left to right, rows top to bottom):

```
 Chip    Cell     Drone   Chip    Cell
 Visor   REACTOR  Visor   Visor   Cell
 Cell    Chip     Cell    Chip    Crystal
 Chip    Cell     Chip    Cell    Chip
```
The 2nd row (line 1) reads Visor, **Reactor (counts as Visor)**, Visor, Visor, then Cell. That is **4 Visors** from the left: 8× the bet = 8 × 50 = **400**. No other line wins. Profit 350.

**Example B: nothing.** Bet **50**. The same shape of grid but with no 3 matching symbols from the left on any line and fewer than 6 cores. Payout **0**.

**Example C: a Hold & Respin bonus.** Bet **100**. The base grid shows **7 cores** with values 2, 4, 2, 1, 2, 2 and 1 (together 14), and no line wins.

| Step | What happens | Cores locked | Respins left |
| --- | --- | --- | --- |
| Start | The 7 cores lock | 7 | 3 |
| Respin 1 | nothing lands | 7 | 2 |
| Respin 2 | 3 cores land (10, 1 and 4) | **10** | back to 3 |
| Respin 3 | 1 core lands (10) | 11 | back to 3 |
| Respin 4 | nothing lands | 11 | 2 |
| Respin 5 | nothing lands | 11 | 1 |
| Respin 6 | nothing lands | 11 | 0, the bonus ends |

The total of the 11 core values is 14 + 15 + 10 = **39**. With **11 cores (10 or more) Overdrive is on**, so every core pays double: 39 × 2 × 100 = **7,800**. The grid is not full, so there is no Grand bonus. The round pays **7,800** for a stake of 100.

**Example D: the Grand bonus.** If all 20 windows fill, the same calculation applies and **100 × the bet** is added. With a bet of 50 that is an extra 5,000 on top of all the core prizes.

## 8. What is taken from the existing game, and what is assumed

**Taken from the existing game (not changed):** the 5×4 grid, the 12 paylines, the paytable, the Arc Reactor wild and a Reactor-only line, that Overdrive Cores break lines, the trigger (6 or more cores), 3 respins that reset when a core lands, Overdrive at 10 cores (×2), the Grand bonus (100× for a full grid), the way core prizes are rounded and the six bet sizes.

**ASSUMPTIONS (the existing game never says):**

1. **How often each symbol appears** (the table in section 4). The existing game plays a fixed script. The paytable is generous, so many natural-looking choices return well over 100% (for example, giving the five paying symbols equal chances returns over 140%). The chances used were found by trying round-number sets until one returned below 100% with a bonus that appears about once in 500 spins. This is a calibration for a demo, **not** a rule of the game.
2. **The core values and their chances** (1, 2, 3, 4, 5, 6, 8, 10, 40, with chance proportional to 1 divided by the value). The values are the ones the existing demo script uses.
3. **The respin landing chance (7%)**, equal to a core's chance in the normal game.
4. **Overdrive** is applied whenever 10 or more cores are locked at the end of the bonus. The existing screen engages it a moment after the 10th core lands, and only if the bonus continues; the stated rule ("ten locked cores engage Overdrive, ×2") is applied to the final result here, so a bonus that reaches 10 cores on its very last respin also gets the double.
5. **Line wins are paid in the same round as the bonus.** The existing demo never shows a spin that has both.

To change the design, edit `neon-overdrive.config.ts`, then re-run `tools/neon-calc.js` to get the new figures.
