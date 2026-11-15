import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import {
  BCRYPT_MAX_PASSWORD_BYTES,
  MaxUtf8Bytes,
} from './password-byte-limit.validator';

export class LoginDto {
  @ApiProperty({ example: 'customer@brewlite.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'BrewLite123!',
    minLength: 8,
    maxLength: 72,
    description: 'Tối thiểu 8 ký tự và tối đa 72 byte UTF-8',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @MaxUtf8Bytes(BCRYPT_MAX_PASSWORD_BYTES)
  password!: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'customer@brewlite.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Nguyễn Minh Anh', minLength: 2, maxLength: 100 })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName!: string;

  @ApiProperty({
    example: 'BrewLite123!',
    minLength: 8,
    maxLength: 72,
    description: 'Tối thiểu 8 ký tự gồm chữ cái và chữ số, tối đa 72 byte UTF-8',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @MaxUtf8Bytes(BCRYPT_MAX_PASSWORD_BYTES)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).{8,72}$/, {
    message: 'Mật khẩu cần ít nhất 8 ký tự gồm chữ và số',
  })
  password!: string;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tài khoản khách hàng mới' })
  @ApiResponse({ status: 201, description: 'Tạo tài khoản thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ' })
  @ApiResponse({ status: 409, description: 'Email đã được sử dụng' })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.email, dto.password, dto.fullName);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập và nhận JWT access token (HS256)' })
  @ApiResponse({ status: 200, description: 'Đăng nhập thành công' })
  @ApiResponse({ status: 401, description: 'Email hoặc mật khẩu không đúng' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }
}
