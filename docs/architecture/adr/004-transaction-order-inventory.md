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
Dùng **một transaction PostgreSQL** qua Prisma (`prisma.$transaction(async (tx) => { ... })`, mức `READ COMMITTED`) bao toàn bộ các bước tạo đơn:

1. Validate dữ liệu và JWT (trước transaction).
2. Mở transaction (`BEGIN`).
3. Với mỗi dòng hàng, trừ kho có điều kiện bằng `tx.product.updateMany({ where: { id, stock: { gte: qty } }, data: { stock: { decrement: qty } } })` (tương đương `UPDATE ... SET stock = stock - :qty WHERE id = :id AND stock >= :qty`). Nếu `count === 0` → ném exception để Prisma `ROLLBACK`, trả lỗi `409 OUT_OF_STOCK`.
4. Tạo `Order` (`PENDING_PAYMENT`) và `OrderItem` (lưu giá tại thời điểm đặt).
5. Kết thúc callback thành công → `COMMIT`.

Ràng buộc `CHECK (stock >= 0)` (thêm bằng SQL thủ công trong migration Prisma) là lớp bảo vệ cuối cùng ở DB. Đơn `PENDING_PAYMENT` quá thời hạn (ví dụ 15 phút) bị hủy bởi job định kỳ, trong cùng transaction hoàn lại tồn kho.

Việc gọi Payment Gateway **không** nằm trong transaction này (xem ADR-005) để không giữ kết nối/lock DB trong lúc chờ hệ thống ngoài.

## Hệ quả
- (+) Tạo đơn và trừ kho là all-or-nothing; không bán vượt tồn kho khi đồng thời.
- (+) Trừ kho có điều kiện đơn giản, ít lock hơn `FOR UPDATE`.
- (–) Hàng bị giữ cho đến khi thanh toán hoặc hết hạn → cần job hủy đơn và hoàn kho.
- (–) Tồn kho theo từng sản phẩm; chưa mô hình hóa nguyên liệu/topping (ngoài phạm vi MVP).
- (–) Có thể có deadlock nếu nhiều đơn khóa các sản phẩm theo thứ tự khác nhau → luôn xử lý các dòng hàng theo `product_id` tăng dần.
