import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';

export class CreateOrderItemDto {
  @IsUUID()
  productId!: string;

  @IsUUID()
  sizeId!: string;

  @IsArray()
  @ArrayMaxSize(10)
  @IsUUID(undefined, { each: true })
  toppingIds!: string[];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  quantity!: number;
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @IsOptional()
  @IsString()
  note?: string;
}
