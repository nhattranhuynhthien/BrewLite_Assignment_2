# Sprint 2 Review & Retrospective — BrewLite

- **Phạm vi Sprint 2:** Giao dịch đặt đơn + thanh toán mô phỏng idempotent + hoàn tồn kho (PR-5), Đăng nhập/Thanh toán/Theo dõi đơn + Playwright E2E + Ma trận truy vết + Release Notes (PR-7), và CD Pipeline + Nghiệm thu Production (PR-8).

---

## 1. Kết quả Kiểm chứng Kỹ thuật Đã Đạt (Local & CI Gates)

- **Backend API & PostgreSQL:** Toàn bộ unit tests (11 suites / 37 tests) và integration tests trên PostgreSQL 16 thật (9 kịch bản: `/health`, auth+search không dấu, 400 `Idempotency-Key`, 403 ownership, idempotent replay, declined stock restore, timeout reconciliation, concurrent last stock `201/409`, concurrent different keys `200/409`, staff `PATCH /orders/:id/status`) đều chạy thật và đạt.
- **Frontend Web & PWA:** Lint, TypeScript check, Vitest component/store tests (`env`, `cart`, `Menu`, `ProductDetail`, `Cart`, `Auth`), Next.js production build đạt.
- **End-to-End (Playwright):** Kiểm thử toàn trình khách hàng (Menu -> Detail -> `brewlite_cart` persist -> Đăng ký/Đăng nhập -> Checkout SUCCESS -> Staff `PATCH /orders/:id/status` -> UI hiển thị `Hoàn tất`) và kịch bản `DECLINED` hoàn tồn kho trên trình duyệt thật.

---

## 2. Bài học & Hành động Thủ công Còn lại (`MANUAL_PENDING`)

1. **Ràng buộc DB cho thanh toán đồng thời với hai `Idempotency-Key` khác nhau:** Khi kiểm tra integration test đồng thời phát hiện cần thêm partial unique index `payments_one_active_or_success_per_order` (`WHERE status IN ('PENDING', 'SUCCESS')`) trong migration để PostgreSQL chặn hoàn toàn hai giao dịch `PENDING` song song trước khi chạm mock gateway.
2. **Hạng mục cần thành viên hoàn tất thủ công trên GitHub & Render:**
   - Merge tuần tự các PR kèm review chéo và chụp ảnh CI fail -> fix -> pass (`I-18`).
   - Cấu hình GitHub Repository Ruleset/Branch Protection, mời tài khoản giảng viên (`I-46`), tạo Issue `I-46`–`I-50` còn thiếu.
   - Thiết lập Render Managed PostgreSQL (private) + Web + API services + GHCR secrets, kiểm tra smoke test URL production thật, quay video demo (`I-41`), và gán tag `v1.0.0` (`I-45`).
