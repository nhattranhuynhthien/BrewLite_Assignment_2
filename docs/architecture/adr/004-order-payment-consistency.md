# ADR-004: Đảm bảo tính nhất quán trong đặt hàng và thanh toán

- **Trạng thái:** Accepted
- **Ngày:** 2026-11-08
- **Người quyết định:** Nhóm BrewLite
- **Liên quan:** [SRS](../../requirements/srs.md) (FR-06, FR-07, FR-25–FR-33, NFR-06, NFR-08), [Use-case checkout](../../requirements/use-case-checkout.md), [Sequence-01](../../diagrams/sequence-checkout.puml), [Kiến trúc hệ thống](../architecture.md)

## Bối cảnh
Khi khách đặt đơn, hệ thống phải tạo `Order`, `OrderItem` và trừ tồn kho. Nếu một bước lỗi hoặc hai khách đặt đồng thời món cuối cùng, dữ liệu có thể sai (đơn không đủ hàng, tồn kho âm, đơn tạo dở dang).

Client cũng có thể gửi lại yêu cầu thanh toán do mạng chậm, timeout, người dùng bấm nhiều lần hoặc tải lại trang. Nếu không kiểm soát, một đơn có thể bị tính tiền nhiều lần hoặc nhận kết quả khác nhau cho cùng một ý định thanh toán.

## Các lựa chọn

### Transaction tạo đơn và cập nhật tồn kho
1. Không dùng transaction, kiểm tra tồn kho rồi trừ ở các câu lệnh riêng.
2. **Transaction PostgreSQL + trừ kho có điều kiện** (atomic update).
3. Khóa bi quan `SELECT ... FOR UPDATE` trên các dòng sản phẩm (Prisma phải dùng `$queryRaw`).
4. Hàng đợi/lock phân tán.

### Idempotency thanh toán
1. Không xử lý (tin vào client).
2. Chỉ vô hiệu hóa nút ở UI.
3. Chỉ dựa vào trạng thái đơn (`PAID` thì từ chối).
4. **Idempotency-Key** do client sinh, lưu và đối chiếu ở server, kết hợp ràng buộc UNIQUE ở DB.

## Quyết định

### 1. Transaction tạo đơn và giữ tồn kho
Dùng **một transaction PostgreSQL** qua Prisma (`prisma.$transaction(async (tx) => { ... })`), với mức cô lập `READ COMMITTED` mặc định của PostgreSQL, bao toàn bộ các bước tạo đơn:

1. Xác thực JWT và validate cấu trúc request trước transaction. Validate nghiệp vụ (sản phẩm còn khả dụng, size/topping hợp lệ, tính giá) bên trong transaction.
2. Mở transaction (`BEGIN`).
3. Gộp số lượng theo sản phẩm, xử lý `product_id` theo thứ tự tăng dần, rồi trừ kho có điều kiện qua `ProductsService.decreaseStock`. Hàm này dùng `tx.product.updateMany({ where: { id, isAvailable: true, stockQuantity: { gte: quantity } }, data: { stockQuantity: { decrement: quantity } } })` (cột PostgreSQL là `stock_quantity`). Nếu không có dòng nào được cập nhật, ném exception để Prisma `ROLLBACK` và trả lỗi `409 OUT_OF_STOCK`.
4. Tạo `Order` ở trạng thái mặc định `PENDING_PAYMENT` cùng các `OrderItem`, `OrderItemTopping` (lưu snapshot tên, giá, size, topping tại thời điểm đặt).
5. Kết thúc callback thành công → `COMMIT`.

Ràng buộc `products_stock_quantity_check` (`CHECK (stock_quantity >= 0)`) trong migration Prisma là lớp bảo vệ cuối cùng ở DB. Đơn `PENDING_PAYMENT` quá thời hạn (ví dụ 15 phút) được job định kỳ chuyển sang `CANCELLED` và hoàn lại tồn kho trong cùng transaction; job chỉ hoàn kho khi cập nhật có điều kiện từ `PENDING_PAYMENT` sang `CANCELLED` thành công, để tránh hoàn kho trùng nếu thanh toán xảy ra đồng thời.

### 2. Idempotency cho API thanh toán
Áp dụng lựa chọn 4 cho `POST /payments`:

- Client sinh `Idempotency-Key` (UUID v4) cho mỗi ý định thanh toán và **dùng lại đúng key đó khi retry**.
- Bảng `idempotency_keys` lưu `key`, `user_id`, `endpoint`, `request_hash`, `status` (`IN_PROGRESS` | `COMPLETED`), `response_status`, `response_body`, `created_at`, `expires_at`; ràng buộc `UNIQUE (user_id, key)` (`@@unique([userId, key])` trong `schema.prisma`).
- Quy trình:
  1. Tạo bản ghi `IN_PROGRESS` và `Payment` trong một transaction ngắn. Nếu vi phạm unique (mã lỗi Prisma `P2002`), đọc bản ghi key đã có và áp dụng các quy tắc bên dưới.
  2. Nếu key đã tồn tại nhưng `request_hash` khác lần trước → trả `422` (key bị dùng lại cho nội dung khác).
  3. Nếu key đã tồn tại và `COMPLETED` → trả lại nguyên response đã lưu, không gọi gateway.
  4. Nếu key đã tồn tại và `IN_PROGRESS` → trả `409 Conflict` (có thể kèm `Retry-After`).
  5. Gọi Payment Gateway **ngoài transaction DB**, gửi kèm idempotency key:
     - **Thành công (`SUCCESS`):** cập nhật `Payment = SUCCESS`, `Order = PAID`, đánh dấu key `COMPLETED`.
     - **Thất bại (`FAILED`):** cập nhật `Payment = FAILED`, chuyển đơn sang trạng thái cuối `Order = PAYMENT_FAILED`, hoàn lại tồn kho đúng một lần trong cùng transaction (cập nhật có điều kiện `WHERE status = 'PENDING_PAYMENT'`) và đánh dấu key `COMPLETED`.
     - **Timeout:** giữ `Payment = PENDING`, `Order = PENDING_PAYMENT`, trả `202 Accepted` và đối soát qua `getStatus(idempotencyKey)` trước khi chốt `PAID` hoặc `PAYMENT_FAILED` (kèm hoàn kho đúng một lần).
- Lớp bảo vệ thứ hai: chỉ cho phép một `Payment` có trạng thái `SUCCESS` cho mỗi đơn (partial unique index `payments(order_id) WHERE status = 'SUCCESS'`, tạo bằng SQL thủ công trong migration Prisma).
- Key có `expires_at` sau 24 giờ; cần job dọn dẹp các key hết hạn.
- Kết quả **thất bại** cũng được lưu theo key và đơn đã chuyển sang trạng thái cuối `PAYMENT_FAILED` (đã hoàn kho); muốn thanh toán lại, client phải tạo **đơn mới** từ giỏ hàng kèm **`Idempotency-Key` mới** (không thanh toán lại trên đơn đã `PAYMENT_FAILED`).
- Trường hợp server sập khi key còn `IN_PROGRESS` cần được job xử lý bằng cách đối soát với gateway hoặc áp dụng timeout phù hợp.

## Hệ quả
- (+) Tạo đơn và trừ kho là all-or-nothing; cập nhật có điều kiện ngăn bán vượt tồn kho khi có yêu cầu đồng thời.
- (+) Retry thanh toán an toàn, không tính tiền hai lần, phản hồi nhất quán.
- (+) Trừ kho có điều kiện đơn giản, ít lock hơn `FOR UPDATE`.
- (–) Thêm một bảng và một bước ghi DB cho mỗi thanh toán; client phải giữ đúng key khi retry.
- (–) Hàng bị giữ cho đến khi thanh toán hoặc hết hạn → cần triển khai job hủy đơn và hoàn kho.
- (–) Cần job đối soát key `IN_PROGRESS` và dọn dẹp key hết hạn.
- (–) Có thể có deadlock nếu nhiều đơn khóa các sản phẩm theo thứ tự khác nhau → gộp số lượng theo sản phẩm và luôn cập nhật theo `product_id` tăng dần.
- (–) Tồn kho theo từng sản phẩm; chưa mô hình hóa nguyên liệu/topping (ngoài phạm vi MVP).
