import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import { ProductsService } from './products.service';

@ApiTags('Catalog')
@Controller()
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get('categories')
  @ApiOperation({ summary: 'Lấy danh sách danh mục đồ uống' })
  @ApiResponse({ status: 200, description: 'Danh sách danh mục' })
  categories() {
    return this.products.categories();
  }

  @Get('products')
  @ApiOperation({
    summary: 'Danh sách đồ uống đang mở bán (phân trang 20/trang, tìm không dấu)',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'q', required: false })
  @ApiResponse({ status: 200, description: 'Danh sách đồ uống phân trang' })
  @ApiResponse({ status: 400, description: 'Tham số truy vấn không hợp lệ' })
  list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('categoryId') categoryId?: string,
    @Query('q') q?: string,
  ) {
    if (page < 1) {
      throw new BadRequestException('page phải >= 1');
    }
    const normalizedCategoryId = categoryId?.trim() || undefined;
    if (normalizedCategoryId && !isUUID(normalizedCategoryId)) {
      throw new BadRequestException('categoryId phải là UUID hợp lệ');
    }
    return this.products.list(page, normalizedCategoryId, q || undefined);
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Chi tiết đồ uống kèm danh sách size và topping' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Chi tiết sản phẩm' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy sản phẩm' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.detail(id);
  }
}
