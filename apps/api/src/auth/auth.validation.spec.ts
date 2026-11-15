import {
  BadRequestException,
  ForbiddenException,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import request from 'supertest';
import { createAppValidationPipe } from '../common/validation/app-validation.pipe';
import { AuthController, LoginDto, RegisterDto } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('Auth validation & guard', () => {
  it('registration rejects weak password and invalid email', async () => {
    const errors = await validate(
      plainToInstance(RegisterDto, {
        email: 'bad',
        password: 'weak',
        fullName: 'A',
      }),
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it('registration accepts a valid request', async () => {
    const errors = await validate(
      plainToInstance(RegisterDto, {
        email: 'customer@example.test',
        password: 'Coffee123!',
        fullName: 'Khách hàng',
      }),
    );
    expect(errors).toHaveLength(0);
  });

  it('enforces 71/72/73 UTF-8 byte boundary for ASCII and Unicode passwords in RegisterDto and LoginDto', async () => {
    const ascii71 = 'A1' + 'a'.repeat(69);
    const ascii72 = 'A1' + 'a'.repeat(70);
    const ascii73 = 'A1' + 'a'.repeat(71);

    const unicode71 = 'A1' + '\u00e9'.repeat(34) + 'x';
    const unicode72 = 'A1' + '\u00e9'.repeat(35);
    const unicode73 = 'A1' + '\u00e9'.repeat(35) + 'X';
    const multiByte73 = 'A1' + '🧋'.repeat(17) + 'abc';

    expect(Buffer.byteLength(ascii71, 'utf8')).toBe(71);
    expect(Buffer.byteLength(ascii72, 'utf8')).toBe(72);
    expect(Buffer.byteLength(ascii73, 'utf8')).toBe(73);
    expect(Buffer.byteLength(unicode71, 'utf8')).toBe(71);
    expect(Buffer.byteLength(unicode72, 'utf8')).toBe(72);
    expect(Buffer.byteLength(unicode73, 'utf8')).toBe(73);
    expect(unicode73.length).toBe(38);
    expect(Buffer.byteLength(multiByte73, 'utf8')).toBe(73);

    for (const validPassword of [ascii71, ascii72, unicode71, unicode72]) {
      const regErrors = await validate(
        plainToInstance(RegisterDto, {
          email: 'customer@example.test',
          password: validPassword,
          fullName: 'Khách hàng',
        }),
      );
      const loginErrors = await validate(
        plainToInstance(LoginDto, {
          email: 'customer@example.test',
          password: validPassword,
        }),
      );
      expect(regErrors).toHaveLength(0);
      expect(loginErrors).toHaveLength(0);
    }

    for (const invalidPassword of [ascii73, unicode73, multiByte73]) {
      const regErrors = await validate(
        plainToInstance(RegisterDto, {
          email: 'customer@example.test',
          password: invalidPassword,
          fullName: 'Khách hàng',
        }),
      );
      const loginErrors = await validate(
        plainToInstance(LoginDto, {
          email: 'customer@example.test',
          password: invalidPassword,
        }),
      );
      expect(regErrors.length).toBeGreaterThan(0);
      expect(loginErrors.length).toBeGreaterThan(0);
    }
  });

  it('returns HTTP 400 for >72-byte Unicode passwords and accepts 72-byte passwords over HTTP', async () => {
    const storedUsers = new Map<
      string,
      {
        id: string;
        email: string;
        passwordHash: string;
        fullName: string;
        role: 'CUSTOMER';
      }
    >();
    const mockDb = {
      user: {
        create: jest.fn(async ({ data }) => {
          const user = {
            id: 'user-1',
            email: data.email,
            passwordHash: data.passwordHash,
            fullName: data.fullName,
            role: 'CUSTOMER' as const,
          };
          storedUsers.set(data.email, user);
          return user;
        }),
        findUnique: jest.fn(async ({ where }) => {
          return storedUsers.get(where.email) ?? null;
        }),
      },
    };
    const mockJwt = { signAsync: jest.fn().mockResolvedValue('jwt-token') };

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useFactory: () => new AuthService(mockDb as never, mockJwt as never),
        },
      ],
    }).compile();

    const app: INestApplication = moduleRef.createNestApplication();
    app.useGlobalPipes(createAppValidationPipe());
    await app.init();

    try {
      const unicode72 = 'A1' + '\u00e9'.repeat(35);
      const unicode72DifferentTail = 'A1' + '\u00e9'.repeat(34) + '\u00e8';
      const unicode73A = 'A1' + '\u00e9'.repeat(35) + 'X';
      const unicode73B = 'A1' + '\u00e9'.repeat(35) + 'Y';

      // Verify bcryptjs hash behavior directly on 72-byte boundary
      const h = await hash(unicode72, 4);
      expect(h).toBeTruthy();

      const rejectedRegA = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'u73@example.test',
          password: unicode73A,
          fullName: 'Khách hàng',
        });
      expect(rejectedRegA.status).toBe(400);

      const rejectedRegB = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'u73b@example.test',
          password: unicode73B,
          fullName: 'Khách hàng',
        });
      expect(rejectedRegB.status).toBe(400);

      const acceptedReg = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'u72@example.test',
          password: unicode72,
          fullName: 'Khách hàng',
        });
      expect(acceptedReg.status).toBe(201);

      const validLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'u72@example.test', password: unicode72 });
      expect(validLogin.status).toBe(200);
      expect(validLogin.body.accessToken).toBe('jwt-token');

      const wrongTailLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'u72@example.test',
          password: unicode72DifferentTail,
        });
      expect(wrongTailLogin.status).toBe(401);

      const overByteLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'u72@example.test', password: unicode73B });
      expect(overByteLogin.status).toBe(400);
    } finally {
      await app.close();
    }
  });

  it('AuthService rejects >72 UTF-8 byte passwords directly with BadRequestException', async () => {
    const service = new AuthService({} as never, {} as never);
    const unicode73 = 'A1' + '\u00e9'.repeat(35) + 'X';

    await expect(
      service.register('u@example.test', unicode73, 'Tester'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.login('u@example.test', unicode73),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('JwtAuthGuard rejects missing token or non-UUID sub with 401 and non-staff on StaffOnly with 403', async () => {
    const validUserId = '11111111-1111-4111-8111-111111111111';
    const jwt = {
      verifyAsync: jest
        .fn()
        .mockResolvedValueOnce({ sub: 'not-a-uuid' })
        .mockResolvedValue({ sub: validUserId }),
    };
    const db = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: validUserId, role: 'CUSTOMER' }),
      },
    };
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(true),
    } as unknown as Reflector;
    const guard = new JwtAuthGuard(jwt as never, db as never, reflector);

    const noTokenCtx = {
      switchToHttp: () => ({ getRequest: () => ({ headers: {} }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };
    await expect(guard.canActivate(noTokenCtx as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    const nonUuidSubCtx = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: 'Bearer non-uuid' } }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };
    await expect(
      guard.canActivate(nonUuidSubCtx as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(db.user.findUnique).not.toHaveBeenCalled();

    const customerCtx = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: 'Bearer valid' } }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    };
    await expect(guard.canActivate(customerCtx as never)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
