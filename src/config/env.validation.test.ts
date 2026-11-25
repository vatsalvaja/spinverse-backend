import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateEnv } from './env.validation';

const valid = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/d',
  JWT_ACCESS_SECRET: 'a'.repeat(48),
  JWT_REFRESH_SECRET: 'b'.repeat(48),
};

describe('validateEnv', () => {
  it('applies defaults for the auth settings', () => {
    const env = validateEnv(valid);
    assert.equal(env.JWT_ACCESS_EXPIRES_IN, '15m');
    assert.equal(env.JWT_REFRESH_EXPIRES_IN, '7d');
    assert.equal(env.BCRYPT_SALT_ROUNDS, 12);
  });

  it('coerces BCRYPT_SALT_ROUNDS from a string', () => {
    assert.equal(validateEnv({ ...valid, BCRYPT_SALT_ROUNDS: '10' }).BCRYPT_SALT_ROUNDS, 10);
  });

  it('requires both JWT secrets', () => {
    assert.throws(() => validateEnv({ DATABASE_URL: valid.DATABASE_URL }), /JWT_ACCESS_SECRET/);
  });

  it('rejects short secrets and the CHANGE_ME placeholder', () => {
    assert.throws(() => validateEnv({ ...valid, JWT_ACCESS_SECRET: 'short' }), /JWT_ACCESS_SECRET/);
    assert.throws(
      () => validateEnv({ ...valid, JWT_REFRESH_SECRET: 'CHANGE_ME_' + 'x'.repeat(40) }),
      /JWT_REFRESH_SECRET/,
    );
  });

  it('requires different access and refresh secrets', () => {
    assert.throws(
      () => validateEnv({ ...valid, JWT_REFRESH_SECRET: valid.JWT_ACCESS_SECRET }),
      /must be different/,
    );
  });

  it('validates token lifetimes and bcrypt cost', () => {
    assert.throws(() => validateEnv({ ...valid, JWT_ACCESS_EXPIRES_IN: 'forever' }), /EXPIRES_IN/);
    assert.throws(() => validateEnv({ ...valid, JWT_REFRESH_EXPIRES_IN: '0d' }), /EXPIRES_IN/);
    assert.throws(() => validateEnv({ ...valid, BCRYPT_SALT_ROUNDS: '4' }), /BCRYPT_SALT_ROUNDS/);
    assert.doesNotThrow(() => validateEnv({ ...valid, JWT_ACCESS_EXPIRES_IN: '900s' }));
  });
});
