import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { isUUID } from 'class-validator';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    role: 'CUSTOMER' | 'STAFF';
  };
}

export const StaffOnly = () => SetMetadata('staffOnly', true);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly db: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) {
      throw new UnauthorizedException('Cần đăng nhập');
    }

    let sub: string;
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        algorithms: ['HS256'],
      });
      if (typeof payload.sub !== 'string' || !isUUID(payload.sub)) {
        throw new Error('Invalid sub claim');
      }
      sub = payload.sub;
    } catch {
      throw new UnauthorizedException(
        'Phiên đăng nhập không hợp lệ hoặc đã hết hạn',
      );
    }

    const user = await this.db.user.findUnique({ where: { id: sub } });
    if (!user) {
      throw new UnauthorizedException('Tài khoản không tồn tại');
    }

    req.user = { id: user.id, role: user.role };
    const isStaffOnly = this.reflector.getAllAndOverride<boolean>('staffOnly', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isStaffOnly && user.role !== 'STAFF') {
      throw new ForbiddenException('Chỉ nhân viên mới được thao tác');
    }

    return true;
  }
}
