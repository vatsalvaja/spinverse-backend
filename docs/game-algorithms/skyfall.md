# SKYFALL

A "crash" game. A plane takes off and a multiplier climbs. Cash out before the plane falls and you win your stake times the multiplier; stay in too long and you lose the stake. Free demo credits only.

> **Bottom line:** whatever multiplier you aim for, the game returns **95%** of your stake on average (see [What is assumed](#8-what-is-taken-from-the-existing-game-and-what-is-assumed)). Aiming low wins often with small prizes; aiming high wins rarely with large prizes. 5% of rounds crash instantly.

---

## 1. How the game works

- You place **one or two bets** at the same time, on **panel 0** and **panel 1**. Each panel has its own stake, and each can have its own optional **automatic cash-out** target.
- A stake is a whole number from **1 to 10,000** demo credits.
- The plane takes off and the **multiplier** (starting at 1.00×) grows smoothly with time. It keeps growing until the plane **crashes** at a point nobody can see in advance.
- You can **cash out** a panel at any moment before the crash. You then receive **stake × the multiplier at that moment**.
- A panel that has not cashed out when the plane crashes **loses its stake**.
- An **automatic cash-out** (from 1.01× to 1000×) cashes the panel out for you at exactly that multiplier, if the plane gets there.

## 2. How a round starts and ends

**Start.** You send your bet(s). The server checks every stake and target, then takes the total stake from your demo credits. **At that moment the server secretly decides where this plane will crash**, before anything else happens. After a short take-off delay (1.5 seconds) the multiplier starts to grow.

**During the round.** You may cash out a panel whenever you like. You (or your screen) can ask the server for the round at any time to see the current multiplier. The server always works out the multiplier from **its own clock**.

**End.** The round ends when every panel has either cashed out or been lost to the crash. The server settles a round from its own clock whenever the round is looked at or acted on, or when you try to start another round or close the session. **When it happens to be settled makes no difference to the result:** an automatic cash-out always pays exactly its target if the plane got that far, and a bet still open at the crash time is lost. You cannot start another round while one is still open.

## 3. How winning and losing are decided

- **Win** a panel: you cashed it out (by hand or automatically) **before the crash**. You receive **stake × cash-out multiplier** (rounded to cents). Your profit is that minus the stake.
- **Lose** a panel: the plane crashed before it was cashed out. You receive nothing from that panel.

Details:

- **Automatic cash-out is exact.** If your target is 2.50×, a successful cash-out always pays exactly 2.50×, never "about 2.5". It succeeds if the crash point is **2.50× or higher** (a crash at exactly 2.50× still pays).
- **Manual cash-out** pays the multiplier the server calculates at the moment it handles your request, **rounded down** to cents (never up) and at least 1.00×. Because the request takes a moment to travel, the paid multiplier can be slightly higher than what your screen showed when you clicked, and if the plane crashed in that moment you get nothing.
- **A crash at 1.00×** ("instant crash") loses every panel, because nobody can cash out at the very start.

### How fast the multiplier grows

The multiplier after *t* seconds of flight is e^(0.105 × t), the same curve as the existing game:

| To reach | 1.5× | 2× | 3× | 5× | 10× | 50× | 100× | 1000× |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Flight time | 3.9 s | 6.6 s | 10.5 s | 15.3 s | 21.9 s | 37.3 s | 43.9 s | 65.8 s |

## 4. The complete algorithm, step by step

1. **Check the bet.** 1 or 2 panels, each numbered 0 or 1 and used once, each stake a whole number from 1 to 10,000, each optional automatic cash-out between 1.01 and 1000. Check you have the total in demo credits. No other round of yours may be open.
2. **Take the total stake.**
3. **Decide the crash point** (below) using the round's secret random number. It is stored privately.
4. **Set the take-off time** (now + 1.5 seconds). The flight clock starts there.
5. **Whenever the round is read or acted on,** the server looks at its clock:
   - For every still-open panel with an automatic target at or below the crash point, if the plane has already flown long enough to reach that target, the panel is cashed out at **exactly the target**.
   - If the plane has already flown long enough to reach the crash point, every panel that is still open is lost.
6. **A cash-out request** first does step 5. If the panel is still open and the plane is flying, the panel is cashed out at the current multiplier (rounded down to cents, never below 1.00× and never above the crash point). Asking for a cash-out before take-off, or for a panel that is already settled, is refused.
7. **When no panel is open,** the round is finished. Wins are credited to your balance at the moment they happen.

### How the crash point is decided

1. Pick a random number **U** between 0 (included) and 1 (not included), with great precision.
2. Compute **X = 0.95 ÷ (1 − U)**.
3. If X is below 1.00, the plane crashes instantly at **1.00×**.
4. Otherwise the crash point is X **rounded down to cents**, never above **1000×**.

Both the "0.95" (a 5% house edge) and the 1000× ceiling are assumptions, explained in section 8.

## 5. Winning and losing chances

The chance that the plane reaches (or passes) a given multiplier *m* is simply **95% ÷ m**, for any *m* from 1 up (exact). A crash at exactly *m* counts as reaching it.

| Aim for (cash out at) | Chance the plane gets there (you win) | Chance you lose | Win pays (profit per 100 staked) | Average return |
| --- | --- | --- | --- | --- |
| 1.01× | 94.06% | 5.94% | +1 | 95% |
| 1.5× | 63.33% | 36.67% | +50 | 95% |
| 2× | 47.50% | 52.50% | +100 | 95% |
| 3× | 31.67% | 68.33% | +200 | 95% |
| 5× | 19.00% | 81.00% | +400 | 95% |
| 10× | 9.50% | 90.50% | +900 | 95% |
| 50× | 1.90% | 98.10% | +4,900 | 95% |
| 100× | 0.95% | 99.05% | +9,900 | 95% |
| 1000× | 0.095% | 99.905% | +99,900 | 95% |

Other useful facts (exact):

- **Instant crash at 1.00×:** 5.00% of rounds (1 in 20).
- The **middle** crash point is **1.90×** (half of all rounds crash below it, half above).
- **Every cash-out target returns 95%.** There is no "smart" target. Waiting longer does not make the plane safer, and a long run of low crashes does not make a high one more likely: every round is independent.

### Compared with the existing demo

The existing game only plays a fixed list of 40 demo crash points. In that list 2 of 40 are instant crashes (5%, which is what the 5% assumption was chosen to match). The demo list is more generous than the model for mid-range targets (for example 62.5% of its crashes are 2× or higher, against 47.5% in the model), which is normal for a showcase list; a 40-round list cannot define a probability.

## 6. Random numbers and fairness

- The crash point comes from the round's secret seed (the operating system's secure random source), and it is chosen **before you can do anything**: your bet size, your targets and the moment you cash out cannot change it. See [the shared explanation](README.md#random-numbers-and-fairness).
- It stays hidden until the plane has crashed. Even your own round data does not reveal it before then.
- The server's clock, not yours, decides what the multiplier is at every moment. A fast or slow screen, a paused browser tab or a changed clock cannot change a result.
- When the round is over, the crash point and the seed become visible in the audit, together with the fingerprint (hash) that was shown at the start, so you can check the crash point was fixed in advance.

## 7. Payout examples

Amounts are demo credits.

**Example A: an automatic cash-out wins.** Stake **100** on panel 0 with automatic cash-out **2.00×**. The plane crashes at **3.27×**. 3.27 is at least 2.00, so the bet cashes out at exactly 2.00×: payout 100 × 2.00 = **200**, profit **100**.

**Example B: an automatic cash-out loses.** The same bet, but the plane crashes at **1.84×**. The plane never reaches 2.00×, so the bet is lost: payout **0**, loss **100**.

**Example C: a manual cash-out.** Stake **50** on panel 1, no automatic target. You ask to cash out when the server's clock says the plane has flown 11.0 seconds: the multiplier is e^(0.105 × 11.0) = 3.17 (rounded down). Payout 50 × 3.17 = **158.50**, profit 108.50. If the plane's secret crash point had been 3.10× the request would have arrived too late and the bet would have been lost.

**Example D: two panels.** Panel 0: stake **100**, automatic cash-out **1.50×**. Panel 1: stake **100**, no target (you plan to cash out by hand but wait too long). The plane crashes at **2.40×**. Panel 0 is cashed at exactly 1.50× = **150**. Panel 1 is lost: **0**. Total stake 200, total payout 150, **net −50**.

**Example E: an instant crash.** The crash point is **1.00×**. Both panels are lost, whatever you chose.

## 8. What is taken from the existing game, and what is assumed

**Taken from the existing game (not changed):** the two bet panels, stakes from 1 to 10,000 (whole numbers), the growth curve e^(0.105 t), the automatic cash-out range (1.01× to 1000×), cash-outs at the current multiplier rounded down to cents (never below 1.00×), automatic cash-outs paying exactly their target and only if the plane gets there, a crash losing every open bet, a crash at 1.00× being possible, each bet being settled exactly once, and the crash point being decided before the round starts and hidden until the crash.

**ASSUMPTIONS (the existing game never says):**

1. **The house edge: 5%.** The existing game only plays 40 scripted crash points, so it does not define how likely each crash point is. The model above makes the chance of reaching multiplier *m* equal to (1 − edge) ÷ *m*; the edge is the only unknown number. 5% was chosen because the demo's list contains instant crashes at exactly that rate (2 in 40). Any other edge works the same way: with edge *e*, every cash-out target returns (1 − *e*) on average and the instant-crash rate is *e*.
2. **A ceiling of 1000×.** The plane never flies past 1000× (the highest automatic cash-out the game allows). The effect on returns is negligible.
3. **A new round starts straight after the bet** (1.5 seconds of take-off), without the 6-second betting countdown of the existing screen, and rounds belong to one player rather than being shared with other (simulated) players.
4. **Bets are made when the round starts.** In the existing screen a bet can also be cancelled before take-off; here a bet that has been placed starts immediately.

To change the edge or the ceiling, edit `skyfall.config.ts` (`HOUSE_EDGE`, `MAX_CRASH_MULTIPLIER`).
