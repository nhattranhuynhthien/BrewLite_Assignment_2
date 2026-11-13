# ADR-002: Backend NestJS theo kiến trúc modular monolith

- **Trạng thái:** Accepted
- **Ngày:** 2026-11-08

## Bối cảnh
Backend phải xử lý menu, xác thực, đơn hàng, thanh toán, khuyến mãi, tích điểm. Nhóm nhỏ, thời gian hai Sprint, cần triển khai dễ và đảm bảo nhất quán dữ liệu đơn hàng/thanh toán.

## Các lựa chọn
1. **Modular monolith**: một ứng dụng NestJS, chia module theo domain.
2. Microservices: tách service Order, Payment, Product...

## Quyết định
Chọn **modular monolith**. Mỗi domain là một NestJS module (`auth`, `products`, `orders`, `payments`, `promotions`, `loyalty`, `health`), phân lớp Controller → Service → PrismaService. Module chỉ giao tiếp qua service được export.

## Hệ quả
- (+) Transaction ACID đơn giản vì dùng chung một DB.
- (+) Một container API, ít cấu hình mạng, dễ debug, dễ kiểm thử tích hợp.
- (+) Ranh giới module rõ giúp tách service về sau nếu cần.
- (–) Không scale độc lập từng module; một lỗi nghiêm trọng có thể ảnh hưởng toàn API.
- (–) Cần kỷ luật để module không phụ thuộc vòng hoặc truy cập bảng của nhau.
