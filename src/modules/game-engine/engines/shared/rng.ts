import { createHash, createHmac, randomBytes } from 'node:crypto';
import { Rng } from '../../interfaces/game-engine.interface';

/** A fresh, cryptographically secure 256-bit seed (hex) from the operating system. */
export function createRoundSeed(): string {
  return randomBytes(32).toString('hex');
}

/**
 * The public commitment to a seed: SHA-256 of the seed's 32 bytes, as hex. It is shown when the
 * round starts and the seed is revealed later, so anyone can check the seed was not swapped:
 * sha256(hex-decode(seed)) must equal the commitment.
 */
export function seedCommitment(seedHex: string): string {
  return createHash('sha256').update(Buffer.from(seedHex, 'hex')).digest('hex');
}

/**
 * Deterministic random stream derived from a secret seed with HMAC-SHA256 in counter mode:
 * block i = HMAC-SHA256(seed, i as 8-byte big-endian). The seed comes from the OS secure random
 * source, so the stream is unpredictable to anyone who does not know it, and the same seed always
 * reproduces the same stream (which is what makes a round auditable).
 */
export class SeededRng implements Rng {
  private readonly key: Buffer;
  private counter = 0;
  private block: Buffer = Buffer.alloc(0);
  private offset = 0;
  private drawCount = 0;

  constructor(seedHex: string) {
    this.key = Buffer.from(seedHex, 'hex');
  }

  get draws(): number {
    return this.drawCount;
  }

  /** Next 32 random bits. */
  private nextUint32(): number {
    if (this.offset + 4 > this.block.length) {
      const counter = Buffer.alloc(8);
      counter.writeBigUInt64BE(BigInt(this.counter++));
      this.block = createHmac('sha256', this.key).update(counter).digest();
      this.offset = 0;
    }
    const value = this.block.readUInt32BE(this.offset);
    this.offset += 4;
    return value;
  }

  int(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > 0x100000000) {
      throw new RangeError(`int() needs an integer between 1 and 2^32, got ${maxExclusive}`);
    }
    this.drawCount++;
    if (maxExclusive === 1) return 0;
    // Rejection sampling: discard the few values that would make some results more likely than others.
    const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
    let value: number;
    do {
      value = this.nextUint32();
    } while (value >= limit);
    return value % maxExclusive;
  }

  float(): number {
    this.drawCount++;
    const high = this.nextUint32() >>> 5; // 27 bits
    const low = this.nextUint32() >>> 6; // 26 bits
    return (high * 67108864 + low) / 9007199254740992; // / 2^53
  }

  chance(numerator: number, denominator: number): boolean {
    return this.int(denominator) < numerator;
  }

  weighted(weights: readonly number[]): number {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let pick = this.int(total);
    for (let index = 0; index < weights.length; index++) {
      pick -= weights[index];
      if (pick < 0) return index;
    }
    return weights.length - 1; // unreachable for positive integer weights
  }

  shuffle<T>(items: readonly T[]): T[] {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
}
