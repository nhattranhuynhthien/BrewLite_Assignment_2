Sơ đồ tổng quát: [use-case-overview.svg](../diagrams/use-case-overview.svg) (nguồn: [use-case-overview.puml](../diagrams/use-case-overview.puml)).
Bảng đặc tả Use Case

| Mục | Nội dung |
| --- | --- |
| **Mã / Tên** | UC-01 – Đặt và thanh toán đơn hàng |
| **Actor** | Chính: Khách hàng. Phụ: Payment Service |
| **Trigger** | Khách bấm “Đặt hàng” trong giỏ hàng |
| **Tiền điều kiện** | Đã đăng nhập; giỏ hàng có ít nhất 1 món |
| **Hậu điều kiện (thành công)** | Đơn được tạo, tồn kho đã trừ, thanh toán thành công, đơn ở trạng thái “Đã thanh toán”, khách thấy xác nhận |
| **Hậu điều kiện (thất bại)** | Không trừ tiền; tồn kho không bị trừ sai; khách được thông báo lỗi |
| **Liên kết yêu cầu** | FR-06, FR-07, FR-25–FR-34; NFR-01–NFR-07 (theo phạm vi áp dụng trong [SRS tổng quát](./srs.md)) |


1. Khách mở giỏ hàng và bấm “Đặt hàng”.
2. Hệ thống kiểm tra JWT hợp lệ.
3. Hệ thống validate giỏ hàng (giá, số lượng, tồn kho).
4. Hệ thống tạo đơn và trừ tồn kho trong một transaction.
5. Khách chọn phương thức thanh toán (Ví/Thẻ).
6. Hệ thống gọi Payment Service kèm idempotency key.
7. Payment Service trả thành công.
8. Hệ thống cập nhật trạng thái đơn và thanh toán.
9. Hệ thống hiển thị màn hình xác nhận đơn.

**Luồng thay thế :**

* **A1:** Khách áp mã khuyến mãi và điểm tích lũy trước bước 4 → hệ thống tính lại tổng tiền.
* **A2:** Khách đổi phương thức thanh toán trước khi xác nhận.

**Luồng ngoại lệ :**

* **E1:** Chưa đăng nhập/token hết hạn (bước 2) → chuyển sang trang đăng nhập, giữ giỏ hàng.
* **E2:** Hết hàng (bước 3 hoặc 5) → báo món nào hết, không tạo đơn, cho khách chỉnh giỏ.
* **E3:** Thanh toán thất bại (bước 7) → hệ thống chuyển đơn sang PAYMENT_FAILED, hoàn lại tồn kho đúng một lần và thông báo lỗi. Giỏ hàng được giữ nguyên để khách có thể tạo đơn mới và thanh toán lại; không cho thanh toán lại trên đơn đã PAYMENT_FAILED
* **E4:** Khách gửi lại yêu cầu thanh toán (bấm 2 lần/mạng chập chờn) → hệ thống dùng idempotency key, trả kết quả cũ, không trừ tiền lần hai.
* **E5:** Payment Service timeout → đơn ở trạng thái chờ, kiểm tra lại trạng thái giao dịch.
