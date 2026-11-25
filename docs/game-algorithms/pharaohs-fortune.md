# Pharaoh's Fortune

A classic five-reel slot set in an Egyptian tomb. Match symbols along five paths across the screen, hunt for the Golden Scarabs, and chase the 1000× Pharaoh jackpot. Free demo credits only.

> **Bottom line:** with the symbol chances assumed below (see [What is assumed](#what-is-taken-from-the-existing-game-and-what-is-assumed)), the game returns **88.78%** of every bet on average, and **15.8%** of spins pay something.

---

## 1. How the game works

The screen is a grid of **5 columns (reels) and 3 rows**, so 15 windows, each showing one symbol.

| Symbol | Role |
| --- | --- |
| **Pharaoh** | **Wild.** Stands in for any symbol except the Scarab. Five Pharaohs in a row is the jackpot. |
| **Golden Scarab** | **Scatter.** Pays and triggers free spins when 3 or more show up anywhere on screen. |
| Anubis, Eye of Horus, Golden Sphinx | **High** symbols |
| Ancient Temple, Golden Coin, Ancient Jewel | **Low** symbols |

There are **five paylines**, five fixed paths that run from the left edge to the right edge (rows are counted 1 = top, 2 = middle, 3 = bottom):

| Line | Path (row used on reels 1 to 5) |
| --- | --- |
| 1 | middle, middle, middle, middle, middle |
| 2 | top, top, top, top, top |
| 3 | bottom, bottom, bottom, bottom, bottom |
| 4 | top, middle, bottom, middle, top ("V") |
| 5 | bottom, middle, top, middle, bottom (upside-down "V") |

You choose a **bet** of 10, 20, 50, 100, 250 or 500 demo credits. The bet covers all five lines.

## 2. How a round starts and ends

**Start.** You pick a bet size. The server checks it is one of the six allowed amounts and that you have enough credits, then takes the bet from your balance.

**The spin.** The server fills all 15 windows with symbols (see section 4).

**End.** The server looks at the finished screen, works out every win, pays the total straight away and tells your screen the result. A round never stays open: it is finished the moment the spin is drawn.

**Free spins** (after a scatter win, section 3) are rounds too, but they cost nothing. They play one after another until none are left.

## 3. How winning and losing are decided

### Line wins

A line pays when it shows **3, 4 or 5 of the same symbol in a row, counting from the first (left) reel**. The symbols must touch each other starting at reel 1. The Pharaoh counts as whatever symbol it helps.

Rules that surprise people:

- Counting always starts at reel 1. Symbols on reels 3 to 5 with a gap before them do not count.
- A line that **starts with a Golden Scarab pays nothing**, and a line whose first real symbol (ignoring Pharaohs) is a Scarab pays nothing.
- Five Pharaohs on one line pay the **jackpot** instead of the normal table.
- Every winning line is paid; the amounts are added together.

**Line pays** (multiples of your bet):

| Symbol | 3 in a row | 4 in a row | 5 in a row |
| --- | --- | --- | --- |
| Anubis | 4× | 12× | 40× |
| Eye of Horus | 4× | 12× | 40× |
| Golden Sphinx | 4× | 12× | 40× |
| Ancient Temple | 2× | 5× | 15× |
| Golden Coin | 2× | 5× | 15× |
| Ancient Jewel | 2× | 5× | 15× |
| **5 Pharaohs** | | | **1000×** (jackpot) |

### Scatter wins and free spins

Count the Golden Scarabs anywhere on the screen (no lines needed):

| Scarabs | Instant prize | Free spins |
| --- | --- | --- |
| 1 or 2 | nothing | none |
| 3 | **5×** your bet | **10** |
| 4 or more | **20×** your bet | **15** |

The instant prize is paid together with any line wins from the same spin.

**Free spins:** they cost nothing, use the same bet as the spin that started them, pay any line wins as normal, and **cannot be triggered again** (no Golden Scarabs appear during free spins). When the last free spin is played the bonus is over and your total bonus win is reported.

### Losing

A spin loses when no line wins and there are fewer than 3 Scarabs. You keep nothing from that bet.

## 4. The complete algorithm, step by step

1. **Check the bet.** In a normal spin, the bet must be 10, 20, 50, 100, 250 or 500. During free spins your bet is ignored and the bet that started the bonus is used.
2. **Check the balance** and take the stake (free spins: nothing is taken).
3. **Fill the 15 windows**, one by one, row by row. For each window the server draws one symbol using the random numbers (section 6), according to the symbol chances below. Each window is drawn **independently**: what is in one window does not affect any other.
4. **Check the five lines**, one at a time, with the rules in section 3. Add up the multipliers of all winning lines; multiply by your bet.
5. **Count the Golden Scarabs.** If this is a normal spin and there are 3 or more, add the instant prize and note how many free spins were won.
6. **Pay** line wins plus the instant prize.
7. **Keep track of free spins:** after a free spin, one fewer is left; the bonus total grows by that spin's line wins; after the last one the bonus is complete.

### The symbol chances (an assumption)

The server chooses each symbol according to "weights". Higher weight means more often.

| Symbol | Weight | Chance in a window (normal spin) | Chance in a window (free spin) |
| --- | --- | --- | --- |
| Pharaoh | 1 | 1.59% (1 in 63) | 1.64% (1 in 61) |
| Golden Scarab | 2 | 3.17% (2 in 63) | **0%** |
| Anubis | 10 | 15.87% | 16.39% |
| Eye of Horus | 10 | 15.87% | 16.39% |
| Golden Sphinx | 10 | 15.87% | 16.39% |
| Ancient Temple | 10 | 15.87% | 16.39% |
| Golden Coin | 10 | 15.87% | 16.39% |
| Ancient Jewel | 10 | 15.87% | 16.39% |

## 5. Winning and losing chances

These figures follow from the symbol chances above. "Exact" means every possible combination was added up, not estimated.

### Chances on one line (exact)

| Result | Chance | Roughly |
| --- | --- | --- |
| Exactly 3 matching from the left | 2.634% | 1 in 38 |
| Exactly 4 matching | 0.460% | 1 in 217 |
| Exactly 5 matching (not all Pharaohs) | 0.0974% | 1 in 1,027 |
| Five Pharaohs (jackpot) | 0.0000001% | 1 in about 992 million |
| **Any win on that line** | **3.19%** | **1 in 31** |

With five lines, the chance of hitting the jackpot on a spin is about 1 in 198 million. In practice you should not expect to see it.

### Chances on one spin

| Event | Chance | Roughly |
| --- | --- | --- |
| At least one line wins | 14.75% | 1 in 6.8 |
| Two or more lines win at once | 1.12% | 1 in 89 |
| 3 Scarabs (prize + 10 free spins) | 0.988% (exact) | 1 in 101 |
| 4 or more Scarabs (prize + 15 free spins) | 0.105% (exact) | 1 in 956 |
| Free spins triggered (3 or more Scarabs) | 1.09% | 1 in 92 |
| 2 Scarabs (a tease: nothing paid) | 6.96% | 1 in 14 |
| **Anything paid** (a line win or the scatter prize) | **15.76%** | **1 in 6.3** |
| **Nothing paid** | **84.24%** | 5 spins in 6 |

(Line-win and "anything paid" figures come from 10 million simulated spins and are accurate to about ±0.01%; the Scarab figures and the line figures above are exact.)

### Size of line wins on one spin (10 million simulated spins)

| Line wins total | Chance |
| --- | --- |
| Nothing | 85.25% |
| 2× to 4× your bet | 11.53% |
| 5× to 9× | 1.58% |
| 10× to 29× | 1.40% |
| 30× or more | 0.24% |

The largest line win seen in 10 million spins was 122× the bet (the 1000× jackpot did not occur).

### Return to player (exact)

| Source | Share of every bet returned |
| --- | --- |
| Line wins in normal spins | 72.46% |
| Instant scatter prizes | 7.03% |
| Free spins (their line wins) | 9.28% |
| **Total** | **88.78%** (the parts are rounded, so they may differ from the total by 0.01) |

Over a very long time, a player gets back about 88.8 credits for every 100 staked and the game keeps about 11.2.

A free spin is worth on average **0.8106× the bet** (each free spin is a normal draw without Scarabs, so a little better than a normal spin's line wins). So the 10 free spins from 3 Scarabs are worth on average 8.1× the bet and the 15 free spins from 4 or more Scarabs about 12.2×, in addition to the instant prize.

## 6. Random numbers and fairness

- The server uses a fresh, secret random seed for every round, taken from the operating system's secure random source. See [the shared explanation](README.md#random-numbers-and-fairness).
- Every window's symbol is picked with an even-handed "weighted draw": a random whole number is chosen with no bias, and the symbol whose weight range contains it is used. The server draws 15 numbers (one per window) for each spin.
- The draw happens **before** anything else and cannot be influenced by your bet size, your balance, your history or your screen.
- Free spins use fresh random numbers too; they are not replays.

## 7. Payout examples

All examples use the rules above. Amounts are demo credits.

**Example A: a line win with a Pharaoh.** Bet **50**.

```
 Jewel   Coin    Temple   Jewel    Coin
 Anubis  Anubis  PHARAOH  Anubis   Horus
 Coin    Temple  Jewel    Horus    Temple
```
The middle line reads Anubis, Anubis, **Pharaoh (counts as Anubis)**, Anubis, then Horus. That is **4 Anubis in a row** from the left, so it pays 12× the bet: 12 × 50 = **600**. No other line wins. Profit: 600 − 50 = 550.

**Example B: a small win.** Bet **100**. The top line reads Temple, Temple, Temple, Jewel, Coin: **3 Temples** pay 2× = **200**. Profit 100.

**Example C: nothing.** Bet **50**.
```
 Jewel   Coin    Temple   Jewel    Coin
 Anubis  Horus   Sphinx   Anubis   Horus
 Coin    Temple  Jewel    Horus    Temple
```
No line has 3 matching symbols from the left, and there are no Scarabs. Payout **0**; you lose the 50.

**Example D: scatter bonus.** Bet **50**.
```
 SCARAB  Horus   Temple   Sphinx   Anubis
 Coin    Jewel   SCARAB   Temple   Horus
 Sphinx  Anubis  Jewel    Coin     SCARAB
```
No line wins, but there are **3 Scarabs** anywhere: instant prize 5 × 50 = **250**, plus **10 free spins** at a bet of 50 each (free). The spins then play out; if the 10 free spins win 600 in total, the whole bonus is worth 250 + 600 = 850.

**Example E: a Scarab on the left does not help.** Bet **50**. The top line is Scarab, Anubis, Anubis, Anubis, Anubis. A line that starts with a Scarab pays nothing, even though there are four Anubis after it.

**Example F: the jackpot.** Bet **10**. The middle line shows five Pharaohs: 1000 × 10 = **10,000**.

## 8. What is taken from the existing game, and what is assumed

**Taken from the existing game (not changed):** the 5×3 grid, the five paylines, the paytable, the Pharaoh wild and its exceptions, the 1000× jackpot, the Scarab scatter, the scatter prizes and free-spin counts, the six bet sizes, and that free spins cannot retrigger.

**ASSUMPTIONS (the existing game never says):**

1. **How often each symbol appears** (the weights in section 4). The existing game plays a fixed script, so no frequencies exist. The weights chosen are the simplest ones: every paying symbol equally likely, a rare Pharaoh, a Scarab a little more common than the Pharaoh. Different weights give very different returns: for example, making the high-paying symbols somewhat more common than the low ones (12 versus 8) would push the return above 120%, and making them less common (8 versus 12) would drop it to about 80%.
2. **Each window is independent** of all the others (like real reels would not be exactly, but this keeps the calculation exact).
3. **No Golden Scarab appears during free spins.** This copies the existing game's free spins, which never contain Scarabs, so they can never be triggered again.
4. **Free spins use the same symbol chances** otherwise, apart from the missing Scarab.

If the game's owner wants a specific return, the weights are the one thing to change (file `pharaohs-fortune.config.ts`), then re-run the calculator in `docs/game-algorithms/tools/` to get the new figures.
