import {
  Body,
  Controller,
  Get,
  Headers,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @ApiOperation({
    summary: 'Thanh toán mô phỏng có idempotency và hoàn tồn kho nếu thất bại',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description: 'UUID v4 duy nhất cho mỗi lượt thanh toán',
  })
  @ApiResponse({ status: 200, description: 'Thanh toán thành công (Order -> PAID)' })
  @ApiResponse({
    status: 202,
    description: 'Cổng thanh toán timeout, đang chờ đối soát',
  })
  @ApiResponse({ status: 400, description: 'Thiếu hoặc sai định dạng Idempotency-Key' })
  @ApiResponse({
    status: 402,
    description: 'Thanh toán thất bại (Order -> PAYMENT_FAILED, đã hoàn tồn kho)',
  })
  @ApiResponse({ status: 409, description: 'Đơn đang xử lý hoặc đã thanh toán' })
  @ApiResponse({
    status: 422,
    description: 'Idempotency-Key bị tái sử dụng cho payload khác',
  })
  async create(
    @Req() request: AuthenticatedRequest,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() dto: CreatePaymentDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.paymentsService.pay(
      request.user.id,
      idempotencyKey,
      dto,
    );
    response.status(result.statusCode ?? HttpStatus.OK);
    for (const [name, value] of Object.entries(result.headers ?? {})) {
      response.setHeader(name, value);
    }
    return result.body;
  }

  @Get(':orderId/status')
  @ApiOperation({ summary: 'Đối soát và kiểm tra trạng thái thanh toán của đơn' })
  @ApiParam({ name: 'orderId', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Trạng thái thanh toán cuối cùng' })
  @ApiResponse({ status: 202, description: 'Vẫn đang chờ phản hồi từ cổng thanh toán' })
  async getStatus(
    @Req() request: AuthenticatedRequest,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.paymentsService.reconcile(
      request.user.id,
      orderId,
    );
    response.status(result.statusCode ?? HttpStatus.OK);
    return result.body;
  }
}
