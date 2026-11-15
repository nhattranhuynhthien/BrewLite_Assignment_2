import { resolveApiPort, validateEnv } from './env.validation';

describe('env.validation', () => {
  const validBaseEnv: Record<string, string> = {
    NODE_ENV: 'development',
    API_PORT: '4000',
    DATABASE_URL: 'postgresql://brewlite:brewlite_secret@localhost:5432/brewlite',
    CORS_ORIGIN: 'http://localhost:3000',
    JWT_SECRET: 'dev_only_secret_key_with_at_least_32_characters_1234',
    JWT_EXPIRES_IN: '1d',
  };

  it('accepts valid development environment and applies defaults', () => {
    const result = validateEnv({
      DATABASE_URL: validBaseEnv.DATABASE_URL,
      JWT_SECRET: validBaseEnv.JWT_SECRET,
    });

    expect(result.NODE_ENV).toBe('development');
    expect(result.API_PORT).toBe(4000);
    expect(result.CORS_ORIGIN).toBe('http://localhost:3000');
    expect(result.JWT_EXPIRES_IN).toBe('1d');
    expect(result.PAYMENT_PROVIDER).toBe('mock');
    expect(resolveApiPort(result)).toBe(4000);
  });

  it('prefers PORT over API_PORT when resolving listen port', () => {
    const result = validateEnv({
      ...validBaseEnv,
      PORT: '8080',
      API_PORT: '4000',
    });

    expect(result.PORT).toBe(8080);
    expect(resolveApiPort(result)).toBe(8080);
  });

  it('fails fast when DATABASE_URL is missing or invalid', () => {
    expect(() =>
      validateEnv({
        JWT_SECRET: validBaseEnv.JWT_SECRET,
      }),
    ).toThrow(/DATABASE_URL is required/);

    expect(() =>
      validateEnv({
        DATABASE_URL: 'mysql://localhost:3306/brewlite',
        JWT_SECRET: validBaseEnv.JWT_SECRET,
      }),
    ).toThrow(/DATABASE_URL must start with postgresql:\/\/ or postgres:\/\//);
  });

  it('fails fast when JWT_SECRET is missing or shorter than 32 characters', () => {
    expect(() =>
      validateEnv({
        DATABASE_URL: validBaseEnv.DATABASE_URL,
      }),
    ).toThrow(/JWT_SECRET is required/);

    expect(() =>
      validateEnv({
        DATABASE_URL: validBaseEnv.DATABASE_URL,
        JWT_SECRET: 'too-short-secret',
      }),
    ).toThrow(/JWT_SECRET must be at least 32 characters long/);
  });

  it('rejects placeholder JWT_SECRET and missing webhook secret in production', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        DATABASE_URL: validBaseEnv.DATABASE_URL,
        JWT_SECRET: 'replace_with_your_local_jwt_secret_key_min_32_chars',
      }),
    ).toThrow(/placeholder value in production/);

    expect(() =>
      validateEnv({
        NODE_ENV: 'production',
        DATABASE_URL: validBaseEnv.DATABASE_URL,
        JWT_SECRET: 'prod_super_strong_jwt_secret_value_min_32_characters',
      }),
    ).toThrow(/PAYMENT_WEBHOOK_SECRET is required in production/);
  });

  it('rejects invalid PORT values', () => {
    expect(() =>
      validateEnv({
        ...validBaseEnv,
        PORT: '99999',
      }),
    ).toThrow(/PORT must be an integer between 1 and 65535/);
  });
});
