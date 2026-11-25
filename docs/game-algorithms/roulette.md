# Roulette (European)

The classic table game with a wheel of **37 pockets**: the numbers 1 to 36 and a single zero. You place chips on the layout and the wheel decides. Free demo credits only.

> **Bottom line:** every bet on the table returns **97.30%** of the stake on average (the house keeps 2.70%, which is the zero). All figures are exact mathematics: this game has **no assumptions**, every rule comes from the existing game.

---

## 1. How the game works

- The wheel has **37 pockets: 0 (green), and 1 to 36**. Eighteen of the numbers are red and eighteen are black. The zero is green.
  - **Red:** 1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36.
  - **Black:** the other eighteen numbers.
- You put chips on one or more **positions** of the table. Each position covers certain numbers.
- The wheel is spun once; the pocket where the ball lands is the **winning number**.
- Any position that covers the winning number wins.
- You can bet any whole number of credits on a position (the table suggests chips of 1, 5, 10, 25 and 100). **At most 10,000** in total may sit on one position.

### The positions

| Position | Numbers covered | How to bet it | Winnings per 1 staked |
| --- | --- | --- | --- |
| **Straight** | 1 number (0 to 36) | `straight:17` | **35** |
| **Split** | 2 neighbouring numbers (0 may be split with 1, 2 or 3) | `split:8-9` | **17** |
| **Street** | a row of 3 (1-3, 4-6, ... 34-36) | `street:7` | **11** |
| **Corner** | 4 numbers in a square | `corner:8` | **8** |
| **Six line** | two neighbouring streets (6 numbers) | `sixline:7` | **5** |
| **Dozen** | 1-12, 13-24 or 25-36 | `dozen:1` to `dozen:3` | **2** |
| **Column** | one of the three long columns of 12 | `column:1` to `column:3` | **2** |
| **Red** or **Black** | 18 numbers | `red`, `black` | **1** |
| **Odd** or **Even** | 18 numbers | `odd`, `even` | **1** |
| **1 to 18** or **19 to 36** | 18 numbers | `low`, `high` | **1** |

"Winnings per 1 staked" is the profit. A winning bet also **gets its own stake back**. For example a winning straight bet of 10 pays 350 profit and returns the 10: you receive 360.

The **zero** is not red, black, odd, even, low or high, so every outside bet (red/black, odd/even, low/high, dozens, columns) **loses** when the ball lands on zero. Only a straight bet on 0, or a split with 0, can win on the zero.

## 2. How a round starts and ends

**Start.** You send all the chips you want to place in one go. The server checks that every position really exists on a European table, that the amounts are whole numbers from 1 up, and that no position goes over 10,000. It adds chips placed on the same position together and takes the **total stake** from your balance.

**The spin.** The server picks the winning number. **It does this without looking at your bets.**

**End.** Every bet is checked against the winning number, the total winnings are paid and the result is reported. The round is finished at once; the spinning wheel your screen shows only replays the result.

## 3. How winning and losing are decided

For each position you bet on:

- If the winning number is **among the numbers that position covers**, you **win**: you receive your chips back **plus** the winnings from the table above.
- If not, you **lose** that position's chips.

Your round result is the sum of all positions: some may win and some may lose in the same spin.

## 4. The complete algorithm, step by step

1. **Check the bets.** Each position must be valid (for example a split must be two numbers that really touch on the table, a street must start at 1, 4, 7, ... 34), each amount a whole number from 1 up, each position at most 10,000, and at most 500 chip placements in one spin.
2. **Add the chips on the same position** together and check the limit again.
3. **Check the balance** and take the total stake.
4. **Draw the winning number:** pick a position on the wheel uniformly at random among the 37 pockets, with unbiased random numbers (section 6).
5. **For each position:** is the winning number one of its numbers? If so, winnings = chips × the table figure and you receive chips + winnings. If not, you receive nothing for it.
6. **Total up** what you are paid, pay it, and save the round.

## 5. Winning and losing chances

Every pocket has the same chance, **1 in 37 = 2.70%**. The chance of a position is the number of numbers it covers divided by 37.

| Position | Numbers | Chance to win | Roughly | Winnings per 1 | Return on average |
| --- | --- | --- | --- | --- | --- |
| Straight | 1 | 2.703% | 1 in 37 | 35 | 97.30% |
| Split | 2 | 5.405% | 1 in 18.5 | 17 | 97.30% |
| Street | 3 | 8.108% | 1 in 12.3 | 11 | 97.30% |
| Corner | 4 | 10.811% | 1 in 9.3 | 8 | 97.30% |
| Six line | 6 | 16.216% | 1 in 6.2 | 5 | 97.30% |
| Dozen | 12 | 32.432% | 1 in 3.1 | 2 | 97.30% |
| Column | 12 | 32.432% | 1 in 3.1 | 2 | 97.30% |
| Red / Black | 18 | 48.649% | 1 in 2.06 | 1 | 97.30% |
| Odd / Even | 18 | 48.649% | 1 in 2.06 | 1 | 97.30% |
| 1 to 18 / 19 to 36 | 18 | 48.649% | 1 in 2.06 | 1 | 97.30% |

**Why every bet returns the same 97.30%:** a position covering *n* numbers wins with probability *n* ÷ 37 and returns (winnings + 1) per credit; in every row of the table (winnings + 1) × *n* = 36. So the average return is 36 ÷ 37 = **97.297%**, whatever you bet. If the table had no zero (36 pockets) every bet would be exactly fair; the single zero is what gives the house its 1 ÷ 37 = **2.70%** edge.

Putting chips on many positions in one spin does not change the average: the return is still 97.30% of everything staked. It only changes how the results are spread.

Other facts (exact): red, black, odd, even and the three dozens or columns **never** cover the zero; **zero** appears once in 37 spins on average; no number is "due": every spin is independent of all the earlier ones.

## 6. Random numbers and fairness

- A fresh secret seed from the operating system's secure random source is used for every spin. See [the shared explanation](README.md#random-numbers-and-fairness).
- The winning pocket is a single unbiased pick among 37: the server throws away the rare raw values that would otherwise make the first few pockets slightly likelier.
- The number is drawn **before** the bets are read; the drawing never looks at what you bet.
- The order of the pockets on the wheel is only used for display. It has no effect on the chances.
- After the spin, the audit shows the seed and its fingerprint, so you can check the result was fixed before your bet was known.

## 7. Payout examples

Amounts are demo credits.

**Example A: a straight win.** Chips: **10 on 17**. The ball lands on **17**. Winnings 35 × 10 = 350, plus your 10 back: you receive **360**. Profit **350**.

**Example B: a straight loss.** Chips: **10 on 17**. The ball lands on **5**. You receive **0**; you lose the 10.

**Example C: an even-money win.** Chips: **25 on Red**. The ball lands on **23** (red). Winnings 1 × 25 = 25, plus your 25 back: you receive **50**. Profit **25**.

**Example D: the zero.** Chips: **25 on Red**. The ball lands on **0** (green). Red does not include zero: you receive **0** and lose the 25.

**Example E: several bets in one spin.** Chips: **10 on 17**, **25 on Red**, **50 on the 2nd Dozen (13-24)**. Total stake **85**. The ball lands on **19**, which is red and sits in the 2nd dozen (13 to 24).

| Position | Covers 19? | You receive |
| --- | --- | --- |
| Straight 17 (10) | no | 0 |
| Red (25) | **yes** | 25 + 25 = 50 |
| 2nd Dozen (50) | **yes** | 50 + 2 × 50 = 150 |

Total received **200** for a stake of **85**: profit **115**.

**Example F: a split.** Chips: **20 on Split 8/9**. The ball lands on **9**. Winnings 17 × 20 = 340, plus your 20 back: **360**.

## 8. What is taken from the existing game, and what is assumed

**Taken from the existing game (not changed):** the 37-pocket European wheel with a single zero and the order of pockets, which numbers are red and black, every position and exactly which numbers it covers, all the payout multiples, the 10,000 limit on one position, drawing the winning number uniformly and before the bets are read, and paying the stake back with a winning bet.

**ASSUMPTIONS:** none. Two practical differences: the server accepts any whole-number chip amount (the existing screen offers chips of 1, 5, 10, 25 and 100, which add up to whole numbers), and a spin is limited to 500 chip placements, far more than the table has distinct positions.
