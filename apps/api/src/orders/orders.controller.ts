import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';
import { Body } from '@nestjs/common';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({
    summary:
      'Tạo đơn mới ở trạng thái PENDING_PAYMENT, tính giá tại server và giữ tồn kho nguyên tử',
  })
  @ApiResponse({ status: 201, description: 'Tạo đơn thành công' })
  @ApiResponse({ status: 400, description: 'Dữ liệu giỏ hàng không hợp lệ' })
  @ApiResponse({ status: 409, description: 'Sản phẩm không đủ tồn kho (OUT_OF_STOCK)' })
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(request.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Danh sách đơn hàng của chính khách hàng hiện tại' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiResponse({ status: 200, description: 'Lịch sử đơn hàng phân trang' })
  history(
    @Req() request: AuthenticatedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ) {
    if (page < 1) {
      throw new BadRequestException('page phải >= 1');
    }
    return this.ordersService.history(request.user.id, page);
  }

  @Get(':orderId')
  @ApiOperation({ summary: 'Chi tiết một đơn hàng thuộc sở hữu của người dùng' })
  @ApiParam({ name: 'orderId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Chi tiết đơn hàng' })
  @ApiResponse({ status: 403, description: 'Đơn hàng thuộc người dùng khác' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy đơn hàng' })
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.ordersService.findOwnedOrder(request.user.id, orderId);
  }
}
