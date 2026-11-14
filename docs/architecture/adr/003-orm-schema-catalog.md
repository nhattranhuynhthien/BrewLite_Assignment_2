# ADR-003: ORM, schema và migration PostgreSQL cho catalog

- **Trạng thái:** Accepted
- **Ngày quyết định:** 2026-11-08
- **Cập nhật:** 2026-11-14 — hợp nhất quyết định Prisma và làm rõ phạm vi catalog
- **Liên quan:** [SRS](../../requirements/srs.md) (FR-01–FR-08, FR-26–FR-27, NFR-06, NFR-15), [Class-01](../../diagrams/class-domain.puml), [kiến trúc hệ thống](../architecture.md), ADR-001, ADR-004, ADR-005

## Bối cảnh

BrewLite dùng NestJS và PostgreSQL. Catalog gồm `Category`, `Product`, `Size` và `Topping`; hệ thống cần truy vấn menu/chi tiết sản phẩm (FR-01–FR-05), tính giá và kiểm tra tồn kho phía server (FR-06–FR-07), đồng thời tạo dữ liệu mẫu có thể tái lập và seed không sinh bản ghi trùng (FR-08). Đơn vị giá là VND nguyên, tồn kho không âm; tạo đơn và trừ kho phải nguyên tử (NFR-06, ADR-004).

Các tài liệu kiến trúc và ADR-004/005 đã chọn Prisma, nhưng ADR-003 trước đây có hai bản với quyết định ORM mâu thuẫn. ADR này hợp nhất chúng thành một quyết định. Tại thời điểm cập nhật, `apps/api` chỉ có `.gitkeep`; đây là quyết định thiết kế, không khẳng định schema, migration hay seed đã được triển khai hoặc kiểm thử.

## Các phương án

1. **Prisma và Prisma Migrate:** schema khai báo, client sinh tự động, migration có phiên bản; SQL tùy chỉnh có thể bổ sung ràng buộc PostgreSQL.
2. **TypeORM và migrations:** entity bằng decorator, migration và truy vấn SQL tùy chỉnh.
3. **SQL thủ công hoặc `db push` làm nguồn schema:** ít bước ban đầu nhưng thiếu quy trình migration có thể review và tái lập nhất quán.

## Quyết định

Chọn **PostgreSQL với Prisma Client và Prisma Migrate** cho catalog và các module backend dùng chung:

- Khai báo mô hình tại `apps/api/prisma/schema.prisma`; NestJS dùng `PrismaService` trong `PrismaModule` dùng chung.
- Mô hình catalog phải nhất quán với Class-01: danh mục có nhiều sản phẩm; sản phẩm có size; sản phẩm có thể dùng nhiều topping. Ẩn sản phẩm bằng trạng thái khả dụng; không thêm chức năng xóa catalog trong MVP (FR-09 là Won't).
- Lưu giá cơ bản và phụ thu dưới dạng số nguyên VND. Bảo vệ tồn kho không âm bằng `CHECK` ở PostgreSQL; thêm ràng buộc không biểu diễn trực tiếp được trong Prisma bằng SQL trong migration. Các ràng buộc toàn vẹn đơn hàng/thanh toán được đặc tả thêm tại ADR-004 và ADR-005.
- Lưu snapshot tên và giá trên các dòng đơn hàng khi đặt; không tính lại lịch sử từ giá catalog hiện tại (FR-26, ADR-004).
- Commit schema và migration vào `apps/api/prisma/migrations`. Dùng `prisma migrate dev` để tạo và áp dụng migration trong local; CI/production chỉ áp dụng migration đã commit bằng `prisma migrate deploy`. Không dùng `db push` làm quy trình quản lý schema chung và không tự đồng bộ schema khi ứng dụng khởi động.
- Sinh Prisma Client bằng `prisma generate` trong quy trình build. Seed catalog phải idempotent, dùng khóa tự nhiên phù hợp và upsert để đáp ứng FR-08. Seed dữ liệu mẫu chạy theo môi trường; production chỉ nạp dữ liệu tham chiếu có chủ đích, không nạp tài khoản demo.
- Thực hiện migration production như bước riêng trong deploy trước khi chuyển lưu lượng; nếu migration thất bại thì dừng deploy. Thay đổi phá vỡ tương thích cần theo hướng expand → contract. Prisma không sinh migration `down`; khôi phục bằng migration sửa tiếp theo hoặc restore backup.

## Hệ quả

**Tích cực**

- Một schema khai báo và lịch sử migration có phiên bản giúp tái tạo database, review thay đổi và nhất quán giữa môi trường (FR-08, NFR-15).
- Prisma Client cung cấp kiểu dữ liệu cho truy vấn trong NestJS; `Prisma.TransactionClient` hỗ trợ các luồng giao dịch dùng chung theo ADR-004.
- Ràng buộc PostgreSQL bảo vệ dữ liệu ngay cả khi có lỗi ở tầng ứng dụng.
- Một công cụ ORM dùng chung cho catalog và các module còn lại, tránh nhiều mô hình truy cập dữ liệu trong modular monolith.

**Hạn chế / chi phí**

- Cần sinh Prisma Client trong build và kiểm tra migration SQL tùy chỉnh, đặc biệt với `CHECK`, partial index hoặc truy vấn PostgreSQL đặc thù.
- Prisma không tự sinh migration rollback; cần quy trình migration sửa tiếp theo hoặc backup/restore.
- Các thay đổi schema và seed vẫn cần được triển khai, kiểm thử cùng CI; quyết định này chưa chứng minh chúng đã có trong mã nguồn hiện tại.
