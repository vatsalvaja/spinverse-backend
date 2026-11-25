import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ENGINE_ERRORS, GAME_ENGINES } from './constants/game-engine.constants';
import type { GameEngine } from './interfaces/game-engine.interface';

/** Looks up the algorithm for a catalog game by its `gameId`. */
@Injectable()
export class GameEngineRegistry {
  private readonly engines: Map<string, GameEngine>;

  constructor(@Inject(GAME_ENGINES) engines: GameEngine[]) {
    this.engines = new Map(engines.map((engine) => [engine.gameId, engine]));
  }

  /** The engine for `gameId`, or 404 when the game exists in the catalog but has no algorithm yet. */
  get(gameId: string): GameEngine {
    const engine = this.engines.get(gameId);
    if (!engine) throw new NotFoundException(ENGINE_ERRORS.NO_ENGINE);
    return engine;
  }

  list(): GameEngine[] {
    return Array.from(this.engines.values());
  }
}
