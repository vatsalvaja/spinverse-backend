import { GameEngine } from '../interfaces/game-engine.interface';
import { AtlantisCascadeEngine } from './atlantis-cascade/atlantis-cascade.engine';
import { NeonOverdriveEngine } from './neon-overdrive/neon-overdrive.engine';
import { PharaohsFortuneEngine } from './pharaohs-fortune/pharaohs-fortune.engine';
import { RouletteEngine } from './roulette/roulette.engine';
import { SkyfallEngine } from './skyfall/skyfall.engine';
import { TigerClashEngine } from './tiger-clash/tiger-clash.engine';

/**
 * Every game algorithm the server can run, one entry per game. To add KENO, HI-LO, PACHINKO or any
 * future game: implement `GameEngine` in `engines/<game>/` and add it here. Engine ids are matched to
 * catalog games by `gameId`, so no other code needs to know the game exists.
 */
export const createGameEngines = (): GameEngine[] => [
  new PharaohsFortuneEngine(),
  new AtlantisCascadeEngine(),
  new NeonOverdriveEngine(),
  new SkyfallEngine(),
  new TigerClashEngine(),
  new RouletteEngine(),
];
