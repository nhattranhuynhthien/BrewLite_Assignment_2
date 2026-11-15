import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  it('throws NotFoundException when product is missing or unavailable', async () => {
    const service = new ProductsService({
      product: { findFirst: jest.fn().mockResolvedValue(null) },
    } as never);
    await expect(service.detail('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('filters Vietnamese accents including đ cleanly', async () => {
    const service = new ProductsService({
      product: {
        findMany: jest.fn().mockResolvedValue([
          { id: '1', name: 'Trà đào cam sả', category: { id: 'c', name: 'Trà' } },
          { id: '2', name: 'Cà phê đen đá', category: { id: 'c', name: 'Cà phê' } },
        ]),
      },
    } as never);

    const res = await service.list(1, undefined, 'tra dao');
    expect(res.items.map((p) => p.id)).toEqual(['1']);

    const resD = await service.list(1, undefined, 'den da');
    expect(resD.items.map((p) => p.id)).toEqual(['2']);
  });

  it('uses conditional atomic update when decreasing stock', async () => {
    const tx = {
      product: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };
    const service = new ProductsService({} as never);
    expect(await service.decreaseStock('p', 2, tx as never)).toBe(false);
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: 'p', isAvailable: true, stockQuantity: { gte: 2 } },
      data: { stockQuantity: { decrement: 2 } },
    });
  });

  it('rejects non-UUID categoryId in ProductsController and ignores empty string', async () => {
    const listMock = jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    const controller = new ProductsController({ list: listMock } as unknown as ProductsService);

    expect(() => controller.list(1, 'not-a-uuid', undefined)).toThrow(BadRequestException);

    await controller.list(1, '', undefined);
    expect(listMock).toHaveBeenCalledWith(1, undefined, undefined);

    const validId = '10000000-0000-4000-8000-000000000001';
    await controller.list(1, validId, 'ca phe');
    expect(listMock).toHaveBeenCalledWith(1, validId, 'ca phe');
  });
});
