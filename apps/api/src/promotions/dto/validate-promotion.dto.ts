import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class ValidatePromotionDto {
  @ApiProperty({ example: 'BREWLITE10', maxLength: 50 })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mã khuyến mãi' })
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 65000, minimum: 0 })
  @IsInt()
  @Min(0)
  subtotal!: number;
}
