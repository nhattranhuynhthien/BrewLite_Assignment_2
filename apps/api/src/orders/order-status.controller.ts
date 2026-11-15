import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiPropertyOptional,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { JwtAuthGuard, StaffOnly } from '../auth/jwt-auth.guard';
import { OrderStatusService } from './order-status.service';

export class UpdateOrderStatusDto {
  @ApiProperty({
    enum: [OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.COMPLETED],
    example: OrderStatus.PREPARING,
  })
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @ApiPropertyOptional({
    enum: OrderStatus,
    description: 'Trạng thái hiện tại kỳ vọng (tùy chọn để kiểm tra đồng thời)',
  })
  @IsOptional()
  @IsEnum(OrderStatus)
  expectedStatus?: OrderStatus;
}

@ApiTags('Orders')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
@StaffOnly()
export class OrderStatusController {
  constructor(private readonly orderStatus: OrderStatusService) {}

  @Get('staff/orders')
  @ApiOperation({
    summary: 'Nhân viên xem danh sách đơn đang cần pha chế/trả món',
  })
  @ApiResponse({ status: 200, description: 'Danh sách đơn PAID/PREPARING/READY' })
  @ApiResponse({ status: 403, description: 'Chỉ nhân viên mới được phép' })
  list() {
    return this.orderStatus.listActiveForStaff();
  }

  @Patch('orders/:id/status')
  @ApiOperation({
    summary:
      'Nhân viên cập nhật trạng thái đơn sau thanh toán (PAID -> PREPARING -> READY -> COMPLETED)',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Cập nhật trạng thái thành công' })
  @ApiResponse({
    status: 400,
    description: 'Đơn chưa thanh toán hoặc bước chuyển trạng thái không hợp lệ',
  })
  @ApiResponse({ status: 403, description: 'Chỉ nhân viên mới được phép' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đơn hàng' })
  @ApiResponse({ status: 409, description: 'Xung đột cập nhật đồng thời' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orderStatus.transition(id, dto.status, dto.expectedStatus);
  }
}
