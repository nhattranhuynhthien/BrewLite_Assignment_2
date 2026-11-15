import { LoggerService } from '@nestjs/common';

const REDACTED = '[REDACTED]';

const SENSITIVE_KEY_PATTERN =
  /^(authorization|cookie|set-cookie|password|passwordhash|password_hash|jwt|token|accesstoken|access_token|refreshtoken|refresh_token|secret|jwt_secret|payment_webhook_secret|webhooksecret|cardnumber|card_number|cvv|database_url|databaseurl)$/i;

export function sanitizeString(input: string): string {
  return input
    .replace(/(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, `$1${REDACTED}`)
    .replace(
      /(postgres(?:ql)?:\/\/[^:\s/]+:)([^@\s]+)(@)/gi,
      `$1${REDACTED}$3`,
    );
}

export function redactSensitiveData(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    return sanitizeString(value);
  }
  if (typeof value !== 'object') {
    return value;
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message),
    };
  }
  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item, seen));
  }

  const output: Record<string, unknown> = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      output[key] = REDACTED;
    } else {
      output[key] = redactSensitiveData(entryValue, seen);
    }
  }
  return output;
}

export type LogLevelName = 'log' | 'error' | 'warn' | 'debug' | 'verbose';

export interface StructuredLogEntry {
  timestamp: string;
  level: LogLevelName;
  context?: string;
  message: unknown;
  trace?: string;
  meta?: unknown;
}

export class JsonLoggerService implements LoggerService {
  constructor(
    private readonly defaultContext = 'Application',
    private readonly sink: {
      stdout: (line: string) => void;
      stderr: (line: string) => void;
    } = {
      stdout: (line) => process.stdout.write(`${line}\n`),
      stderr: (line) => process.stderr.write(`${line}\n`),
    },
  ) {}

  log(message: unknown, context?: string): void {
    this.emit('log', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.emit('error', message, context, trace);
  }

  warn(message: unknown, context?: string): void {
    this.emit('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    if (process.env.NODE_ENV !== 'production') {
      this.emit('debug', message, context);
    }
  }

  verbose(message: unknown, context?: string): void {
    if (process.env.NODE_ENV !== 'production') {
      this.emit('verbose', message, context);
    }
  }

  formatEntry(
    level: LogLevelName,
    message: unknown,
    context?: string,
    trace?: string,
  ): StructuredLogEntry {
    const entry: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context: context ?? this.defaultContext,
      message: redactSensitiveData(message),
    };
    if (trace) {
      entry.trace = sanitizeString(trace);
    }
    return entry;
  }

  private emit(
    level: LogLevelName,
    message: unknown,
    context?: string,
    trace?: string,
  ): void {
    const serialized = JSON.stringify(
      this.formatEntry(level, message, context, trace),
    );
    if (level === 'error') {
      this.sink.stderr(serialized);
      return;
    }
    this.sink.stdout(serialized);
  }
}
