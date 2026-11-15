import {
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { IdempotencyStatus } from '@prisma/client';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  it('missing or malformed idempotency key fails with 400 before database or gateway access', async () => {
    const gateway = { charge: jest.fn() };
    const service = new PaymentsService(
      {} as never,
      {} as never,
      gateway as never,
    );

    await expect(
      service.pay('u', undefined, { orderId: 'o', method: 'CARD' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.pay('u', 'not-a-uuid', { orderId: 'o', method: 'CARD' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(gateway.charge).not.toHaveBeenCalled();
  });

  it('completed key replays exact stored response', async () => {
    const response = { status: 'SUCCESS' };
    const service = new PaymentsService({} as never, {} as never, {} as never);
    const result = await service['handleExistingKey'](
      {
        status: IdempotencyStatus.COMPLETED,
        requestHash: 'h',
        responseStatus: 200,
        responseBody: response,
      },
      'h',
    );
    expect(result).toEqual({ statusCode: 200, body: response });
  });

  it('same key with another body is rejected with 422', async () => {
    const service = new PaymentsService({} as never, {} as never, {} as never);
    await expect(
      service['handleExistingKey'](
        {
          status: IdempotencyStatus.COMPLETED,
          requestHash: 'a',
          responseStatus: 200,
          responseBody: {},
        },
        'b',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
