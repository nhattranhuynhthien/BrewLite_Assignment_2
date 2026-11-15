import { JsonLoggerService, redactSensitiveData } from './json-logger.service';

describe('JsonLoggerService', () => {
  it('redacts sensitive object keys recursively', () => {
    const redacted = redactSensitiveData({
      email: 'alice@brewlite.local',
      password: 'plain-password',
      headers: {
        authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig',
        cookie: 'session=abc123',
      },
      payment: {
        cardNumber: '4111111111111111',
        amount: 55000,
      },
    });

    expect(redacted).toEqual({
      email: 'alice@brewlite.local',
      password: '[REDACTED]',
      headers: {
        authorization: '[REDACTED]',
        cookie: '[REDACTED]',
      },
      payment: {
        cardNumber: '[REDACTED]',
        amount: 55000,
      },
    });
  });

  it('redacts bearer tokens and postgres credentials inside log strings', () => {
    const lines: string[] = [];
    const logger = new JsonLoggerService('AuthGuard', {
      stdout: (line) => lines.push(line),
      stderr: (line) => lines.push(line),
    });

    logger.error(
      'Failed connecting postgresql://brewlite:top_secret@db:5432/brewlite with Bearer my.jwt.token',
      'stacktrace',
    );

    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]) as {
      level: string;
      context: string;
      message: string;
    };
    expect(parsed.level).toBe('error');
    expect(parsed.context).toBe('AuthGuard');
    expect(parsed.message).not.toContain('top_secret');
    expect(parsed.message).not.toContain('my.jwt.token');
    expect(parsed.message).toContain('[REDACTED]');
  });
});
