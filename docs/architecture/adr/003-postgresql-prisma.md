# ADR-003: PostgreSQL với Prisma (Prisma Migrate)

- **Trạng thái:** Accepted
- **Ngày:** 2026-11-08

## Bối cảnh
Dữ liệu đơn hàng, thanh toán và tồn kho cần tính toàn vẹn và transaction. Đề bài yêu cầu migration/seed có thể tái tạo database. PostgreSQL là thành phần bắt buộc.

## Các lựa chọn
1. **Prisma** + Prisma Migrate.
2. TypeORM + migrations.
3. `prisma db push` / `synchronize` hoặc script SQL thủ công.

## Quyết định
Dùng **PostgreSQL** và **Prisma**:

- Schema khai báo tại `apps/api/prisma/schema.prisma`; Prisma Client được bọc trong `PrismaService` (một `PrismaModule` dùng chung) và inject vào các service.
- Migration: `prisma migrate dev` ở local để tạo migration; `prisma migrate deploy` ở CI/production để áp dụng các migration đã commit. **Không** dùng `db push` ngoài thử nghiệm local.
- Seed bằng `prisma db seed` (`prisma/seed.ts`), chỉ chạy ở local/staging.
- Các ràng buộc Prisma không biểu diễn được (`CHECK (stock >= 0)`, partial unique index `payments(order_id) WHERE status = 'SUCCESS'`) được thêm bằng SQL thủ công vào file migration (`prisma migrate dev --create-only` rồi chỉnh sửa).
- Transaction dùng `prisma.$transaction` (interactive transaction) cho luồng nhiều bước (xem ADR-004).

## Hệ quả
- (+) Kiểu dữ liệu type-safe từ schema, tự sinh Client, giảm lỗi truy vấn ở NestJS/TypeScript.
- (+) Schema và migration có version, tái tạo được từ đầu, kiểm tra được trong CI.
- (+) `migrate deploy` an toàn cho production, chạy được trong bước deploy của pipeline.
- (–) Prisma không sinh migration `down`; rollback bằng migration sửa ngược hoặc restore backup.
- (–) Một số tính năng PostgreSQL (CHECK, partial index, khóa dòng) phải dùng SQL thủ công/`$queryRaw`.
- (–) Cần chạy `prisma generate` trong bước build Docker/CI.
