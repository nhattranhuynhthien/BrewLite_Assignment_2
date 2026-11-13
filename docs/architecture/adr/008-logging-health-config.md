# ADR-008: Logging, health check và quản lý cấu hình

- **Trạng thái:** Accepted
- **Ngày:** 2026-11-08

## Bối cảnh
Hệ thống phải vận hành được ở production: phát hiện lỗi, kiểm tra sau triển khai (smoke test), không lộ secret, cấu hình khác nhau giữa local/CI/production.

## Quyết định
- **Logging:** log JSON có cấu trúc (pino/nestjs-pino), gắn `requestId`, ghi ra stdout để nền tảng thu thập. Che hoặc không log mật khẩu, JWT, thông tin thẻ.
- **Health check:** `GET /health` (liveness) và kiểm tra kết nối DB (readiness) bằng `@nestjs/terminus`. Dùng cho Docker `HEALTHCHECK`, nền tảng triển khai và smoke test cuối pipeline.
- **Cấu hình:** biến môi trường theo 12-factor, đọc qua `@nestjs/config` và validate schema khi khởi động (thiếu biến → không chạy). Repo chỉ chứa `.env.example`; secret thật nằm trong secret của CI/nền tảng.

## Hệ quả
- (+) Smoke test sau deploy dựa trên endpoint chuẩn; dễ rollback khi health thất bại.
- (+) Cùng một image chạy ở mọi môi trường, chỉ khác biến môi trường.
- (+) Giảm nguy cơ lộ secret.
- (–) Cần kỷ luật che dữ liệu nhạy cảm trong log.
- (–) Chưa có hệ thống giám sát/tracing tập trung (ngoài phạm vi MVP).
