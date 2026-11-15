# BrewLite v1.0.0 — Release Notes

- **Ngày phát hành mục tiêu:** 2026-11-15
- **Tag phát hành:** `v1.0.0` (tạo sau khi merge toàn bộ 8 PR và chạy CD lên Render production)
- **Phạm vi:** Assignment 2 — BrewLite Coffee Ordering MVP

---

## 1. Tính năng Chính Đã Triển khai

1. **Thực đơn & Tùy biến đồ uống (`Customer PWA` — Next.js):**
   - Duyệt danh mục (`Cà phê`, `Trà trái cây & Trà sữa`), tìm kiếm tiếng Việt không dấu, phân trang 20 món.
   - Chọn size (`S/M/L`), chọn topping cộng dồn giá trực tiếp, kiểm soát tồn kho thời gian thực.
   - Giỏ hàng bền vững trên `localStorage['brewlite_cart']` đồng bộ đa tab (`storage` + `navigator.locks`).
   - Hỗ trợ PWA (`manifest.webmanifest`, `sw.js`, `offline.html`) và điều hướng responsive mobile bottom bar.
2. **Đặt hàng Nguyên tử & Thanh toán Mô phỏng Idempotent (`NestJS + PostgreSQL`):**
   - Xác thực JWT HS256 (`/auth/register`, `/auth/login`), phân quyền `CUSTOMER` / `STAFF`.
   - Tạo đơn `POST /orders` trong giao dịch Prisma với giá tính hoàn toàn từ DB và giữ tồn kho nguyên tử theo thứ tự `productId` tăng dần chống deadlock; từ chối `409 OUT_OF_STOCK` nếu không đủ hàng.
   - Thanh toán `POST /payments` bắt buộc `Idempotency-Key` UUID v4 (`400` khi thiếu/sai, `409` khi đang xử lý hoặc trùng đơn, `422` khi đổi payload); hoàn tồn kho nguyên tử một lần khi `DECLINED` (`402`); đối soát `GET /payments/:orderId/status` cho tình huống timeout.
3. **Vận hành Quầy & Quan sát Hệ thống:**
   - Nhân viên cập nhật trạng thái đơn hợp lệ tuyến tính (`PAID -> PREPARING -> READY -> COMPLETED`) qua `PATCH /orders/:id/status` (Swagger `/docs`), chặn nhảy cóc/chưa thanh toán (`400`), non-staff (`403`), và xung đột đồng thời (`409`).
   - `GET /health` kiểm tra kết nối PostgreSQL (`200`/`503`), `GET /health/live` kiểm tra liveness, log JSON che dữ liệu nhạy cảm.
4. **CI/CD & Kiểm thử Tự động:**
   - CI chạy Lint, Typecheck, Jest unit tests, Jest integration tests trên PostgreSQL 16 thật, Vitest component tests, Build API/Web, và Docker Compose config check.
   - CD build & push Docker image tag commit SHA lên GHCR, kích hoạt Render deploy và chạy `scripts/smoke-test.mjs`.

---

## 2. Giới hạn & Hạng mục Ngoài MVP (Đã ghi nhận minh bạch)

- **UI riêng cho Staff (`/staff`):** Cắt khỏi Web frontend theo quyết định phạm vi khẩn cấp; nhân viên thao tác trực tiếp qua `PATCH /orders/:id/status` trên Swagger UI `/docs`.
- **Khuyến mãi & Tích điểm (`FR-15`, `FR-34`):** Giữ cấu trúc bảng/module khung (`PromotionsModule`, `LoyaltyModule`), chưa kích hoạt tính toán giảm giá trong v1.0.0.
- **Trạng thái hạ tầng cloud:** `MANUAL_PENDING` cho tới khi TV1/TV2 hoàn tất deploy Render production, smoke test HTTPS URL và tag release `v1.0.0`.
