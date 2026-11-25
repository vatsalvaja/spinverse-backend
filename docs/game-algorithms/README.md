# SPINVERSE game algorithms

This folder explains, in plain English, how every SPINVERSE game decides its results. You do not need to know anything about programming to read it.

Everything here is about **free demo credits**. They have no cash value and can never be deposited, withdrawn or exchanged.

## The six games

| Game | Type | What the numbers say | Document |
| --- | --- | --- | --- |
| Pharaoh's Fortune | 5×3 slot, 5 lines, free spins | Returns **88.78%** of every bet on average | [pharaohs-fortune.md](pharaohs-fortune.md) |
| Atlantis Cascade | 6×5 cluster slot, cascades, free spins | Returns about **96.7%** (measured by simulation, ±0.4) | [atlantis-cascade.md](atlantis-cascade.md) |
| Neon Overdrive | 5×4 slot, 12 lines, Hold & Respin | Returns **89.70%** of every bet on average | [neon-overdrive.md](neon-overdrive.md) |
| SKYFALL | Crash game with cash-out | Returns **95%** whatever multiplier you aim for | [skyfall.md](skyfall.md) |
| Tiger Clash | Card duel: Tiger, Dragon or Tie | **97.06%** on Tiger/Dragon, **52.94%** on Tie | [tiger-clash.md](tiger-clash.md) |
| Roulette | European roulette, one zero | **97.30%** on every bet | [roulette.md](roulette.md) |

"Returns 90%" means: over a very, very large number of rounds, about 90 credits come back for every 100 credits staked. In any single round, or even in a thousand rounds, the real result can be far above or far below that. This figure is usually called the **return to player**, or **RTP**.

## How every round works (the same for all games)

1. **You send a bet.** For example "50 credits on this slot", or "10 credits on red".
2. **The server checks the bet against the game's rules.** Wrong amounts, impossible bets or not enough credits are refused. Nothing is taken.
3. **The server takes your stake** from your demo credits.
4. **The server picks the result using its own random numbers.** Your screen has no say. Everything is decided before the animation starts.
5. **The server applies the game's rules** to the result to work out whether you won and how much.
6. **The server pays any win** and writes the round down permanently (the bet, the result, the random seed, your balance before and after).
7. **Your screen is told what happened** and simply shows it.

Because the result is decided and stored by the server, nobody can change it by editing the web page, replaying messages or slowing down the animation.

## Random numbers and fairness

**Where the randomness comes from.** For every round the server asks the computer's operating system for 32 bytes of secure random data. This is the same kind of randomness used to protect passwords and bank connections. It is the round's **seed**: a secret number nobody can guess.

**From one seed to many numbers.** A round often needs many random numbers (a slot needs one for every symbol). The server stretches the seed into as many numbers as needed with a standard, well-tested mixing method (HMAC-SHA256, run in counting order). The same seed always produces exactly the same numbers, and without the seed they cannot be predicted.

**No favouritism in the picks.** When the server needs "a number from 0 to 36" (roulette) it throws away the rare raw values that would make some numbers slightly likelier than others. Every number gets exactly the same chance.

**A promise made before the round.** When a round starts, you are shown a fingerprint of the seed (its SHA-256 hash, called the *seed commitment*). The seed itself stays secret until the round is over, then it is revealed. Anyone can check that the hash of the revealed seed equals the fingerprint they were given earlier. That proves the seed was not swapped after seeing your bet. For Tiger Clash the seed is shown when the session ends, because one seed decides a whole shuffled deck used over several rounds.

**What is stored for every round** (and shown by the audit endpoint): the game version, the seed and its fingerprint, how many random numbers were used, your bet, the result, and a fingerprint of the game's carry-over state. With the same game version, seed, bet and state, the result can be reproduced exactly.

## Where the rules come from, and what had to be assumed

The existing SPINVERSE games are demos. Their screens play a fixed script of results, and only some of the rules a real game needs are actually written down in them. For each game the document lists:

- **Taken from the existing game**: rules, tables and limits that already exist (paylines, paytables, payouts, bet sizes, special features). These were copied exactly and not changed.
- **Assumed**: things the existing game never defines, such as *how often each symbol appears*, or *how likely a plane is to crash early*. Without these a game cannot pick random results, so they had to be chosen. Each one is clearly marked **ASSUMPTION**, lives in one small settings file per game, and can be changed.

Please read the assumptions carefully. The returns quoted above follow **directly from them**:

- For **Pharaoh's Fortune**, **Neon Overdrive** and **Atlantis Cascade** the symbol chances (and, for Atlantis, how much new symbols copy their neighbours) decide the return. With other choices the same paytable could return far more or far less than 100%. The documents show how sensitive this is. Treat these chances as placeholders until the game's owner decides the intended design.
- For **SKYFALL** the "house edge" (5%) decides everything about how often the plane crashes early.
- **Tiger Clash** and **Roulette** have no assumptions: their rules are fully defined, and the figures are exact mathematics.

Nothing in these documents is a promised or "target" return. Every percentage is calculated from the rules and the stated assumptions.

## How the numbers were calculated

| Game | Method |
| --- | --- |
| Pharaoh's Fortune | **Exact**: every possible combination on a payline was added up. The scatter and free-spin parts are exact as well. The chance of winning anything on a spin was confirmed with 10 million simulated spins. |
| Neon Overdrive | **Exact**: lines by counting every combination; Hold & Respin by following every possible path step by step. Confirmed with 5 million simulated base spins. |
| Atlantis Cascade | **Simulation** of 2,000,000 spins with the same rules (a cascading game has too many paths to count). The result is given with its margin of error. |
| SKYFALL, Tiger Clash, Roulette | **Exact** formulas. |

The calculators used are in [`tools/`](tools). They are small stand-alone scripts that re-state each game's rules independently of the server code. They were **not** run against the server code itself. If you change a setting in a game's `*.config.ts`, change the matching numbers at the top of its calculator and run it again to get the new figures, and run a large simulation against the real engine before relying on them.

## Adding a new game

KENO, HI-LO and PACHINKO (and any later game) plug in without touching the existing games: each new game is one new algorithm module that follows the same simple contract (check the bet, start a round, optionally react to player actions, report the result), plus a catalog entry with the same game ID. The sessions, wallet, random numbers, history and audit trail are shared. See the README in the backend folder.
