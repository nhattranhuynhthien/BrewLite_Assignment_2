import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LoyaltyService } from './loyalty.service';

@ApiTags('Loyalty')
@ApiBearerAuth()
@Controller('loyalty')
@UseGuards(JwtAuthGuard)
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Xem số dư điểm tích lũy và lịch sử cộng/đổi điểm của tôi',
  })
  @ApiResponse({
    status: 200,
    description: 'Số dư điểm hiện tại và tối đa 50 giao dịch điểm gần nhất',
  })
  getMyLoyalty(@Req() request: AuthenticatedRequest) {
    return this.loyaltyService.getBalanceAndHistory(request.user.id);
  }
}
