import {
  GameEngine,
  JsonObject,
  PreparedBet,
  RoundStep,
  SeedRevealPolicy,
  StartRoundInput,
} from '../../interfaces/game-engine.interface';
import { asObject, asOneOf } from '../shared/engine-helpers';
import {
  BET_STEPS,
  CELLS,
  GRAND_BONUS,
  HOLD_TRIGGER,
  NEON_ENGINE_VERSION,
  NEON_GAME_ID,
  ORB_VALUES,
  ORB_VALUE_WEIGHTS,
  OVERDRIVE_AT,
  OVERDRIVE_MULTIPLIER,
  PAYLINES,
  PAYS,
  PaySymbol,
  REELS,
  RESPIN_CORE_CHANCE,
  ROWS,
  START_RESPINS,
  SYMBOL_ORDER,
  SYMBOL_WEIGHTS,
  SymbolId,
  levelOf,
} from './neon-overdrive.config';

interface LineWin {
  /** Index into PAYLINES (0-based). */
  line: number;
  symbol: PaySymbol;
  count: number;
  multiplier: number;
}

interface Core {
  reel: number;
  row: number;
  value: number;
}

/**
 * Which paylines does this grid complete? Rules of the existing game: a line pays from the first reel to the
 * right, an Overdrive Core breaks a line, the Arc Reactor substitutes for every paying symbol, and a line made
 * only of reactors pays as reactors. `grid[reel][row]`.
 */
export function evaluateLines(grid: SymbolId[][]): LineWin[] {
  const wins: LineWin[] = [];
  PAYLINES.forEach((rows, line) => {
    let base: PaySymbol | null = null;
    let count = 0;
    for (let reel = 0; reel < REELS; reel++) {
      const symbol = grid[reel][rows[reel]];
      if (symbol === 'orb') break;
      if (symbol !== 'reactor') {
        if (base && symbol !== base) break;
        base = symbol;
      }
      count++;
    }
    if (count >= 3) {
      const paying: PaySymbol = base ?? 'reactor';
      wins.push({ line, symbol: paying, count, multiplier: PAYS[paying][count - 3] });
    }
  });
  return wins;
}

/**
 * Neon Overdrive: a 5x4 slot with 12 paylines, an Arc Reactor wild and Overdrive Cores. Six or more cores
 * anywhere start Hold & Respin: the cores lock, every empty cell respins up to three times (the counter
 * resets whenever a core lands), and the feature ends when the grid is full or the respins run out. Ten or
 * more locked cores engage OVERDRIVE (every core pays double); a full grid also pays the Grand bonus.
 * The whole feature is played inside one round.
 */
export class NeonOverdriveEngine implements GameEngine {
  readonly gameId = NEON_GAME_ID;
  readonly engineVersion = NEON_ENGINE_VERSION;
  readonly seedRevealPolicy: SeedRevealPolicy = 'ON_SETTLE';

  describeRules(): JsonObject {
    return {
      bet: '{ "bet": 50 }',
      betSteps: BET_STEPS,
      grid: `${REELS} reels x ${ROWS} rows`,
      paylines: PAYLINES,
      paytable: PAYS,
      holdAndRespin: {
        triggerCores: HOLD_TRIGGER,
        startRespins: START_RESPINS,
        overdriveAtCores: OVERDRIVE_AT,
        overdriveMultiplier: OVERDRIVE_MULTIPLIER,
        grandBonusMultiplier: GRAND_BONUS,
      },
    };
  }

  createSessionState(): JsonObject {
    return {};
  }

  describeSession(): JsonObject {
    return {};
  }

  prepareBet(rawBet: unknown): PreparedBet {
    const body = asObject(rawBet);
    const bet = asOneOf(body.bet, 'The bet', BET_STEPS);
    return { stake: bet, bet: { bet } };
  }

  startRound({ bet, rng }: StartRoundInput): RoundStep {
    const amount = bet.bet as number;

    // 1. The base grid, reel by reel. Cores carry a point value.
    const grid: SymbolId[][] = [];
    const cores: Core[] = [];
    for (let reel = 0; reel < REELS; reel++) {
      const column: SymbolId[] = [];
      for (let row = 0; row < ROWS; row++) {
        const symbol = SYMBOL_ORDER[rng.weighted(SYMBOL_WEIGHTS)];
        column.push(symbol);
        if (symbol === 'orb') cores.push({ reel, row, value: ORB_VALUES[rng.weighted(ORB_VALUE_WEIGHTS)] });
      }
      grid.push(column);
    }

    // 2. Line wins of the base spin.
    const lineWins = evaluateLines(grid);
    const lineMultiple = lineWins.reduce((sum, win) => sum + win.multiplier, 0);
    const baseWin = Math.round(lineMultiple * amount);

    // 3. Hold & Respin.
    let bonus: JsonObject | null = null;
    let bonusTotal = 0;
    if (cores.length >= HOLD_TRIGGER) {
      const locked = new Map<string, Core>(cores.map((core) => [`${core.reel}:${core.row}`, core]));
      const respins: Core[][] = [];
      let respinsLeft = START_RESPINS;

      while (locked.size < CELLS && respinsLeft > 0) {
        const landed: Core[] = [];
        for (let reel = 0; reel < REELS; reel++) {
          for (let row = 0; row < ROWS; row++) {
            if (locked.has(`${reel}:${row}`)) continue;
            if (rng.chance(RESPIN_CORE_CHANCE.numerator, RESPIN_CORE_CHANCE.denominator)) {
              landed.push({ reel, row, value: ORB_VALUES[rng.weighted(ORB_VALUE_WEIGHTS)] });
            }
          }
        }
        landed.forEach((core) => locked.set(`${core.reel}:${core.row}`, core));
        respins.push(landed);
        respinsLeft = landed.length > 0 ? START_RESPINS : respinsLeft - 1;
      }

      const lockedCores = Array.from(locked.values());
      const overdrive = lockedCores.length >= OVERDRIVE_AT;
      const full = lockedCores.length >= CELLS;
      const corePoints = lockedCores.reduce(
        (sum, core) => sum + Math.round(core.value * (overdrive ? OVERDRIVE_MULTIPLIER : 1) * amount),
        0,
      );
      const grandBonus = full ? GRAND_BONUS * amount : 0;
      bonusTotal = corePoints + grandBonus;

      bonus = {
        triggeredBy: cores,
        respins,
        lockedCores,
        overdrive,
        full,
        corePoints,
        grandBonus,
        total: bonusTotal,
        level: levelOf(bonusTotal / amount),
      };
    }

    const totalPayout = baseWin + bonusTotal;
    return {
      status: 'SETTLED',
      credit: totalPayout,
      result: {
        grid,
        cores,
        lineWins: lineWins.map((win) => ({ ...win, line: win.line + 1, payout: Math.round(win.multiplier * amount) })),
        baseWin,
        bonus,
        totalPayout,
        level: levelOf(totalPayout / amount),
      },
      roundState: {},
      sessionState: {},
    };
  }
}
