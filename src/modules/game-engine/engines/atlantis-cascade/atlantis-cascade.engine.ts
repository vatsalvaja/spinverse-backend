import {
  GameEngine,
  JsonObject,
  PreparedBet,
  Rng,
  RoundStep,
  SeedRevealPolicy,
  StartRoundInput,
} from '../../interfaces/game-engine.interface';
import { asObject, asOneOf, readNumber } from '../shared/engine-helpers';
import {
  ATLANTIS_ENGINE_VERSION,
  ATLANTIS_GAME_ID,
  BASE_MULTIPLIER_CAP,
  BET_STEPS,
  CLUMP_PPM,
  COLS,
  FREE_MULTIPLIER_CAP,
  FREE_SPINS_TRIGGER,
  MAX_CASCADES,
  MIN_CLUSTER,
  PAY,
  PAYING_ORDER,
  PPM,
  PayingSymbol,
  ROWS,
  SCATTER_PPM,
  SYMBOL_ORDER,
  SYMBOL_WEIGHTS,
  SymbolId,
  WILD_PPM,
  freeSpinsFor,
  tierOf,
} from './atlantis-cascade.config';

type Grid = SymbolId[][]; // grid[col][row], row 0 is the top
type Cell = [number, number]; // [col, row]

interface Cluster {
  symbol: PayingSymbol;
  cells: Cell[];
  size: number;
  /** Pay in multiples of the bet, before any cascade multiplier. */
  pay: number;
}

const DIRECTIONS: Cell[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const bucketOf = (size: number): number => (size >= 15 ? 4 : size >= 12 ? 3 : size >= 9 ? 2 : size >= 7 ? 1 : 0);

/**
 * Finds the paying clusters of a grid: groups of at least MIN_CLUSTER touching cells (up, down, left,
 * right) of one symbol, where a Wild counts as that symbol. A Wild belongs to at most one cluster; a Wild
 * that did not help a cluster stays free for another symbol. Symbols are tried from the most valuable.
 */
export function findClusters(grid: Grid): Cluster[] {
  const clusters: Cluster[] = [];
  const claimedWilds = new Set<string>();

  for (const symbol of PAYING_ORDER) {
    const seen = new Set<string>();
    for (let col = 0; col < COLS; col++) {
      for (let row = 0; row < ROWS; row++) {
        const startKey = `${col}:${row}`;
        if (grid[col][row] !== symbol || seen.has(startKey)) continue;

        const cells: Cell[] = [];
        const stack: Cell[] = [[col, row]];
        const wilds: string[] = [];
        seen.add(startKey);

        while (stack.length > 0) {
          const [x, y] = stack.pop() as Cell;
          cells.push([x, y]);
          for (const [dx, dy] of DIRECTIONS) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
            const key = `${nx}:${ny}`;
            if (seen.has(key)) continue;
            const neighbour = grid[nx][ny];
            if (neighbour === symbol || (neighbour === 'wild' && !claimedWilds.has(key))) {
              seen.add(key);
              if (neighbour === 'wild') wilds.push(key);
              stack.push([nx, ny]);
            }
          }
        }

        if (cells.length >= MIN_CLUSTER) {
          wilds.forEach((key) => claimedWilds.add(key));
          clusters.push({ symbol, cells, size: cells.length, pay: PAY[symbol][bucketOf(cells.length)] });
        } else {
          wilds.forEach((key) => seen.delete(key)); // a Wild that made no cluster stays free
        }
      }
    }
  }
  return clusters;
}

/** One new symbol: a Wild, or a copy of a neighbour, or a draw from the symbol weights. */
function pickSymbol(rng: Rng, neighbours: (SymbolId | undefined)[]): SymbolId {
  if (rng.chance(WILD_PPM, PPM)) return 'wild';
  const copyable = neighbours.filter((s): s is PayingSymbol => !!s && s !== 'wild' && s !== 'scatter');
  if (copyable.length > 0 && rng.chance(CLUMP_PPM, PPM)) return copyable[rng.int(copyable.length)];
  return SYMBOL_ORDER[rng.weighted(SYMBOL_WEIGHTS)];
}

/**
 * Atlantis Cascade: a 6x5 cluster-pay game. A spin drops a board; every cluster of 5+ pays and vanishes,
 * new symbols tumble in, and the process repeats while new clusters appear. In the base game the multiplier
 * rises x1, x2, x3 ... (max x10) with each cascade. Four or more Scatters start free spins, which cost
 * nothing and carry a multiplier that grows by one for every winning cascade (max x25).
 */
export class AtlantisCascadeEngine implements GameEngine {
  readonly gameId = ATLANTIS_GAME_ID;
  readonly engineVersion = ATLANTIS_ENGINE_VERSION;
  readonly seedRevealPolicy: SeedRevealPolicy = 'ON_SETTLE';

  describeRules(): JsonObject {
    return {
      bet: '{ "bet": 50 }  (ignored during free spins)',
      betSteps: BET_STEPS,
      grid: `${COLS} columns x ${ROWS} rows`,
      minCluster: MIN_CLUSTER,
      paytable: PAY,
      baseMultiplierCap: BASE_MULTIPLIER_CAP,
      freeMultiplierCap: FREE_MULTIPLIER_CAP,
      freeSpinsTrigger: `${FREE_SPINS_TRIGGER}+ scatters`,
    };
  }

  createSessionState(): JsonObject {
    return { freeSpinsLeft: 0, freeBet: 0, freeMultiplier: 1, freeTotal: 0 };
  }

  describeSession(sessionState: JsonObject): JsonObject {
    return {
      freeSpinsLeft: readNumber(sessionState, 'freeSpinsLeft'),
      freeBet: readNumber(sessionState, 'freeBet'),
      freeMultiplier: readNumber(sessionState, 'freeMultiplier', 1),
      freeTotal: readNumber(sessionState, 'freeTotal'),
    };
  }

  prepareBet(rawBet: unknown, sessionState: JsonObject): PreparedBet {
    if (readNumber(sessionState, 'freeSpinsLeft') > 0) {
      return { stake: 0, bet: { bet: readNumber(sessionState, 'freeBet'), freeSpin: true } };
    }
    const body = asObject(rawBet);
    const bet = asOneOf(body.bet, 'The bet', BET_STEPS);
    return { stake: bet, bet: { bet, freeSpin: false } };
  }

  startRound({ bet, sessionState, rng }: StartRoundInput): RoundStep {
    const amount = bet.bet as number;
    const freeSpin = bet.freeSpin === true;

    // 1. The first board. Scatters appear only here and only in the base game.
    const grid: Grid = [];
    let scatters = 0;
    for (let col = 0; col < COLS; col++) {
      const column: SymbolId[] = [];
      for (let row = 0; row < ROWS; row++) {
        if (!freeSpin && rng.chance(SCATTER_PPM, PPM)) {
          column.push('scatter');
          scatters++;
        } else {
          column.push(pickSymbol(rng, [col > 0 ? grid[col - 1][row] : undefined, row > 0 ? column[row - 1] : undefined]));
        }
      }
      grid.push(column);
    }
    const initial = grid.map((column) => column.slice());

    // 2. Cascades.
    let current = grid;
    let multiplierCounter = freeSpin ? Math.max(1, readNumber(sessionState, 'freeMultiplier', 1)) : 0;
    let totalMultiple = 0;
    let payout = 0;
    const steps: JsonObject[] = [];

    for (let index = 0; index < MAX_CASCADES; index++) {
      const clusters = findClusters(current);
      if (clusters.length === 0) break;

      const multiplier = freeSpin ? Math.min(FREE_MULTIPLIER_CAP, multiplierCounter) : Math.min(BASE_MULTIPLIER_CAP, index + 1);
      const paid = clusters.map((cluster) => {
        const clusterPayout = Math.round(cluster.pay * multiplier * amount); // rounded per cluster, like the existing game
        totalMultiple += cluster.pay * multiplier;
        payout += clusterPayout;
        return { symbol: cluster.symbol, size: cluster.size, cells: cluster.cells, pay: cluster.pay, multiplier, payout: clusterPayout };
      });

      const gone = new Set(clusters.flatMap((cluster) => cluster.cells.map(([c, r]) => `${c}:${r}`)));
      const next: Grid = [];
      const fills: SymbolId[][] = [];
      for (let col = 0; col < COLS; col++) {
        const survivors = current[col].filter((_, row) => !gone.has(`${col}:${row}`));
        const fill: SymbolId[] = [];
        for (let j = 0; j < ROWS - survivors.length; j++) {
          fill.push(pickSymbol(rng, [col > 0 ? next[col - 1][j] : undefined, j > 0 ? fill[j - 1] : undefined]));
        }
        fills.push(fill.slice());
        next.push(fill.concat(survivors));
      }

      steps.push({ clusters: paid, fills });
      multiplierCounter++;
      current = next;
    }

    // 3. Free-spin bookkeeping.
    let freeSpinsLeft = readNumber(sessionState, 'freeSpinsLeft');
    let freeBet = readNumber(sessionState, 'freeBet');
    let freeMultiplier = readNumber(sessionState, 'freeMultiplier', 1);
    let freeTotal = readNumber(sessionState, 'freeTotal');
    let freeSpinsAwarded = 0;
    let bonusComplete = false;
    let bonusTotal = 0;

    if (freeSpin) {
      freeSpinsLeft -= 1;
      freeMultiplier = Math.min(FREE_MULTIPLIER_CAP, multiplierCounter);
      freeTotal += payout;
      bonusTotal = freeTotal;
      if (freeSpinsLeft === 0) {
        bonusComplete = true;
        freeBet = 0;
        freeMultiplier = 1;
        freeTotal = 0;
      }
    } else if (scatters >= FREE_SPINS_TRIGGER) {
      freeSpinsAwarded = freeSpinsFor(scatters);
      freeSpinsLeft = freeSpinsAwarded;
      freeBet = amount;
      freeMultiplier = 1;
      freeTotal = 0;
    }

    return {
      status: 'SETTLED',
      credit: payout,
      result: {
        initial,
        steps,
        scatters,
        totalMultiple,
        payout,
        tier: tierOf(totalMultiple),
        freeSpin,
        freeSpinsAwarded,
        freeSpinsLeft,
        freeMultiplier,
        bonusComplete,
        bonusTotal,
      },
      roundState: {},
      sessionState: { freeSpinsLeft, freeBet, freeMultiplier, freeTotal },
    };
  }
}
