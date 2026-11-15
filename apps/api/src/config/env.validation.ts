export type NodeEnvironment = 'development' | 'test' | 'production';

export interface ValidatedEnv {
  NODE_ENV: NodeEnvironment;
  PORT?: number;
  API_PORT: number;
  DATABASE_URL: string;
  TEST_DATABASE_URL?: string;
  CORS_ORIGIN: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  PAYMENT_PROVIDER: string;
  PAYMENT_WEBHOOK_SECRET?: string;
}

const VALID_NODE_ENVS: ReadonlySet<NodeEnvironment> = new Set([
  'development',
  'test',
  'production',
]);

const WEAK_PLACEHOLDER_SECRETS: ReadonlySet<string> = new Set([
  'replace_with_your_local_jwt_secret_key_min_32_chars',
  'replace_with_your_local_webhook_secret',
  'changeme',
  'secret',
]);

const MIN_JWT_SECRET_LENGTH = 32;
const MIN_PROD_WEBHOOK_SECRET_LENGTH = 16;

function readNonEmptyString(
  env: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = env[key];
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parsePort(
  env: Record<string, unknown>,
  key: string,
  errors: string[],
): number | undefined {
  const raw = readNonEmptyString(env, key);
  if (raw === undefined) {
    return undefined;
  }
  if (!/^\d+$/.test(raw)) {
    errors.push(`${key} must be an integer between 1 and 65535`);
    return undefined;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    errors.push(`${key} must be an integer between 1 and 65535`);
    return undefined;
  }
  return parsed;
}

function isPostgresUrl(value: string): boolean {
  return value.startsWith('postgres://') || value.startsWith('postgresql://');
}

export function resolveApiPort(
  env: Pick<ValidatedEnv, 'PORT' | 'API_PORT'>,
): number {
  return env.PORT ?? env.API_PORT ?? 4000;
}

export function validateEnv(rawEnv: Record<string, unknown>): ValidatedEnv {
  const errors: string[] = [];

  const rawNodeEnv = readNonEmptyString(rawEnv, 'NODE_ENV') ?? 'development';
  if (!VALID_NODE_ENVS.has(rawNodeEnv as NodeEnvironment)) {
    errors.push(
      'NODE_ENV must be one of: development, test, production',
    );
  }
  const nodeEnv = (
    VALID_NODE_ENVS.has(rawNodeEnv as NodeEnvironment)
      ? rawNodeEnv
      : 'development'
  ) as NodeEnvironment;

  const port = parsePort(rawEnv, 'PORT', errors);
  const apiPort = parsePort(rawEnv, 'API_PORT', errors) ?? 4000;

  const databaseUrl = readNonEmptyString(rawEnv, 'DATABASE_URL');
  if (!databaseUrl) {
    errors.push('DATABASE_URL is required');
  } else if (!isPostgresUrl(databaseUrl)) {
    errors.push('DATABASE_URL must start with postgresql:// or postgres://');
  }

  const testDatabaseUrl = readNonEmptyString(rawEnv, 'TEST_DATABASE_URL');
  if (testDatabaseUrl && !isPostgresUrl(testDatabaseUrl)) {
    errors.push(
      'TEST_DATABASE_URL must start with postgresql:// or postgres://',
    );
  }

  const jwtSecret = readNonEmptyString(rawEnv, 'JWT_SECRET');
  if (!jwtSecret) {
    errors.push('JWT_SECRET is required');
  } else {
    if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
      errors.push(
        `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters long`,
      );
    }
    if (
      nodeEnv === 'production' &&
      WEAK_PLACEHOLDER_SECRETS.has(jwtSecret.toLowerCase())
    ) {
      errors.push('JWT_SECRET must not use a placeholder value in production');
    }
  }

  const jwtExpiresIn = readNonEmptyString(rawEnv, 'JWT_EXPIRES_IN') ?? '1d';
  const corsOrigin =
    readNonEmptyString(rawEnv, 'CORS_ORIGIN') ?? 'http://localhost:3000';
  const paymentProvider =
    readNonEmptyString(rawEnv, 'PAYMENT_PROVIDER') ?? 'mock';

  const paymentWebhookSecret = readNonEmptyString(
    rawEnv,
    'PAYMENT_WEBHOOK_SECRET',
  );
  if (nodeEnv === 'production') {
    if (!paymentWebhookSecret) {
      errors.push('PAYMENT_WEBHOOK_SECRET is required in production');
    } else if (
      paymentWebhookSecret.length < MIN_PROD_WEBHOOK_SECRET_LENGTH ||
      WEAK_PLACEHOLDER_SECRETS.has(paymentWebhookSecret.toLowerCase())
    ) {
      errors.push(
        `PAYMENT_WEBHOOK_SECRET must be at least ${MIN_PROD_WEBHOOK_SECRET_LENGTH} characters and non-placeholder in production`,
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n- ${errors.join('\n- ')}`,
    );
  }

  return {
    NODE_ENV: nodeEnv,
    PORT: port,
    API_PORT: apiPort,
    DATABASE_URL: databaseUrl as string,
    TEST_DATABASE_URL: testDatabaseUrl,
    CORS_ORIGIN: corsOrigin,
    JWT_SECRET: jwtSecret as string,
    JWT_EXPIRES_IN: jwtExpiresIn,
    PAYMENT_PROVIDER: paymentProvider,
    PAYMENT_WEBHOOK_SECRET: paymentWebhookSecret,
  };
}
