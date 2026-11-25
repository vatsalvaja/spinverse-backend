# Calculation tools

Small stand-alone scripts (plain Node.js, no packages) that produced the numbers in the game documents. Each one restates its game's rules **independently** of the server code and prints the figures.

| Script | Game | Method | Run time |
| --- | --- | --- | --- |
| `pharaoh-calc.js` | Pharaoh's Fortune | exact (adds up every combination) | instant |
| `neon-calc.js` | Neon Overdrive | exact (lines by enumeration, Hold & Respin by step-by-step probability) | instant |
| `atlantis-calc.js` | Atlantis Cascade | simulation: `node atlantis-calc.js 2000000 20261127` (spins, seed) | about 4 minutes for 2 million spins |
| `mc-slots.js` | Pharaoh's Fortune, Neon Overdrive | simulation of "chance to win anything" | about 1.5 minutes |
| `closed-form.js` | SKYFALL, Tiger Clash, Roulette | exact formulas | instant |

Run any of them with `node <script>` from this folder.

**Important**

- The settings at the top of each script (symbol weights, clump, house edge, ...) must match the game's `*.config.ts` in `src/modules/game-engine/engines/`. If you change a setting in the game, change it here too and re-run to get the new return.
- These scripts were **not** run against the server code. They are a second, independent statement of the same rules. Before relying on any figure for a real decision, also run a very large number of rounds through the real engine and compare.
- Simulations give an estimate with a margin of error; exact scripts give the exact value for the stated settings.
