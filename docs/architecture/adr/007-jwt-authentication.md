# ADR-007: Xác thực bằng JWT

- **Trạng thái:** Accepted
- **Ngày:** 2026-11-08

## Bối cảnh
Đặt đơn, thanh toán và xem lịch sử yêu cầu đăng nhập; đề bài yêu cầu đăng ký, đăng nhập và JWT. Sequence diagram có bước kiểm tra JWT.

## Các lựa chọn
1. Session phía server (cookie + store).
2. **JWT access token** (+ refresh token tùy chọn).
3. OAuth/SSO bên thứ ba.

## Quyết định
Dùng **JWT** ký HS256 (secret từ biến môi trường), thời hạn access token ngắn (ví dụ 15–60 phút), payload gồm `sub` (userId) và `role`. Mật khẩu băm bằng bcrypt/argon2. NestJS `JwtAuthGuard` bảo vệ các endpoint đơn hàng/thanh toán; `RolesGuard` phân quyền khách hàng/nhân viên/quản lý. Client gửi `Authorization: Bearer <access_token>`.

## Hệ quả
- (+) Stateless, dễ chạy nhiều instance, phù hợp tách web/API.
- (+) Tích hợp sẵn với NestJS (`@nestjs/jwt`, Passport).
- (–) Khó thu hồi token trước hạn → giữ thời hạn ngắn, có thể bổ sung refresh token/blacklist.
- (–) Lưu token ở client có rủi ro XSS → ưu tiên cookie `HttpOnly` hoặc bảo vệ XSS chặt (CSP, escape dữ liệu).
