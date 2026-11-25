import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { WALLET_ERRORS } from './constants/demo-wallet.constants';

/** The wallet cannot cover the debit. */
export class InsufficientBalanceError extends Error {
  constructor() {
    super(WALLET_ERRORS.INSUFFICIENT);
    this.name = 'InsufficientBalanceError';
  }
}

/** The wallet is SUSPENDED. */
export class WalletSuspendedError extends Error {
  constructor() {
    super(WALLET_ERRORS.SUSPENDED);
    this.name = 'WalletSuspendedError';
  }
}

export class WalletNotFoundError extends Error {
  constructor() {
    super(WALLET_ERRORS.NOT_FOUND);
    this.name = 'WalletNotFoundError';
  }
}

/** The user does not exist or is not active, so no wallet may be created. */
export class WalletNotEligibleError extends Error {
  constructor(readonly reason: 'not_found' | 'inactive') {
    super(reason === 'not_found' ? WALLET_ERRORS.USER_NOT_FOUND : WALLET_ERRORS.NOT_ELIGIBLE);
    this.name = 'WalletNotEligibleError';
  }
}

/** The idempotency key exists but belongs to a different operation (other user, type or amount). */
export class IdempotencyConflictError extends Error {
  constructor() {
    super(WALLET_ERRORS.IDEMPOTENCY_CONFLICT);
    this.name = 'IdempotencyConflictError';
  }
}

export class InvalidAmountError extends Error {
  constructor() {
    super(WALLET_ERRORS.INVALID_AMOUNT);
    this.name = 'InvalidAmountError';
  }
}

/** Turns a wallet domain error into the matching HTTP error; returns undefined for anything else. */
export function mapWalletError(error: unknown): HttpException | undefined {
  if (error instanceof InsufficientBalanceError) return new ConflictException(error.message);
  if (error instanceof IdempotencyConflictError) return new ConflictException(error.message);
  if (error instanceof WalletSuspendedError) return new ForbiddenException(error.message);
  if (error instanceof WalletNotFoundError) return new NotFoundException(error.message);
  if (error instanceof WalletNotEligibleError) {
    return error.reason === 'not_found' ? new NotFoundException(error.message) : new ForbiddenException(error.message);
  }
  if (error instanceof InvalidAmountError) return new BadRequestException(error.message);
  return undefined;
}
