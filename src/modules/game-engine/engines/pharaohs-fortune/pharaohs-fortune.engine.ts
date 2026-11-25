import {
  GameEngine,
  JsonObject,
  PreparedBet,
  RoundStep,
  SeedRevealPolicy,
  StartRoundInput,
} from '../../interfaces/game-engine.interface';
import { asObject, asOneOf, readNumber } from '../shared/engine-helpers';
import {
  BET_STEPS,
  FREE_SPIN_SYMBOL_WEIGHTS,
  JACKPOT_MULTIPLIER,
  PAYLINES,
  PAYTABLE,
  PayingSymbol,
  PHARAOH_ENGINE_VERSION,
  PHARAOH_GAME_ID,
  REELS,
  ROWS,
  SCATTER_REWARDS,
  SYMBOL_ORDER,
  SYMBOL_WEIGHTS,
  SymbolId,
  WIN_LEVELS,
} from './pharaohs-fortune.config';

interface LineWin {
  /** Index into PAYLINES (0-based). */
  line: number;
  symbol: SymbolId;
  count: 3 | 4 | 5;
  multiplier: number;
}

/**
 * Which paylines does this grid complete? Rules of the existing game: a line pays from the first reel
 * to the right; the Pharaoh substitutes for every symbol except the Scarab; a line that starts with a
 * Scarab, or whose first non-Pharaoh symbol is a Scarab, pays nothing; five Pharaohs pay the jackpot.
 * `rows[row][reel]`.
 */
export function evaluateLines(rows: SymbolId[][]): LineWin[] {
  const wins: LineWin[] = [];
  PAYLINES.forEach((payline, line) => {
    const symbols = payline.map((row, reel) => rows[row][reel]);
    if (symbols[0] === 'scarab') return;
    if (symbols.every((symbol) => symbol === 'pharaoh')) {
      wins.push({ line, symbol: 'pharaoh', count: 5, multiplier: JACKPOT_MULTIPLIER });
      return;
    }
    const base = symbols.find((symbol) => symbol !== 'pharaoh');
    if (!base || base === 'scarab') return;

    let count = 0;
    for (const symbol of symbols) {
      if (symbol === base || symbol === 'pharaoh') count++;
      else break;
    }
    if (count >= 3) {
      wins.push({ line, symbol: base, count: count as 3 | 4 | 5, multiplier: PAYTABLE[base as PayingSymbol][count - 3] });
    }
  });
  return wins;
}

function scatterReward(scatters: number): { multiplier: number; freeSpins: number } | null {
  if (scatters >= 4) return SCATTER_REWARDS[4];
  if (scatters === 3) return SCATTER_REWARDS[3];
  return null;
}

function levelFor(multiplier: number, jackpot: boolean): string {
  if (jackpot) return 'jackpot';
  return WIN_LEVELS.find((entry) => multiplier >= entry.from)?.level ?? 'none';
}

/**
 * Pharaoh's Fortune: a 5x3 slot with five paylines, a Pharaoh wild and a Golden Scarab scatter.
 * Three or more scarabs pay a prize and start free spins; free spins cost nothing, cannot be
 * triggered again, and play with the bet that started them.
 */
export class PharaohsFortuneEngine implements GameEngine {
  readonly gameId = PHARAOH_GAME_ID;
  readonly engineVersion = PHARAOH_ENGINE_VERSION;
  readonly seedRevealPolicy: SeedRevealPolicy = 'ON_SETTLE';

  describeRules(): JsonObject {
    return {
      bet: '{ "bet": 50 }  (ignored during free spins)',
      betSteps: BET_STEPS,
      grid: `${REELS} reels x ${ROWS} rows`,
      paylines: PAYLINES,
      paytable: PAYTABLE,
      jackpotMultiplier: JACKPOT_MULTIPLIER,
      scatterRewards: SCATTER_REWARDS,
    };
  }

  createSessionState(): JsonObject {
    return { freeSpinsLeft: 0, freeBet: 0, bonusTotal: 0 };
  }

  describeSession(sessionState: JsonObject): JsonObject {
    return {
      freeSpinsLeft: readNumber(sessionState, 'freeSpinsLeft'),
      freeBet: readNumber(sessionState, 'freeBet'),
      bonusTotal: readNumber(sessionState, 'bonusTotal'),
    };
  }

  prepareBet(rawBet: unknown, sessionState: JsonObject): PreparedBet {
    const freeLeft = readNumber(sessionState, 'freeSpinsLeft');
    if (freeLeft > 0) {
      // A free spin costs nothing and uses the bet that triggered the bonus.
      return { stake: 0, bet: { bet: readNumber(sessionState, 'freeBet'), freeSpin: true } };
    }
    const body = asObject(rawBet);
    const bet = asOneOf(body.bet, 'The bet', BET_STEPS);
    return { stake: bet, bet: { bet, freeSpin: false } };
  }

  startRound({ bet, sessionState, rng }: StartRoundInput): RoundStep {
    const amount = bet.bet as number;
    const freeSpin = bet.freeSpin === true;
    const weights = freeSpin ? FREE_SPIN_SYMBOL_WEIGHTS : SYMBOL_WEIGHTS;

    // Draw the 15 cells, row by row.
    const rows: SymbolId[][] = [];
    for (let row = 0; row < ROWS; row++) {
      const cells: SymbolId[] = [];
      for (let reel = 0; reel < REELS; reel++) cells.push(SYMBOL_ORDER[rng.weighted(weights)]);
      rows.push(cells);
    }

    const lineWins = evaluateLines(rows);
    const lineMultiplier = lineWins.reduce((sum, win) => sum + win.multiplier, 0);
    const linePayout = lineMultiplier * amount;
    const scatters = rows.flat().filter((symbol) => symbol === 'scarab').length;
    const reward = freeSpin ? null : scatterReward(scatters);
    const scatterPrize = reward ? reward.multiplier * amount : 0;
    const totalPayout = linePayout + scatterPrize;

    // Free-spin bookkeeping carried to the next round.
    let freeSpinsLeft = readNumber(sessionState, 'freeSpinsLeft');
    let freeBet = readNumber(sessionState, 'freeBet');
    let bonusTotal = readNumber(sessionState, 'bonusTotal');
    let bonusComplete = false;
    let freeSpinsAwarded = 0;

    if (freeSpin) {
      freeSpinsLeft -= 1;
      bonusTotal += linePayout;
      if (freeSpinsLeft === 0) bonusComplete = true;
    } else if (reward) {
      freeSpinsAwarded = reward.freeSpins;
      freeSpinsLeft = reward.freeSpins;
      freeBet = amount;
      bonusTotal = scatterPrize;
    }
    const finishedBonusTotal = bonusTotal;
    if (bonusComplete) {
      freeBet = 0;
      bonusTotal = 0;
    }

    return {
      status: 'SETTLED',
      credit: totalPayout,
      result: {
        rows,
        lineWins: lineWins.map((win) => ({ ...win, line: win.line + 1, payout: win.multiplier * amount })),
        scatters,
        scatterPrize,
        linePayout,
        totalPayout,
        level: levelFor(lineMultiplier, lineWins.some((win) => win.symbol === 'pharaoh')),
        freeSpin,
        freeSpinsAwarded,
        freeSpinsLeft,
        bonusComplete,
        bonusTotal: freeSpin || freeSpinsAwarded > 0 ? finishedBonusTotal : 0,
      },
      roundState: {},
      sessionState: { freeSpinsLeft, freeBet, bonusTotal },
    };
  }
}
