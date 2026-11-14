# ADR-004: Transaction khi tạo đơn hàng và cập nhật tồn kho

- **Trạng thái:** Accepted
- **Ngày:** 2026-11-08
- **Liên quan:** FR đặt đơn, Task 1.3, Sequence diagram 2.2

## Bối cảnh
Khi khách đặt đơn, hệ thống phải tạo `Order`, `OrderItem` và trừ tồn kho. Nếu một bước lỗi hoặc hai khách đặt đồng thời món cuối cùng, dữ liệu có thể sai (đơn không đủ hàng, tồn kho âm, đơn tạo dở dang).

## Các lựa chọn
1. Không dùng transaction, kiểm tra tồn kho rồi trừ ở các câu lệnh riêng.
2. **Transaction PostgreSQL + trừ kho có điều kiện** (atomic update).
3. Khóa bi quan `SELECT ... FOR UPDATE` trên các dòng sản phẩm (Prisma phải dùng `$queryRaw`).
4. Hàng đợi/lock phân tán.

## Quyết định
Dùng **một transaction PostgreSQL** qua Prisma (`prisma.$transaction(async (tx) => { ... })`), với mức cô lập `READ COMMITTED` mặc định của PostgreSQL (hiện không cấu hình `isolationLevel` riêng), bao toàn bộ các bước tạo đơn:

1. Xác thực JWT và validate cấu trúc request trước transaction. Validate nghiệp vụ (sản phẩm còn khả dụng, size/topping hợp lệ, tính giá) bên trong transaction.
2. Mở transaction (`BEGIN`).
3. Gộp số lượng theo sản phẩm, xử lý `product_id` theo thứ tự tăng dần, rồi trừ kho có điều kiện qua `ProductsService.decreaseStock`. Hàm này dùng `tx.product.updateMany({ where: { id, isAvailable: true, stockQuantity: { gte: quantity } }, data: { stockQuantity: { decrement: quantity } } })` (cột PostgreSQL là `stock_quantity`). Nếu không có dòng nào được cập nhật, ném exception để Prisma `ROLLBACK` và trả lỗi `409 OUT_OF_STOCK`.
4. Tạo `Order` ở trạng thái mặc định `PENDING_PAYMENT` và các `OrderItem` (lưu giá tại thời điểm đặt).
5. Kết thúc callback thành công → `COMMIT`.

Ràng buộc `products_stock_quantity_check` (`CHECK (stock_quantity >= 0)`) trong migration Prisma là lớp bảo vệ cuối cùng ở DB. Theo thiết kế, đơn `PENDING_PAYMENT` quá thời hạn (ví dụ 15 phút) cần được job định kỳ chuyển sang `CANCELLED` và hoàn lại tồn kho trong cùng transaction. Job này **chưa được triển khai** trong API hiện tại. Job phải chỉ hoàn kho khi cập nhật có điều kiện từ `PENDING_PAYMENT` sang `CANCELLED` thành công, để tránh hoàn kho trùng nếu thanh toán xảy ra đồng thời.

Việc gọi Payment Gateway **không** nằm trong transaction này (xem ADR-005) để không giữ kết nối/lock DB trong lúc chờ hệ thống ngoài.

## Hệ quả
- (+) Tạo đơn và trừ kho là all-or-nothing; không bán vượt tồn kho khi đồng thời.
- (+) Trừ kho có điều kiện đơn giản, ít lock hơn `FOR UPDATE`.
- (–) Hàng bị giữ cho đến khi thanh toán hoặc hết hạn → cần triển khai job hủy đơn và hoàn kho.
- (–) Tồn kho theo từng sản phẩm; chưa mô hình hóa nguyên liệu/topping (ngoài phạm vi MVP).
- (–) Có thể có deadlock nếu nhiều đơn khóa các sản phẩm theo thứ tự khác nhau → gộp số lượng theo sản phẩm và luôn cập nhật theo `product_id` tăng dần.
