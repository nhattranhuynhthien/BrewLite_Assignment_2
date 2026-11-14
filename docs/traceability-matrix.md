# Ma trận truy vết yêu cầu — BrewLite

- **Phiên bản:** 1.0 (cập nhật 2026-11-15)
- **Nguồn chuẩn:** Mẫu 5 cột mục 8.1 Assignment 2; [SRS tổng quát](requirements/srs.md); [Đặc tả UC-01](requirements/use-case-checkout.md); [Kiến trúc hệ thống](architecture/architecture.md); [ADR-001](architecture/adr/001-monorepo.md)–[ADR-006](architecture/adr/006-testing-strategy.md).

## 1. Quy ước và danh mục tạo phẩm

- `TBD`: hạng mục Code/API và Test sẽ được điền liên kết trực tiếp khi triển khai ở Sprint 1–2.
- `N/A — lý do`: không áp dụng trong MVP (`FR-09` là `Won't` theo [SRS](requirements/srs.md)).
- **Use-case:** `UC-01` ([use-case-checkout.md](requirements/use-case-checkout.md)), `UC-02`…`UC-06` ([SRS Mục 5](requirements/srs.md), [use-case-overview.puml](diagrams/use-case-overview.puml)).
- **Sơ đồ & Thiết kế:**
  - `Activity-01`: [activity.puml](diagrams/activity.puml) ([SVG](diagrams/activity.svg))
  - `Sequence-01`: [sequence-checkout.puml](diagrams/sequence-checkout.puml) ([SVG](diagrams/sequence-checkout.svg))
  - `Class-01`: [class-domain.puml](diagrams/class-domain.puml) ([SVG](diagrams/class-domain.svg))
  - `Deployment-01`: [deployment-render.puml](diagrams/deployment-render.puml) ([SVG](diagrams/deployment-render.svg))
  - `Arch`: [architecture.md](architecture/architecture.md)
  - `ADR-001`…`ADR-006`: [001-monorepo.md](architecture/adr/001-monorepo.md), [002-jwt-security.md](architecture/adr/002-jwt-security.md), [003-orm-schema-catalog.md](architecture/adr/003-orm-schema-catalog.md), [004-order-payment-consistency.md](architecture/adr/004-order-payment-consistency.md), [005-Next.js-PWA-stateCart-dataFetching.md](architecture/adr/005-Next.js-PWA-stateCart-dataFetching.md), [006-testing-strategy.md](architecture/adr/006-testing-strategy.md)

## 2. Bảng ma trận truy vết

| Mã yêu cầu | Use-case/User Story | Thiết kế/Sơ đồ | Code/API | Test |
|---|---|---|---|---|
| FR-01 | UC-02 | Activity-01, Class-01 (`Category`, `Product`), Arch Mục 4–5, ADR-003, ADR-005 | TBD | TBD |
| FR-02 | UC-02 | Class-01 (`Category`, `Product`), Arch Mục 4–5, ADR-003 | TBD | TBD |
| FR-03 | UC-02 | Class-01 (`Product`), Arch Mục 4–5, ADR-003 | TBD | TBD |
| FR-04 | UC-02 | Activity-01, Class-01 (`Product`, `Category`), ADR-003, ADR-005 | TBD | TBD |
| FR-05 | UC-02 | Activity-01, Class-01 (`Size`, `Topping`), ADR-003, ADR-005 | TBD | TBD |
| FR-06 | UC-01 | Sequence-01, Class-01 (`Product`, `Size`, `Topping`, `OrderItem`), Arch Mục 4 & 9, ADR-003, ADR-004 | TBD | TBD |
| FR-07 | UC-01 (E2), UC-02 | Activity-01, Sequence-01, Class-01 (`Product.stockQuantity`), ADR-003, ADR-004 | TBD | TBD |
| FR-08 | UC-02 | Class-01, Arch Mục 6, ADR-003 | TBD | TBD |
| FR-09 | N/A — Won't trong MVP | N/A — ngoài MVP (ADR-003) | N/A | N/A |
| FR-10 | UC-03 | Activity-01, Arch Mục 5, ADR-005 | TBD | TBD |
| FR-11 | UC-03 | Activity-01, Arch Mục 5, ADR-005 | TBD | TBD |
| FR-12 | UC-03 | Activity-01, Arch Mục 5, ADR-005 | TBD | TBD |
| FR-13 | UC-03 | Activity-01, Arch Mục 5, ADR-005 | TBD | TBD |
| FR-14 | UC-03, UC-01 (E1) | Activity-01, Sequence-01, ADR-002, ADR-005 | TBD | TBD |
| FR-15 | UC-03, UC-01 (A1) | Class-01 (`Promotion`), ADR-005 | TBD | TBD |
| FR-16 | UC-01…UC-05 (UI mobile-first) | Arch Mục 5, ADR-005 | TBD | TBD |
| FR-17 | Toàn ứng dụng Web/PWA | Deployment-01, Arch Mục 3 & 5, ADR-005 | TBD | TBD |
| FR-18 | UC-01…UC-06 (loading/empty/error) | Arch Mục 5, ADR-005, ADR-006 | TBD | TBD |
| FR-19 | UC-01…UC-05 (điều hướng) | Arch Mục 5, ADR-005 | TBD | TBD |
| FR-20 | UC-04 | Class-01 (`User`, `UserRole`), Arch Mục 4, ADR-002 | TBD | TBD |
| FR-21 | UC-04 | Activity-01, Class-01 (`User`), ADR-002 | TBD | TBD |
| FR-22 | UC-01 (E1), UC-04, UC-05 | Activity-01, Sequence-01, ADR-002, ADR-005 | TBD | TBD |
| FR-23 | UC-01, UC-05 | Sequence-01, Class-01 (`User`–`Order`), ADR-002 | TBD | TBD |
| FR-24 | UC-04, UC-06 | Activity-01, Class-01 (`UserRole.STAFF`), ADR-002 | TBD | TBD |
| FR-25 | UC-01 | Activity-01, Sequence-01, Class-01 (`Order`, `PENDING_PAYMENT`), ADR-004 | TBD | TBD |
| FR-26 | UC-01 | Activity-01, Sequence-01, Class-01 (`OrderItem`, `OrderItemTopping`), ADR-003, ADR-004 | TBD | TBD |
| FR-27 | UC-01 (E2) | Activity-01, Sequence-01, Class-01, ADR-004 | TBD | TBD |
| FR-28 | UC-01 (A2) | Activity-01, Sequence-01, Class-01 (`Payment`, `PaymentMethod`), Arch Mục 7 & 9, ADR-004 | TBD | TBD |
| FR-29 | UC-01 (E4) | Activity-01, Sequence-01, Class-01 (`Payment.idempotencyKey`), ADR-004, ADR-005 | TBD | TBD |
| FR-30 | UC-01 (E3) | Activity-01, Sequence-01, Class-01 (`OrderStatus`, `PaymentStatus`), ADR-004 | TBD | TBD |
| FR-31 | UC-01 (E5) | Activity-01, Sequence-01, Arch Mục 7 & 9, ADR-004 | TBD | TBD |
| FR-32 | UC-01 (hủy đơn quá hạn) | Class-01 (`OrderStatus.CANCELLED`), Arch Mục 4 & 9, ADR-004 | TBD | TBD |
| FR-33 | UC-01 | Activity-01, Sequence-01, ADR-005 | TBD | TBD |
| FR-34 | UC-01 (A1) | Class-01 (`Promotion`, `LoyaltyTransaction`), Arch Mục 4 | TBD | TBD |
| FR-35 | UC-05 | Activity-01, Class-01 (`Order`, `OrderItem`), Arch Mục 4 & 9, ADR-005 | TBD | TBD |
| FR-36 | UC-05 | Activity-01, Class-01 (`Order`, `OrderStatus`), Arch Mục 9, ADR-005 | TBD | TBD |
| FR-37 | UC-06 | Activity-01, Class-01 (`Order`, `UserRole.STAFF`), ADR-002 | TBD | TBD |
| FR-38 | UC-06 | Activity-01, Class-01 (`OrderStatus`), ADR-002 | TBD | TBD |
| FR-39 | UC-06 | Class-01 (`OrderStatus`, `UserRole`), ADR-002, ADR-006 | TBD | TBD |
| NFR-01 | UC-02 (hiệu năng đọc menu) | Arch Mục 4 & 6, ADR-003, ADR-006 | TBD | TBD |
| NFR-02 | UC-01 (hiệu năng tạo đơn) | Sequence-01, ADR-004, ADR-006 | TBD | TBD |
| NFR-03 | UC-05, UC-06 (hiệu năng đơn hàng) | Class-01, Arch Mục 4 & 6, ADR-003, ADR-006 | TBD | TBD |
| NFR-04 | UC-02, UC-03 (hiệu năng UI & giỏ) | Arch Mục 5, ADR-005, ADR-006 | TBD | TBD |
| NFR-05 | UC-05, UC-06 (polling trạng thái ≤7s) | Arch Mục 5 & 9, ADR-005, ADR-006 | TBD | TBD |
| NFR-06 | UC-01, UC-03 (toàn vẹn & đồng thời) | Sequence-01, Class-01, ADR-003, ADR-004, ADR-005 | TBD | TBD |
| NFR-07 | Toàn hệ thống (bảo mật & logging) | Sequence-01, Deployment-01, Arch Mục 4 & 8, ADR-002 | TBD | TBD |
| NFR-08 | UC-01 (phục hồi & đối soát giao dịch) | Activity-01, Sequence-01, Arch Mục 7 & 9, ADR-004 | TBD | TBD |
| NFR-09 | UC-01…UC-06 (phản hồi UI & chống gửi lặp) | Activity-01, Arch Mục 5, ADR-005, ADR-006 | TBD | TBD |
| NFR-10 | UC-01…UC-06 (usability & mobile-first) | Arch Mục 5, ADR-005, ADR-006 | TBD | TBD |
| NFR-11 | Toàn ứng dụng Web/PWA (trình duyệt) | Arch Mục 5, ADR-005, ADR-006 | TBD | TBD |
| NFR-12 | Toàn bộ REST API (Swagger/OpenAPI) | Arch Mục 4, ADR-001 | TBD | TBD |
| NFR-13 | Toàn hệ thống (unit/integration/E2E) | Arch Mục 4 & 10, ADR-006 | TBD | TBD |
| NFR-14 | Quy trình PR (Continuous Integration) | Deployment-01, ADR-001, ADR-006 | TBD | TBD |
| NFR-15 | Môi trường local (Docker Compose & seed) | Deployment-01, Arch Mục 6, ADR-001, ADR-003 | TBD | TBD |
| NFR-16 | Vận hành (`GET /health`) | Deployment-01, Arch Mục 8, ADR-006 | TBD | TBD |
| NFR-17 | Vận hành (cấu hình & secrets) | Deployment-01, Arch Mục 8, ADR-001, ADR-002 | TBD | TBD |
| NFR-18 | Phát hành (CD, migration & rollback) | Deployment-01, Arch Mục 6, 8 & 12, ADR-001, ADR-003 | TBD | TBD |
| NFR-19 | Hạ tầng production Render (HTTPS & DB private) | Deployment-01, Arch Mục 3, 6 & 12, ADR-001, ADR-002 | TBD | TBD |
| NFR-20 | Bàn giao (release, README & rollback) | Arch Mục 6 & 12, ADR-001 | TBD | TBD |
