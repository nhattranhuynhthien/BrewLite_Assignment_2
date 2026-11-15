import { NodeEnvironment, resolveApiPort, ValidatedEnv } from './env.validation';

export interface AppConfig {
  nodeEnv: NodeEnvironment;
  port: number;
  databaseUrl: string;
  corsOrigins: string[];
  jwt: {
    secret: string;
    expiresIn: string;
  };
  payment: {
    provider: string;
    webhookSecret?: string;
  };
}

export function parseCorsOrigins(rawOrigin: string): string[] {
  return rawOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export default function configuration(): AppConfig {
  const env = process.env as unknown as Partial<ValidatedEnv>;
  const nodeEnv = (env.NODE_ENV ?? 'development') as NodeEnvironment;
  const parsedPort = env.PORT !== undefined ? Number(env.PORT) : undefined;
  const parsedApiPort =
    env.API_PORT !== undefined ? Number(env.API_PORT) : 4000;

  return {
    nodeEnv,
    port: resolveApiPort({
      PORT: Number.isInteger(parsedPort) ? parsedPort : undefined,
      API_PORT: Number.isInteger(parsedApiPort) ? parsedApiPort : 4000,
    }),
    databaseUrl: env.DATABASE_URL ?? '',
    corsOrigins: parseCorsOrigins(env.CORS_ORIGIN ?? 'http://localhost:3000'),
    jwt: {
      secret: env.JWT_SECRET ?? '',
      expiresIn: env.JWT_EXPIRES_IN ?? '1d',
    },
    payment: {
      provider: env.PAYMENT_PROVIDER ?? 'mock',
      webhookSecret: env.PAYMENT_WEBHOOK_SECRET,
    },
  };
}
