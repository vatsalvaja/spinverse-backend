import { Injectable } from '@nestjs/common';
import { GameSessionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { JsonObject } from './interfaces/game-engine.interface';
import { SessionWithGame } from './interfaces/game-session.interface';

const WITH_GAME = { game: { select: { gameId: true } } } satisfies Prisma.GameSessionInclude;

@Injectable()
export class GameSessionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<SessionWithGame | null> {
    return this.prisma.gameSession.findUnique({ where: { id }, include: WITH_GAME });
  }

  /** The player's current session for a game (`gameRowId` is the game's uuid), if any. */
  findActive(userId: string, gameRowId: string): Promise<SessionWithGame | null> {
    return this.prisma.gameSession.findFirst({
      where: { userId, gameId: gameRowId, status: GameSessionStatus.ACTIVE },
      orderBy: { lastActivityAt: 'desc' },
      include: WITH_GAME,
    });
  }

  create(userId: string, gameRowId: string, state: JsonObject): Promise<SessionWithGame> {
    return this.prisma.gameSession.create({
      data: { userId, gameId: gameRowId, state: state as Prisma.InputJsonObject },
      include: WITH_GAME,
    });
  }

  end(id: string, status: typeof GameSessionStatus.CLOSED | typeof GameSessionStatus.EXPIRED): Promise<SessionWithGame> {
    return this.prisma.gameSession.update({
      where: { id },
      data: { status, endedAt: new Date() },
      include: WITH_GAME,
    });
  }
}
