import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AUTH_CONFIG_KEY, AuthConfig } from '../../config/auth.config';

@Injectable()
export class PasswordService {
  private readonly saltRounds: number;
  private dummyHash?: Promise<string>;

  constructor(configService: ConfigService) {
    this.saltRounds = configService.getOrThrow<AuthConfig>(AUTH_CONFIG_KEY).bcryptSaltRounds;
  }

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Spends the same time as a real comparison. Used when the e-mail is unknown so
   * response timing does not reveal which e-mails are registered.
   */
  async compareWithDummy(password: string): Promise<void> {
    this.dummyHash ??= this.hash('spinverse-timing-equaliser');
    await this.compare(password, await this.dummyHash);
  }
}
