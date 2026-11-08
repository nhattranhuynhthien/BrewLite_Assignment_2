# ADR 003: ORM, schema và migration cho catalog

| Mục | Nội dung |
|---|---|
| Trạng thái | Đề xuất (Proposed) – chờ review của TV4 và TV1 |
| Ngày | 2026-11-01 |
| Người quyết định | Đỗ Hoàng Vinh (TV3) |
| Task / Issue | 3.1 – Kiến trúc và ADR (D-16, I-11) |
| Liên quan | Class-01 (`docs/diagrams/class-domain.puml`), `srs-menu-product.md` (FR-01..FR-08, NFR-02), ADR 001 (monorepo + Docker), ADR 004 (transaction đơn hàng) |

## 1. Bối cảnh

Backend NestJS lưu dữ liệu trong PostgreSQL. Cần chọn công cụ truy cập dữ liệu và cách quản lý schema cho nhóm catalog (Category, Product, Size, Topping), đồng thời cho các thực thể dùng chung (User, Order…) để mọi module thống nhất.

Các yêu cầu tác động đến quyết định:

- Entity phải khớp class diagram (Class-01) và truy vết được từ SRS.
- Database phải tái tạo được bằng một lệnh (migration + seed) – FR-08, và phải chạy được trong CI với service Postgres.
- Giá là số nguyên VND, tồn kho không âm – NFR-02.
- `POST /orders` phải chạy trong transaction, trừ tồn kho an toàn khi có truy cập đồng thời (ADR 004).
- Nhóm 6 người, thời gian một học kỳ; ưu tiên công cụ dễ học và tích hợp tốt với NestJS.

## 2. Các phương án

| Tiêu chí | **TypeORM** | Prisma | Drizzle / Knex |
|---|---|---|---|
| Tích hợp NestJS | Có module chính thức `@nestjs/typeorm`, tài liệu NestJS dùng làm ví dụ mặc định | Cần tự bọc `PrismaService` | Tự tích hợp |
| Mô hình | Entity là class có decorator, gần với class diagram | Schema riêng `schema.prisma`, sinh client | Schema bằng code/SQL builder |
| Migration | CLI sinh và chạy migration; viết SQL tay được (CHECK, index) | Prisma Migrate mạnh, SQL tùy chỉnh làm được nhưng phải sửa file sinh ra | Tùy công cụ |
| Transaction | `DataSource.transaction`, `QueryRunner`, khóa dòng (`pessimistic_write`) | `$transaction` (interactive); khóa dòng cần raw query | Có |
| Đường cong học | Thấp với người đã biết OOP/decorator | Thấp, thêm bước sinh client | Trung bình |
| Rủi ro | Một số hành vi mặc định dễ gây lỗi (ví dụ `synchronize`, kiểu số thập phân trả về dạng chuỗi) | Thêm bước `generate` trong CI/Docker | Ít người trong nhóm quen |

## 3. Quyết định

1. **ORM: TypeORM** qua `@nestjs/typeorm`, vì tích hợp sẵn với NestJS, mô hình entity-class khớp trực tiếp với class diagram và backlog (S1-10: "Entity Product/Size/Topping"), và hỗ trợ transaction, khóa dòng và migration SQL tùy chỉnh mà ADR 004 cần.
2. **Schema do migration quản lý, không dùng `synchronize`.** `synchronize: false` ở mọi môi trường; mọi thay đổi schema đi qua file migration được commit và review.
3. **Quy ước schema:**
   - Bảng và cột `snake_case`, tên bảng số nhiều (`products`, `order_items`); dùng `SnakeNamingStrategy` để entity vẫn viết `camelCase`.
   - Khóa chính `uuid` (sinh bằng `gen_random_uuid()`), tránh lộ số thứ tự đơn hàng.
   - **Tiền tệ là `integer` (VND, không có phần thập phân)** nên không dùng `numeric`; tránh lỗi kiểu chuỗi của driver và sai số.
   - Ràng buộc ở database: `CHECK (stock_quantity >= 0)`, `CHECK (base_price >= 0)`, `CHECK (extra_price >= 0)`, `UNIQUE` cho `categories.name`, `toppings.name`, `users.email`, `promotions.code`, `payments.idempotency_key`.
   - `created_at`, `updated_at` kiểu `timestamptz`.
   - **Snapshot trong đơn hàng:** `order_items` và `order_item_toppings` lưu tên và giá tại thời điểm đặt; không join ngược để tính lại giá đơn cũ.
   - Quan hệ nhiều-nhiều Product–Topping dùng bảng nối `product_toppings (product_id, topping_id)` với khóa chính kép.
   - Size thuộc về Product (xóa product thì xóa size, `ON DELETE CASCADE`); khóa ngoại từ `order_items` tới `products`/`sizes` dùng `ON DELETE RESTRICT` để không xóa mất lịch sử đơn.
   - Chỉ mục: `products(category_id)`, `products(is_available)`, `sizes(product_id)`, `orders(user_id, created_at DESC)`.
4. **Không dùng soft delete cho catalog.** MVP không có chức năng xóa sản phẩm (FR-09 là Won't); ẩn món bằng `is_available = false`.
5. **Migration và seed:**
   - Thư mục `apps/api/src/database/migrations`, một migration cho mỗi thay đổi có ý nghĩa, đặt tên `<timestamp>-<mo-ta>.ts`.
   - Seed nằm ở `apps/api/src/database/seeds`, **idempotent** (kiểm tra theo khóa tự nhiên như `name` hoặc `code`, dùng upsert) để chạy lặp lại không nhân đôi dữ liệu.
   - Script trong `apps/api/package.json`: `db:migrate`, `db:migrate:revert`, `db:seed`, `db:reset` (drop → migrate → seed, chỉ cho môi trường local/test). Một lệnh `db:setup` = migrate + seed.
   - Production và CD chỉ chạy `db:migrate`; **không** chạy `db:reset`. Seed demo trên production do TV2 quyết định và chạy có chủ đích.
6. **Truy vấn catalog:** `GET /products` dùng `QueryBuilder` hoặc `find` với `skip/take`, `limit` tối đa 50, join danh mục; `GET /products/:id` nạp size và topping khả dụng bằng quan hệ, không dùng `eager: true` ở entity để tránh nạp thừa.
7. **Tồn kho:** hàm trừ tồn kho dùng câu lệnh có điều kiện (`UPDATE products SET stock_quantity = stock_quantity - :q WHERE id = :id AND stock_quantity >= :q`) và kiểm tra số dòng bị ảnh hưởng, chạy trong transaction của `POST /orders`, để hai yêu cầu đồng thời không làm tồn kho âm. Chi tiết transaction nằm ở ADR 004.

## 4. Hệ quả

**Tích cực**
- Entity, migration và class diagram cùng một mô hình, dễ truy vết và review.
- Một lệnh tái tạo database cho local, CI và demo (FR-08).
- Ràng buộc CHECK/UNIQUE ở database bảo vệ dữ liệu ngay cả khi lỗi ở tầng ứng dụng (NFR-02).
- Dùng chung TypeORM cho mọi module nên TV2 và TV4 không phải học thêm công cụ.

**Tiêu cực / hạn chế**
- TypeORM có nhiều hành vi ngầm (lazy/eager, cascade); cần quy ước code và review kỹ.
- Migration sinh tự động đôi khi sai hoặc thiếu CHECK/index; phải đọc lại và chỉnh tay trước khi commit.
- Truy vấn phức tạp (tìm không dấu, báo cáo) có thể phải viết SQL thuần.
- Nếu sau này cần type-safety mạnh hơn, đổi sang Prisma/Drizzle sẽ tốn công vì entity gắn với decorator.

**Việc cần làm theo**
- TV1: thêm biến môi trường kết nối DB vào `.env.example`; bước `db:migrate` trong CD (ADR 001 / deployment diagram).
- TV4: cập nhật entity Order/OrderItem/Payment theo Class-01 và migration tương ứng; thống nhất kiểu tiền `integer`.
- TV2: entity User/Promotion/LoyaltyTransaction theo Class-01.
- TV6: đưa script `db:setup` vào README.

## 5. Phương án đã loại

- **Prisma**: tốt về type-safety nhưng cần thêm bước sinh client trong Docker/CI, khóa dòng phải dùng raw query, và nhóm phải học thêm ngôn ngữ schema riêng.
- **Knex/Drizzle hoặc SQL thuần**: linh hoạt nhưng phải tự viết nhiều mã lặp, ít tài liệu NestJS, không phù hợp thời gian học kỳ.
- **`synchronize: true`**: tiện khi phát triển nhưng có thể làm mất dữ liệu trên production và không có lịch sử thay đổi schema.

## 6. Lịch sử thay đổi

| Ngày | Tác giả | Thay đổi / Lý do |
|---|---|---|
| 2026-11-01 | Đỗ Hoàng Vinh | Tạo ADR ở trạng thái Proposed |
