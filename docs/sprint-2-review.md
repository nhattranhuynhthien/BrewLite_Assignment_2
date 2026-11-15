# Sprint 2 Review & Retrospective — BrewLite

- **Phạm vi Sprint 2:** Giao dịch đặt đơn + thanh toán mô phỏng idempotent + hoàn tồn kho (PR-5), Đăng nhập/Thanh toán/Theo dõi đơn + Playwright E2E + Ma trận truy vết + Release Notes (PR-7), và CD Pipeline + Nghiệm thu Production (PR-8).

---

## 1. Kết quả Kiểm chứng Kỹ thuật Đã Đạt (Local & CI Gates)

- **Backend API & PostgreSQL:** Toàn bộ unit tests (13 suites / 66 tests) và integration tests trên PostgreSQL 16 thật (15 kịch bản: `/health`, auth+search không dấu, 400 `Idempotency-Key`, 403 ownership, idempotent replay, declined stock restore, timeout reconciliation, concurrent last stock `201/409`, concurrent different keys `200/409`, staff `PATCH /orders/:id/status`, promotion/loyalty `I-35`, whitelist DTO, bcrypt 72-byte, expiry/lease recovery & concurrent reconcile) đều chạy thật và đạt trong CI/local.
- **Frontend Web & PWA:** Lint, TypeScript check, Vitest component/store tests (8 files / 18 tests: `env`, `cart`, `Menu`, `ProductDetail`, `Cart`, `Auth`, `Checkout`, `Staff`), Next.js production build đạt.
- **End-to-End (Playwright):** Kiểm thử toàn trình khách hàng (Menu -> Detail -> `brewlite_cart` persist -> Đăng ký/Đăng nhập -> Checkout SUCCESS -> Staff `PATCH /orders/:id/status` -> UI hiển thị `Hoàn tất`) và kịch bản `DECLINED` hoàn tồn kho trên trình duyệt thật.

---

## 2. Bài học & Trạng thái Hoàn tất Bàn giao

1. **Ràng buộc DB cho thanh toán đồng thời với hai `Idempotency-Key` khác nhau:** Khi kiểm tra integration test đồng thời phát hiện cần thêm partial unique index `payments_one_active_or_success_per_order` (`WHERE status IN ('PENDING', 'SUCCESS')`) trong migration để PostgreSQL chặn hoàn toàn hai giao dịch `PENDING` song song trước khi chạm mock gateway.
2. **Tổng kết kiểm chứng GitHub & Render Production:**
   - Đã hoàn tất merge các PR #74–#83 và #86–#89 vào `main` (`75bd0e3`, bao gồm cả tính năng bổ sung `/staff`, `Promotion`/`Loyalty` `I-35` và cập nhật tài liệu bàn giao), minh chứng CI đỏ -> xanh (`I-18`, PR #84: fail `31da54a` -> pass `4ed4ae3`), cấp quyền giảng viên & tạo đủ Issue `I-46..I-50`.
   - Đã triển khai sống Render PostgreSQL private + API (`https://brewlite-api-nz0h.onrender.com`) + Web (`https://brewlite-web-587y.onrender.com`), diễn tập rollback `brewlite-api` (`0489efa` -> `17e4014` -> khôi phục `0489efa`, `scripts/smoke-test.mjs` PASS), và phát hành tag `v1.0.0`.
   - **Video Demo E2E trên Production (`I-41` — TV5):** https://drive.google.com/file/d/1dS5-W5MC-p_4SJpQD6M1TPccmSW7MuUD/view?usp=sharing (đã gắn vào `README.md`, `RELEASE_NOTES.md` và `docs/traceability-matrix.md`).
   - **GitHub Project Board (`I-48`):** https://github.com/users/nhattranhuynhthien/projects/3 (Public — liên kết trực tiếp repo, đủ 51/51 issues với assignee, label và cột `Todo / In Progress / In Review / Done`).
