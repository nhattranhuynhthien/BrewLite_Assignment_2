# Sprint 1 Review & Retrospective — BrewLite

- **Phạm vi Sprint 1:** Foundation monorepo, PostgreSQL schema/migration, Auth (JWT HS256), Health check, Catalog (Categories, Products, Sizes, Toppings, Seed), và UI Thực đơn / Chi tiết đồ uống / Giỏ hàng.
- **Trạng thái nghiệm thu:** Hoàn thành khi PR-1 (Contract), PR-2 (Foundation), PR-3 (Auth & Health), PR-4 (Catalog & Seed & Order Status) và PR-6 (Web Menu/Cart/PWA) hợp nhất vào `main` và CI xanh.

---

## 1. Kết quả đạt được

- **Hợp đồng API thống nhất:** Hoàn chỉnh `docs/api-contract.yaml` và đồng bộ enum `OrderStatus`, `PaymentMethod`, snapshot giá `OrderItem` với SRS & UML Class Diagram.
- **Dữ liệu & Schema chuẩn hóa:** Schema PostgreSQL áp dụng ràng buộc `CHECK` giá/tồn kho không âm và chỉ mục duy nhất một thanh toán `SUCCESS` mỗi đơn hàng.
- **Xác thực & Danh mục:** API đăng ký/đăng nhập JWT HS256, `/health` kiểm tra DB readiness (`200`/`503`), tìm kiếm thực đơn tiếng Việt không dấu, phân trang 20 món.

---

## 2. Vấn đề tồn đọng & Bài học rút ra

1. **Lệch phiên bản Enum giữa Task 1–3 và code khởi tạo:** Giai đoạn đầu tạo migration dùng enum cũ (`CONFIRMED`, `CASH`) gây xung đột với SRS (`PAID`, `PAYMENT_FAILED`, `WALLET`, `CARD`).
   - *Hành động khắc phục:* Đồng bộ `docs/api-contract.yaml` trước và sinh lại SQL migration thống nhất trước khi mở rộng Sprint 2.
2. **Thiếu chuẩn UTF-8 ở một số file nháp và thiếu JSX transform trong Vitest:** Một số chuỗi tiếng Việt bị biến thành `?` và component test lỗi `React is not defined`.
   - *Hành động khắc phục:* Bắt buộc bật UTF-8 không BOM và chạy `vitest` + `tsc` + `lint` trong CI trước mọi merge.

---

## 3. Kế hoạch bước tiếp theo (Sprint 2)

- Hoàn thiện giao dịch đặt đơn + thanh toán mô phỏng idempotent + khôi phục tồn kho nguyên tử (PR-5).
- Hoàn thiện luồng Checkout + Lịch sử đơn + E2E Playwright (PR-7).
- Triển khai CD pipeline và nghiệm thu production Render (PR-8).
