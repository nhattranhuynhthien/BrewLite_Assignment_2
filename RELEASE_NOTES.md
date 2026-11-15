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
3. **Khuyến mãi & Tích điểm (`FR-15`, `FR-34`):**
   - Duyệt khuyến mãi đang hiệu lực (`GET /promotions`), kiểm tra & áp dụng mã giảm giá (`POST /promotions/validate`, kèm `promoCode` trong `POST /orders`), tự hoàn lượt sử dụng khi thanh toán thất bại hoặc hết hạn.
   - Tích điểm sau khi thanh toán thành công (`EARN`), đổi điểm tích lũy (`redeemPoints`) khi đặt đơn và xem số dư/lịch sử giao dịch điểm (`GET /loyalty/me`), hoàn điểm nếu thanh toán không thành công.
4. **Vận hành Quầy (`/staff`) & Quan sát Hệ thống (`FR-37`–`FR-39`):**
   - Trang điều phối quầy `/staff` trên Web PWA và API `GET /orders?scope=all`, `PATCH /orders/:id/status` cho phép nhân viên `STAFF` lọc theo trạng thái và chuyển trạng thái tuyến tính (`PAID -> PREPARING -> READY -> COMPLETED`), chặn nhảy cóc/chưa thanh toán (`400`), non-staff (`403`), và xung đột đồng thời (`409`).
   - `GET /health` kiểm tra kết nối PostgreSQL (`200`/`503`), `GET /health/live` kiểm tra liveness, log JSON che dữ liệu nhạy cảm.
5. **CI/CD & Kiểm thử Tự động:**
   - CI chạy Lint, Typecheck, Jest unit tests, Jest integration tests trên PostgreSQL 16 thật, Vitest component tests, Build API/Web, và Docker Compose config check.
   - CD build & push Docker image tag commit SHA lên GHCR, kích hoạt Render deploy và chạy `scripts/smoke-test.mjs`.

---

## 2. Trạng thái Triển khai & Ghi chú Phát hành

- **Hạng mục đã hoàn thiện thêm:** Kích hoạt đầy đủ tính năng Khuyến mãi (`PromotionsModule`), Tích điểm (`LoyaltyModule`) và giao diện Vận hành Quầy (`/staff`) trên Web frontend lẫn API backend.
- **Trạng thái hạ tầng cloud:** `MANUAL_PENDING` cho tới khi TV1/TV2 hoàn tất deploy Render production, smoke test HTTPS URL và tag release `v1.0.0`.
