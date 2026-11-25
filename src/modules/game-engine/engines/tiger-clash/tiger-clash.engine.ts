import {
  GameEngine,
  JsonObject,
  PreparedBet,
  Rng,
  RoundStep,
  SeedRevealPolicy,
  StartRoundInput,
} from '../../interfaces/game-engine.interface';
import { EngineRuleError } from '../shared/engine-rule-error';
import { asInteger, asObject, round2 } from '../shared/engine-helpers';
import {
  MAX_RANK,
  MAX_STAKE,
  MIN_RANK,
  MIN_STAKE,
  PAYOUT,
  SIDES,
  SUITS,
  Side,
  TIGER_CLASH_ENGINE_VERSION,
  TIGER_CLASH_GAME_ID,
} from './tiger-clash.config';

interface Card {
  /** e.g. `14S` = ace of spades. */
  id: string;
  rank: number;
  suit: string;
}

const parseCard = (id: string): Card => ({ id, rank: Number(id.slice(0, -1)), suit: id.slice(-1) });

function freshDeck(): string[] {
  const deck: string[] = [];
  for (const suit of SUITS) for (let rank = MIN_RANK; rank <= MAX_RANK; rank++) deck.push(`${rank}${suit}`);
  return deck;
}

const compare = (tiger: Card, dragon: Card): Side =>
  tiger.rank > dragon.rank ? 'tiger' : tiger.rank < dragon.rank ? 'dragon' : 'tie';

/** What a bet returns to the player (not net): 0 for a loss. */
export function payoutFor(pick: Side, stake: number, winner: Side): number {
  if (pick === winner) return round2(stake * (pick === 'tie' ? PAYOUT.tie : PAYOUT.win));
  if (winner === 'tie') return round2(stake * PAYOUT.tieSurrender); // Tiger / Dragon bets lose half when the cards tie
  return 0;
}

/** Shuffles a new 52-card deck with the round's secure random stream. */
function shuffledDeck(rng: Rng): string[] {
  return rng.shuffle(freshDeck());
}

/**
 * TIGER CLASH. One card for Tiger and one for Dragon are dealt from a shuffled 52-card deck; the higher
 * rank wins and equal ranks are a Tie. The cards are drawn first and never look at the player's pick.
 *
 * As in the existing game, the deck is kept between rounds of a session and only reshuffled when fewer
 * than two cards are left. The remaining deck is private session state: it is never sent to the player.
 */
export class TigerClashEngine implements GameEngine {
  readonly gameId = TIGER_CLASH_GAME_ID;
  readonly engineVersion = TIGER_CLASH_ENGINE_VERSION;
  /** The seed of a reshuffling round determines the order of the next ~25 rounds, so it stays secret until the session ends. */
  readonly seedRevealPolicy: SeedRevealPolicy = 'ON_SESSION_END';

  describeRules(): JsonObject {
    return {
      bet: '{ "side": "tiger" | "dragon" | "tie", "stake": 50 }',
      minStake: MIN_STAKE,
      maxStake: MAX_STAKE,
      payouts: PAYOUT,
      deck: '52 cards, kept between rounds and reshuffled when fewer than 2 remain',
    };
  }

  createSessionState(): JsonObject {
    return { deck: [] }; // an empty deck is shuffled on the first round
  }

  describeSession(sessionState: JsonObject): JsonObject {
    return { cardsLeftInDeck: this.deckOf(sessionState).length };
  }

  prepareBet(rawBet: unknown): PreparedBet {
    const body = asObject(rawBet);
    const side = body.side;
    if (typeof side !== 'string' || !(SIDES as readonly string[]).includes(side)) {
      throw new EngineRuleError('Choose Tiger, Dragon or Tie first.');
    }
    const stake = asInteger(body.stake, 'The stake', MIN_STAKE, MAX_STAKE);
    return { stake, bet: { side, stake } };
  }

  startRound({ bet, sessionState, rng }: StartRoundInput): RoundStep {
    const side = bet.side as Side;
    const stake = bet.stake as number;

    let deck = this.deckOf(sessionState);
    let reshuffled = false;
    if (deck.length < 2) {
      deck = shuffledDeck(rng);
      reshuffled = true;
    }

    // Two distinct cards off the top of the same deck, drawn before the pick is looked at.
    const tigerCard = parseCard(deck.pop() as string);
    const dragonCard = parseCard(deck.pop() as string);

    const winner = compare(tigerCard, dragonCard);
    const payout = payoutFor(side, stake, winner);

    return {
      status: 'SETTLED',
      credit: payout,
      result: {
        tiger: tigerCard,
        dragon: dragonCard,
        winner,
        pick: side,
        stake,
        payout,
        net: round2(payout - stake),
        cardsLeftInDeck: deck.length,
        reshuffled,
      },
      roundState: {},
      sessionState: { deck },
    };
  }

  private deckOf(sessionState: JsonObject): string[] {
    const deck = sessionState.deck;
    return Array.isArray(deck) ? (deck.filter((card) => typeof card === 'string') as string[]).slice() : [];
  }
}
