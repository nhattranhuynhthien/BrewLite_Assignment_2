import {
  Body,
  Controller,
  Get,
  Headers,
  HttpStatus,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';
import { Req } from '@nestjs/common';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  async create(
    @Req() request: AuthenticatedRequest,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreatePaymentDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.paymentsService.pay(request.user.id, idempotencyKey, dto);
    response.status(result.statusCode ?? HttpStatus.OK);
    for (const [name, value] of Object.entries(result.headers ?? {})) {
      response.setHeader(name, value);
    }
    return result.body;
  }

  @Get(':orderId/status')
  async getStatus(
    @Req() request: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.paymentsService.reconcile(request.user.id, orderId);
    response.status(result.statusCode ?? HttpStatus.OK);
    return result.body;
  }
}
