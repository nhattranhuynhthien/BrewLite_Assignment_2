describe('AppModule bootstrap wiring', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('fails fast during module initialization when required env vars are invalid', async () => {
    delete process.env.DATABASE_URL;
    process.env.JWT_SECRET = 'too-short';

    await expect(
      jest.isolateModulesAsync(async () => {
        const { Test } = await import('@nestjs/testing');
        const { AppModule } = await import('./app.module');
        const { PrismaService } = await import('./prisma/prisma.service');

        await Test.createTestingModule({
          imports: [AppModule],
        })
          .overrideProvider(PrismaService)
          .useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
          .compile();
      }),
    ).rejects.toThrow(/Invalid environment configuration/);
  });

  it('compiles and initializes AppModule cleanly with valid configuration', async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL =
      'postgresql://brewlite:brewlite_secret@localhost:5432/brewlite_test';
    process.env.JWT_SECRET =
      'test_jwt_secret_key_with_at_least_32_characters_here';
    process.env.CORS_ORIGIN =
      'http://localhost:3000,https://brewlite.example.com';

    await jest.isolateModulesAsync(async () => {
      const { ConfigService } = await import('@nestjs/config');
      const { Test } = await import('@nestjs/testing');
      const { AppModule } = await import('./app.module');
      const { HealthController } = await import('./health/health.controller');
      const { PrismaService } = await import('./prisma/prisma.service');

      const mockPrisma = {
        $connect: jest.fn().mockResolvedValue(undefined),
        $disconnect: jest.fn().mockResolvedValue(undefined),
      };

      const moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(PrismaService)
        .useValue(mockPrisma)
        .compile();

      await moduleRef.init();

      const configService = moduleRef.get(ConfigService);
      const healthController = moduleRef.get(HealthController);

      expect(configService.get<number>('port')).toBe(4000);
      expect(configService.get<string[]>('corsOrigins')).toEqual([
        'http://localhost:3000',
        'https://brewlite.example.com',
      ]);
      expect(healthController.getLiveness().status).toBe('ok');

      await moduleRef.close();
    });
  });
});
