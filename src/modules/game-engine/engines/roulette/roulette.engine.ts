import {
  GameEngine,
  JsonObject,
  PreparedBet,
  RoundStep,
  SeedRevealPolicy,
  StartRoundInput,
} from '../../interfaces/game-engine.interface';
import { EngineRuleError } from '../shared/engine-rule-error';
import { asInteger, asObject, round2 } from '../shared/engine-helpers';
import {
  BetType,
  CHIPS,
  MAX_BET_ENTRIES,
  MAX_PER_POSITION,
  PAYOUT,
  POCKETS,
  RED_NUMBERS,
  ROULETTE_ENGINE_VERSION,
  ROULETTE_GAME_ID,
} from './roulette.config';

type Color = 'green' | 'red' | 'black';

interface BetDefinition {
  id: string;
  type: BetType;
  numbers: number[];
  label: string;
}

interface Placement {
  id: string;
  amount: number;
}

const colorOf = (n: number): Color => (n === 0 ? 'green' : RED_NUMBERS.has(n) ? 'red' : 'black');
const range = (from: number, to: number): number[] => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const street = (n: number): number => Math.ceil(n / 3);
const sorted = (values: number[]): number[] => [...values].sort((a, b) => a - b);

/** Resolves a position id (e.g. `split:8-9`) to the numbers it covers, or null when it is not on a European layout. */
export function resolveBet(id: string): BetDefinition | null {
  const [kind, arg = ''] = id.split(':');
  const nums = arg ? arg.split('-').map(Number) : [];
  if (nums.some((n) => !Number.isInteger(n))) return null;

  switch (kind) {
    case 'straight':
      return nums.length === 1 && nums[0] >= 0 && nums[0] <= 36
        ? { id: `straight:${nums[0]}`, type: 'straight', numbers: [nums[0]], label: `Straight ${nums[0]}` }
        : null;
    case 'split': {
      if (nums.length !== 2) return null;
      const [a, b] = sorted(nums);
      const valid = a === 0 ? b >= 1 && b <= 3 : a >= 1 && b <= 36 && (b - a === 3 || (b - a === 1 && street(a) === street(b)));
      return valid ? { id: `split:${a}-${b}`, type: 'split', numbers: [a, b], label: `Split ${a}/${b}` } : null;
    }
    case 'street': {
      const a = nums[0];
      return nums.length === 1 && a >= 1 && a <= 34 && a % 3 === 1
        ? { id: `street:${a}`, type: 'street', numbers: range(a, a + 2), label: `Street ${a}-${a + 2}` }
        : null;
    }
    case 'corner': {
      const a = nums[0];
      return nums.length === 1 && a >= 1 && a <= 32 && a % 3 !== 0
        ? { id: `corner:${a}`, type: 'corner', numbers: [a, a + 1, a + 3, a + 4], label: `Corner ${a}/${a + 1}/${a + 3}/${a + 4}` }
        : null;
    }
    case 'sixline': {
      const a = nums[0];
      return nums.length === 1 && a >= 1 && a <= 31 && a % 3 === 1
        ? { id: `sixline:${a}`, type: 'sixline', numbers: range(a, a + 5), label: `Six line ${a}-${a + 5}` }
        : null;
    }
    case 'dozen': {
      const d = nums[0];
      return nums.length === 1 && d >= 1 && d <= 3
        ? { id: `dozen:${d}`, type: 'dozen', numbers: range(d * 12 - 11, d * 12), label: ['1st 12', '2nd 12', '3rd 12'][d - 1] }
        : null;
    }
    case 'column': {
      const c = nums[0];
      return nums.length === 1 && c >= 1 && c <= 3
        ? { id: `column:${c}`, type: 'column', numbers: range(1, 36).filter((n) => n % 3 === c % 3), label: `${['1st', '2nd', '3rd'][c - 1]} column` }
        : null;
    }
    case 'red':
      return { id: 'red', type: 'red', numbers: [...RED_NUMBERS], label: 'Red' };
    case 'black':
      return { id: 'black', type: 'black', numbers: range(1, 36).filter((n) => !RED_NUMBERS.has(n)), label: 'Black' };
    case 'odd':
      return { id: 'odd', type: 'odd', numbers: range(1, 36).filter((n) => n % 2 === 1), label: 'Odd' };
    case 'even':
      return { id: 'even', type: 'even', numbers: range(1, 36).filter((n) => n % 2 === 0), label: 'Even' };
    case 'low':
      return { id: 'low', type: 'low', numbers: range(1, 18), label: '1 to 18' };
    case 'high':
      return { id: 'high', type: 'high', numbers: range(19, 36), label: '19 to 36' };
    default:
      return null;
  }
}

/**
 * European Roulette. One spin per round: the player places any chips, the winning pocket is drawn
 * uniformly from the 37 pockets BEFORE the bets are looked at (the draw never reads them), and every
 * bet is settled against that number. A winning bet returns its stake plus `PAYOUT[type] x stake`.
 */
export class RouletteEngine implements GameEngine {
  readonly gameId = ROULETTE_GAME_ID;
  readonly engineVersion = ROULETTE_ENGINE_VERSION;
  readonly seedRevealPolicy: SeedRevealPolicy = 'ON_SETTLE';

  describeRules(): JsonObject {
    return {
      bet: '{ "bets": [{ "id": "straight:17", "amount": 10 }, { "id": "red", "amount": 25 }] }',
      positions: ['straight:N', 'split:A-B', 'street:A', 'corner:A', 'sixline:A', 'dozen:1-3', 'column:1-3', 'red', 'black', 'odd', 'even', 'low', 'high'],
      payouts: PAYOUT,
      maxPerPosition: MAX_PER_POSITION,
      suggestedChips: CHIPS,
      pockets: POCKETS.length,
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
    const list = body.bets;
    if (!Array.isArray(list) || list.length === 0) throw new EngineRuleError('Place at least one chip before spinning.');
    if (list.length > MAX_BET_ENTRIES) throw new EngineRuleError(`A spin can have at most ${MAX_BET_ENTRIES} chip placements.`);

    // Chips on the same position are added together (like the table does).
    const totals = new Map<string, number>();
    for (const entry of list) {
      const chip = asObject(entry, 'chip placement');
      const id = typeof chip.id === 'string' ? resolveBet(chip.id)?.id : undefined;
      if (!id) throw new EngineRuleError(`"${String(chip.id)}" is not a position on the European roulette layout.`);
      const amount = asInteger(chip.amount, 'A chip amount', 1, MAX_PER_POSITION);
      const total = (totals.get(id) ?? 0) + amount;
      if (total > MAX_PER_POSITION) throw new EngineRuleError(`That position is at the table limit of ${MAX_PER_POSITION}.`);
      totals.set(id, total);
    }

    const bets: Placement[] = Array.from(totals, ([id, amount]) => ({ id, amount }));
    const stake = round2(bets.reduce((sum, bet) => sum + bet.amount, 0));
    return { stake, bet: { bets } as unknown as JsonObject };
  }

  startRound({ bet, rng }: StartRoundInput): RoundStep {
    const placements = bet.bets as Placement[];

    // The result is drawn first and never looks at the bets.
    const winning = POCKETS[rng.int(POCKETS.length)];

    const lines = placements.map((placement) => {
      const definition = resolveBet(placement.id) as BetDefinition;
      const won = definition.numbers.includes(winning);
      const winnings = won ? round2(placement.amount * PAYOUT[definition.type]) : 0;
      return {
        id: definition.id,
        label: definition.label,
        type: definition.type,
        amount: placement.amount,
        won,
        winnings,
        returned: won ? round2(placement.amount + winnings) : 0,
      };
    });

    const totalStake = round2(lines.reduce((sum, line) => sum + line.amount, 0));
    const totalReturned = round2(lines.reduce((sum, line) => sum + line.returned, 0));

    return {
      status: 'SETTLED',
      credit: totalReturned,
      result: {
        winningNumber: winning,
        color: colorOf(winning),
        pocketIndex: POCKETS.indexOf(winning),
        lines,
        totalStake,
        totalReturned,
        net: round2(totalReturned - totalStake),
      },
      roundState: {},
      sessionState: {},
    };
  }
}
