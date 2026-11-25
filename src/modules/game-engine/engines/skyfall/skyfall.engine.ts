import {
  ActionInput,
  GameEngine,
  JsonObject,
  PreparedBet,
  ResumeRoundInput,
  Rng,
  RoundStep,
  SeedRevealPolicy,
  StartRoundInput,
} from '../../interfaces/game-engine.interface';
import { EngineRuleError } from '../shared/engine-rule-error';
import { asInteger, asObject, floor2, round2 } from '../shared/engine-helpers';
import {
  AUTO_CASHOUT_MAX,
  AUTO_CASHOUT_MIN,
  GROWTH,
  HOUSE_EDGE,
  MAX_CRASH_MULTIPLIER,
  MAX_STAKE,
  MIN_STAKE,
  PANELS,
  SKYFALL_ENGINE_VERSION,
  SKYFALL_GAME_ID,
  TAKEOFF_MS,
} from './skyfall.config';

type PanelStatus = 'ACTIVE' | 'CASHED' | 'LOST';

interface PanelBet {
  panel: number;
  stake: number;
  autoCashout: number | null;
}

interface PanelState extends PanelBet {
  status: PanelStatus;
  cashedAt: number | null;
  payout: number;
}

/** Private state of one flight. The crash point is decided when the round starts. */
interface Flight {
  crashPoint: number;
  flightStartMs: number;
  panels: PanelState[];
}

/** Seconds of flight needed to reach a multiplier. */
const timeToReach = (multiplier: number): number => Math.log(Math.max(1, multiplier)) / GROWTH;
const rawMultiplier = (seconds: number): number => Math.exp(GROWTH * Math.max(0, seconds));

/**
 * Draws the crash point. With U uniform in [0, 1), X = (1 - edge) / (1 - U) has P(X >= m) = (1 - edge) / m
 * for every m >= 1, so each cash-out target m is reached with probability (1 - edge) / m and pays m:
 * every target returns exactly (1 - edge) on average. X below 1 means an instant crash at 1.00x.
 * The result is rounded down to cents and limited to MAX_CRASH_MULTIPLIER.
 */
export function drawCrashPoint(rng: Rng): number {
  const x = (1 - HOUSE_EDGE) / (1 - rng.float());
  if (x < 1) return 1;
  return Math.min(MAX_CRASH_MULTIPLIER, floor2(x));
}

/**
 * SKYFALL (crash game). The player places up to two bets (panels 0 and 1) and the plane takes off. The
 * multiplier grows with elapsed SERVER time; the player can cash a bet out at the current multiplier, or
 * set an automatic cash-out. A bet still in the air when the plane crashes is lost. The crash point is
 * drawn at the start of the round, before anything the player does, and stays hidden until the crash.
 *
 * Time is the only thing that moves the round on: results are computed from the server clock whenever the
 * round is read or acted on, so the client's clock and display can never change an outcome.
 */
export class SkyfallEngine implements GameEngine {
  readonly gameId = SKYFALL_GAME_ID;
  readonly engineVersion = SKYFALL_ENGINE_VERSION;
  readonly seedRevealPolicy: SeedRevealPolicy = 'ON_SETTLE';

  describeRules(): JsonObject {
    return {
      bet: '{ "panels": [{ "panel": 0, "stake": 100, "autoCashout": 2.5 }, { "panel": 1, "stake": 50 }] }',
      action: '{ "type": "CASH_OUT", "panel": 0 }',
      panels: PANELS,
      minStake: MIN_STAKE,
      maxStake: MAX_STAKE,
      autoCashoutRange: [AUTO_CASHOUT_MIN, AUTO_CASHOUT_MAX],
      growthPerSecond: GROWTH,
      takeoffMs: TAKEOFF_MS,
      interactive: true,
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
    const list = body.panels;
    if (!Array.isArray(list) || list.length < 1 || list.length > PANELS.length) {
      throw new EngineRuleError(`Place a bet on 1 or ${PANELS.length} panels.`);
    }

    const panels: PanelBet[] = [];
    for (const entry of list) {
      const item = asObject(entry, 'panel bet');
      const panel = asInteger(item.panel, 'The panel', 0, PANELS.length - 1);
      if (panels.some((existing) => existing.panel === panel)) {
        throw new EngineRuleError('Each panel can only be used once per round.');
      }
      const stake = asInteger(item.stake, 'The stake', MIN_STAKE, MAX_STAKE);

      let autoCashout: number | null = null;
      if (item.autoCashout !== undefined && item.autoCashout !== null) {
        const value = item.autoCashout;
        if (typeof value !== 'number' || !Number.isFinite(value) || value < AUTO_CASHOUT_MIN || value > AUTO_CASHOUT_MAX) {
          throw new EngineRuleError(`autoCashout must be a number from ${AUTO_CASHOUT_MIN} to ${AUTO_CASHOUT_MAX}.`);
        }
        autoCashout = round2(value);
      }
      panels.push({ panel, stake, autoCashout });
    }

    const stake = round2(panels.reduce((sum, p) => sum + p.stake, 0));
    return { stake, bet: { panels } as unknown as JsonObject };
  }

  startRound({ bet, rng, now, sessionState }: StartRoundInput): RoundStep {
    const flight: Flight = {
      crashPoint: drawCrashPoint(rng),
      flightStartMs: now.getTime() + TAKEOFF_MS,
      panels: (bet.panels as PanelBet[]).map((p): PanelState => ({ ...p, status: 'ACTIVE', cashedAt: null, payout: 0 })),
    };
    return this.step(flight, now, 0, sessionState);
  }

  resolveRound({ roundState, now, sessionState }: ResumeRoundInput): RoundStep {
    const { flight, credit } = this.evaluate(roundState as unknown as Flight, now);
    return this.step(flight, now, credit, sessionState);
  }

  applyAction({ action, roundState, now, sessionState }: ActionInput): RoundStep {
    if (action.type !== 'CASH_OUT') throw new EngineRuleError('Unknown action. Use { "type": "CASH_OUT", "panel": 0 }.');
    const panelNumber = asInteger(action.panel, 'The panel', 0, PANELS.length - 1);

    // Bring the round up to date first: a plane that has already crashed pays nothing.
    const { flight, credit: automatic } = this.evaluate(roundState as unknown as Flight, now);
    const panel = flight.panels.find((p) => p.panel === panelNumber);
    if (!panel) throw new EngineRuleError('You have no bet on that panel.');
    if (panel.status === 'CASHED') throw new EngineRuleError('That bet has already been cashed out.', 'conflict');
    if (panel.status === 'LOST') return this.step(flight, now, automatic, sessionState); // crashed: nothing to cash

    const nowMs = now.getTime();
    if (nowMs < flight.flightStartMs) throw new EngineRuleError('The plane has not taken off yet.', 'conflict');

    // The plane is still flying here (evaluate would have crashed it otherwise).
    const seconds = (nowMs - flight.flightStartMs) / 1000;
    const multiplier = Math.max(1, floor2(Math.min(rawMultiplier(seconds), flight.crashPoint)));
    const payout = round2(panel.stake * multiplier);
    panel.status = 'CASHED';
    panel.cashedAt = multiplier;
    panel.payout = payout;

    return this.step(flight, now, round2(automatic + payout), sessionState);
  }

  /**
   * Applies everything the clock has decided: automatic cash-outs whose multiplier was reached
   * (they pay exactly their target), then the crash, which loses every bet still in the air.
   */
  private evaluate(state: Flight, now: Date): { flight: Flight; credit: number } {
    const flight: Flight = {
      crashPoint: state.crashPoint,
      flightStartMs: state.flightStartMs,
      panels: state.panels.map((p) => ({ ...p })),
    };
    const nowMs = now.getTime();
    const crashAtMs = flight.flightStartMs + timeToReach(flight.crashPoint) * 1000;
    let credit = 0;

    for (const panel of flight.panels) {
      if (panel.status !== 'ACTIVE') continue;
      const auto = panel.autoCashout;
      if (auto !== null && auto <= flight.crashPoint && nowMs >= flight.flightStartMs + timeToReach(auto) * 1000) {
        panel.status = 'CASHED';
        panel.cashedAt = auto;
        panel.payout = round2(panel.stake * auto);
        credit += panel.payout;
      } else if (nowMs >= crashAtMs) {
        panel.status = 'LOST';
        panel.cashedAt = null;
        panel.payout = 0;
      }
    }
    return { flight, credit: round2(credit) };
  }

  private step(flight: Flight, now: Date, credit: number, sessionState: JsonObject): RoundStep {
    const nowMs = now.getTime();
    const crashAtMs = flight.flightStartMs + timeToReach(flight.crashPoint) * 1000;
    const crashed = nowMs >= crashAtMs;
    const settled = flight.panels.every((p) => p.status !== 'ACTIVE');

    const phase = nowMs < flight.flightStartMs ? 'TAKEOFF' : crashed ? 'CRASHED' : 'FLYING';
    const multiplier =
      phase === 'TAKEOFF' ? 1 : crashed ? flight.crashPoint : floor2(rawMultiplier((nowMs - flight.flightStartMs) / 1000));

    return {
      status: settled ? 'SETTLED' : 'IN_PROGRESS',
      credit,
      result: {
        phase,
        serverTime: now.toISOString(),
        flightStartsAt: new Date(flight.flightStartMs).toISOString(),
        growthPerSecond: GROWTH,
        multiplier,
        /** Revealed only once the plane has crashed. */
        crashPoint: crashed ? flight.crashPoint : null,
        panels: flight.panels,
        totalStake: round2(flight.panels.reduce((sum, p) => sum + p.stake, 0)),
        totalPayout: round2(flight.panels.reduce((sum, p) => sum + p.payout, 0)),
      },
      roundState: flight as unknown as JsonObject,
      sessionState,
    };
  }
}
