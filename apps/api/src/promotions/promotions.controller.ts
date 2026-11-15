import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ValidatePromotionDto } from './dto/validate-promotion.dto';
import { PromotionsService } from './promotions.service';

@ApiTags('Promotions')
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách mã khuyến mãi đang áp dụng' })
  @ApiResponse({ status: 200, description: 'Danh sách mã khuyến mãi khả dụng' })
  listActive() {
    return this.promotionsService.listActive();
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Kiểm tra và tính trước số tiền giảm của mã khuyến mãi' })
  @ApiResponse({ status: 200, description: 'Mã hợp lệ kèm mức giảm dự kiến' })
  @ApiResponse({
    status: 400,
    description: 'Mã không tồn tại, hết hạn, chưa đạt đơn tối thiểu hoặc hết lượt',
  })
  validate(@Body() dto: ValidatePromotionDto) {
    return this.promotionsService.validateForSubtotal(dto.code, dto.subtotal);
  }
}
