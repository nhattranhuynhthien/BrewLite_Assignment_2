import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './auth.controller';
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

  it('JwtAuthGuard rejects missing token with 401 and non-staff on StaffOnly with 403', async () => {
    const jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'u1' }) };
    const db = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'u1', role: 'CUSTOMER' }),
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
