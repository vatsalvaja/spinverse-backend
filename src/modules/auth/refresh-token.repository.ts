import { Injectable } from '@nestjs/common';
import { RefreshToken } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateRefreshTokenData } from './interfaces/auth-session.interface';

@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateRefreshTokenData): Promise<RefreshToken> {
    return this.prisma.refreshToken.create({ data });
  }

  findByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  /**
   * Atomically revokes `currentId` and stores its replacement.
   * Returns `null` (and stores nothing) if `currentId` was already revoked,
   * which means two requests raced to use the same token.
   */
  rotate(currentId: string, next: CreateRefreshTokenData): Promise<RefreshToken | null> {
    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.refreshToken.updateMany({
        where: { id: currentId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (count === 0) return null;
      return tx.refreshToken.create({ data: next });
    });
  }

  /** Revokes every still-active token of a login session. */
  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
