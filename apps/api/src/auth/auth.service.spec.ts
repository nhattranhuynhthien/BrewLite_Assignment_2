import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  it('does not reveal whether an email exists on login failure', async () => {
    const db = { user: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new AuthService(db as never, {} as never);
    await expect(
      service.login('missing@test.dev', 'Password123'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects duplicate email registration with ConflictException', async () => {
    const duplicate = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: '6.19.3',
    });
    const db = { user: { create: jest.fn().mockRejectedValue(duplicate) } };
    const service = new AuthService(db as never, {} as never);
    await expect(
      service.register('a@b.local', 'Coffee123!', 'Tester'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns accessToken and sanitized user on valid login', async () => {
    const passwordHash = await hash('Coffee123!', 4);
    const db = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'customer@brewlite.local',
          passwordHash,
          fullName: 'Khách hàng',
          role: 'CUSTOMER',
        }),
      },
    };
    const jwt = { signAsync: jest.fn().mockResolvedValue('jwt-token') };
    const service = new AuthService(db as never, jwt as never);

    const res = await service.login('CUSTOMER@brewlite.local', 'Coffee123!');
    expect(res.accessToken).toBe('jwt-token');
    expect(res.user).toEqual({
      id: 'user-1',
      email: 'customer@brewlite.local',
      fullName: 'Khách hàng',
      role: 'CUSTOMER',
    });
  });
});
