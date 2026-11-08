# ADR-005: Idempotency cho API thanh toán

- **Trạng thái:** Accepted
- **Ngày:** 2026-11-08
- **Liên quan:** Task 1.3 (luồng ngoại lệ), Sequence diagram 2.2

## Bối cảnh
Client có thể gửi lại yêu cầu thanh toán do mạng chậm, timeout, người dùng bấm nhiều lần hoặc tải lại trang. Nếu không kiểm soát, một đơn có thể bị tính tiền nhiều lần hoặc nhận kết quả khác nhau cho cùng một ý định thanh toán.

## Các lựa chọn
1. Không xử lý (tin vào client).
2. Chỉ vô hiệu hóa nút ở UI.
3. Chỉ dựa vào trạng thái đơn (`PAID` thì từ chối).
4. **Idempotency-Key** do client sinh, lưu và đối chiếu ở server, kết hợp ràng buộc UNIQUE ở DB.

## Quyết định
Áp dụng lựa chọn 4 cho `POST /payments`:

- Client sinh `Idempotency-Key` (UUID v4) cho mỗi ý định thanh toán và **dùng lại đúng key đó khi retry**.
- Bảng `idempotency_keys`: `key`, `user_id`, `endpoint`, `request_hash`, `status` (`IN_PROGRESS` | `COMPLETED`), `response_status`, `response_body`, `created_at`, `expires_at`; ràng buộc `UNIQUE (user_id, key)` (`@@unique([userId, key])` trong `schema.prisma`).
- Quy trình:
  1. Chèn bản ghi `IN_PROGRESS` bằng `prisma.idempotencyKey.create`; nếu vi phạm unique (mã lỗi Prisma `P2002`) tức key đã tồn tại → đọc bản ghi cũ để quyết định bước 2–4.
  2. Nếu đã tồn tại và `COMPLETED` → trả **lại nguyên response đã lưu**, không gọi gateway.
  3. Nếu đã tồn tại và `IN_PROGRESS` → trả `409 Conflict` (hoặc `Retry-After`).
  4. Nếu `request_hash` khác với lần trước → `422` (key bị dùng lại cho nội dung khác).
  5. Xử lý thanh toán, lưu kết quả, đánh dấu `COMPLETED`.
- Lớp bảo vệ thứ hai: chỉ cho phép một `Payment` có trạng thái `SUCCESS` cho mỗi đơn (partial unique index `payments(order_id) WHERE status = 'SUCCESS'`, tạo bằng SQL thủ công trong migration Prisma), và gửi `Idempotency-Key` sang gateway nếu gateway hỗ trợ.
- Key hết hạn sau 24 giờ (job dọn dẹp).
- Kết quả **thất bại** cũng được lưu theo key; muốn thử lại với thẻ khác, client phải tạo key mới.

## Hệ quả
- (+) Retry an toàn, không tính tiền hai lần, phản hồi nhất quán.
- (+) Có thể kiểm thử tự động (gửi cùng key 2 lần → 1 payment).
- (–) Thêm một bảng, một bước ghi DB cho mỗi thanh toán.
- (–) Client phải quản lý key đúng cách (giữ key khi retry).
- (–) Trường hợp server sập giữa lúc `IN_PROGRESS` cần job xử lý các key treo (đối soát với gateway/timeout).
