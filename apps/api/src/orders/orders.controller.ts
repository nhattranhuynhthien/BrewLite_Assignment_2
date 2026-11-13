import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';
import { Req } from '@nestjs/common';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(request.user.id, dto);
  }

  @Get(':orderId')
  findOne(@Req() request: AuthenticatedRequest, @Param('orderId') orderId: string) {
    return this.ordersService.findOwnedOrder(request.user.id, orderId);
  }
}
