# ADR-006: Dịch vụ thanh toán mô phỏng qua interface PaymentGateway

- **Trạng thái:** Accepted
- **Ngày:** 2026-11-08

## Bối cảnh
Đề bài yêu cầu thanh toán Ví/Thẻ mô phỏng. Cần kiểm thử được các trường hợp thành công, thất bại, timeout mà không phụ thuộc dịch vụ ngoài.

## Các lựa chọn
1. Gọi trực tiếp logic giả lập trong `PaymentsService`.
2. **Interface `PaymentGateway` + `MockPaymentGateway`** trong cùng NestJS API.
3. Dựng service mô phỏng riêng (container riêng).
4. Dùng sandbox cổng thật (VNPay, Stripe...).

## Quyết định
Chọn lựa chọn 2. `PaymentsService` chỉ phụ thuộc interface `PaymentGateway.charge()`. `MockPaymentGateway` quyết định kết quả theo cấu hình hoặc số thẻ/ví thử nghiệm (thành công, từ chối, timeout, độ trễ giả lập). Provider được chọn qua biến môi trường `PAYMENT_PROVIDER=mock`.

## Hệ quả
- (+) Kiểm thử đầy đủ nhánh thành công/thất bại và idempotency, không cần mạng.
- (+) Thay bằng cổng thật chỉ cần thêm adapter mới.
- (+) Không thêm container, đơn giản triển khai.
- (–) Không mô phỏng đầy đủ webhook, đối soát, 3-D Secure.
- (–) Mock chạy chung tiến trình API nên không kiểm thử được lỗi mạng thật; bù bằng cách giả lập timeout.
