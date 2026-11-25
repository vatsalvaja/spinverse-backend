import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { LoginDto } from './login.dto';
import { RefreshTokenDto } from './refresh-token.dto';
import { RegisterDto } from './register.dto';

// Same options as the global pipe registered in AppModule.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

const validate = <T>(metatype: new () => T, body: unknown): Promise<T> =>
  pipe.transform(body, { type: 'body', metatype }) as Promise<T>;

const errorsOf = async (promise: Promise<unknown>): Promise<string[]> => {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof BadRequestException);
    const { message } = error.getResponse() as { message: string[] };
    return message;
  }
  return assert.fail('validation should have failed');
};

describe('RegisterDto', () => {
  const valid = { name: '  Jane Doe ', email: '  Jane@Example.COM ', password: 'Str0ngPassword' };

  it('accepts valid input and normalises name and email', async () => {
    const dto = await validate(RegisterDto, valid);
    assert.equal(dto.name, 'Jane Doe');
    assert.equal(dto.email, 'jane@example.com');
  });

  it('rejects an invalid email, short or weak password and missing name', async () => {
    const errors = await errorsOf(validate(RegisterDto, { email: 'nope', password: 'short' }));
    assert.ok(errors.some((e) => e.includes('email')));
    assert.ok(errors.some((e) => e.includes('password')));
    assert.ok(errors.some((e) => e.includes('name')));
  });

  it('requires a letter and a number in the password', async () => {
    for (const password of ['onlyletterspass', '1234567890']) {
      const errors = await errorsOf(validate(RegisterDto, { ...valid, password }));
      assert.ok(errors.some((e) => e.includes('letter and one number')));
    }
  });

  it('rejects passwords longer than 72 characters (bcrypt limit)', async () => {
    const errors = await errorsOf(validate(RegisterDto, { ...valid, password: 'a1'.repeat(37) }));
    assert.ok(errors.some((e) => e.includes('password')));
  });

  it('does not let clients choose their role', async () => {
    const errors = await errorsOf(validate(RegisterDto, { ...valid, role: 'ADMIN' }));
    assert.ok(errors.some((e) => e.includes('role should not exist')));
  });
});

describe('LoginDto', () => {
  it('accepts valid credentials and normalises the email', async () => {
    const dto = await validate(LoginDto, { email: 'JANE@example.com ', password: 'x' });
    assert.equal(dto.email, 'jane@example.com');
  });

  it('rejects missing or malformed fields', async () => {
    const errors = await errorsOf(validate(LoginDto, { email: 'bad', password: '' }));
    assert.ok(errors.some((e) => e.includes('email')));
    assert.ok(errors.some((e) => e.includes('password')));
  });
});

describe('RefreshTokenDto', () => {
  it('accepts a token string', async () => {
    const dto = await validate(RefreshTokenDto, { refreshToken: 'abc.def.ghi' });
    assert.equal(dto.refreshToken, 'abc.def.ghi');
  });

  it('rejects a missing, empty or non-string token', async () => {
    for (const body of [{}, { refreshToken: '' }, { refreshToken: 123 }]) {
      const errors = await errorsOf(validate(RefreshTokenDto, body));
      assert.ok(errors.some((e) => e.includes('refreshToken')));
    }
  });
});
