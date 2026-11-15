import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import {
  BCRYPT_MAX_PASSWORD_BYTES,
  isWithinBcryptByteLimit,
} from './password-byte-limit.validator';

@Injectable()
export class AuthService {
  constructor(
    private readonly db: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private assertPasswordByteLimit(password: string): void {
    if (!isWithinBcryptByteLimit(password)) {
      throw new BadRequestException(
        `Mật khẩu không được vượt quá ${BCRYPT_MAX_PASSWORD_BYTES} byte UTF-8`,
      );
    }
  }

  async register(email: string, password: string, fullName: string) {
    this.assertPasswordByteLimit(password);
    try {
      const user = await this.db.user.create({
        data: {
          email: email.toLowerCase().trim(),
          passwordHash: await hash(password, 12),
          fullName: fullName.trim(),
        },
      });
      return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email đã được sử dụng');
      }
      throw error;
    }
  }

  async login(email: string, password: string) {
    this.assertPasswordByteLimit(password);
    const user = await this.db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
    if (!user || !(await compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    return {
      accessToken: await this.jwt.signAsync({ sub: user.id, role: user.role }),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }
}
