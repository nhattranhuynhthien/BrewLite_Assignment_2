import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret || secret.length < 32) {
          throw new Error('JWT_SECRET must be set to at least 32 characters');
        }
        const expiresIn = Number(process.env.JWT_EXPIRES_IN ?? 86400);
        if (!Number.isInteger(expiresIn) || expiresIn <= 0) {
          throw new Error('JWT_EXPIRES_IN must be a positive number of seconds');
        }
        return { secret, signOptions: { expiresIn } };
      },
    }),
  ],
  providers: [JwtAuthGuard],
  exports: [JwtModule, JwtAuthGuard],
})
export class AuthModule {}
