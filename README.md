# BrewLite — Hệ thống Đặt Đồ Uống Online (MVP)

Ứng dụng đặt đồ uống nhanh gọn gồm Customer PWA mobile-first (Next.js App Router) và REST API (NestJS + Prisma + PostgreSQL).

---

## 1. Kiến trúc & Ngăn xếp Công nghệ

| Thành phần | Công nghệ | Đường dẫn |
|---|---|---|
| Frontend Web / PWA | Next.js 15, React 19, TypeScript, Vitest | `apps/web/` |
| Backend REST API | NestJS 11, Prisma 6, Swagger `/docs`, Jest | `apps/api/` |
| Database | PostgreSQL 16 (migration chuẩn hóa + `CHECK`/partial index) | `apps/api/prisma/` |
| Kiểm thử E2E | Playwright Test (`tests/e2e/`) | `tests/e2e/` |
| CI/CD & Container | Docker, Docker Compose, GitHub Actions (`ci.yml`, `cd.yml`) | `.github/workflows/` |

> **Phạm vi triển khai:** Bao gồm toàn bộ luồng khách hàng trên web/PWA (`Thực đơn -> Chi tiết món -> Giỏ hàng -> Đăng nhập -> Thanh toán mô phỏng (mã khuyến mãi & đổi điểm tích lũy) -> Theo dõi đơn`) và bảng điều phối quầy cho nhân viên (`/staff`, cập nhật `PAID -> PREPARING -> READY -> COMPLETED` hoặc thao tác qua `PATCH /orders/:id/status` trên Swagger UI `/docs`).

---

## 2. Chạy Hệ thống Cục bộ (Docker Compose)

1. Tạo file `.env` từ mẫu:
   ```bash
   cp .env.example .env
   ```
2. Khởi động PostgreSQL, API (tự chạy `prisma migrate deploy`) và Web:
   ```bash
   docker compose up -d --build
   ```
3. Nạp dữ liệu danh mục và tài khoản demo (local/staging):
   ```bash
   docker compose exec api npm run prisma:seed
   ```
4. Truy cập:
   - Web PWA: `http://localhost:3000`
   - API Swagger: `http://localhost:4000/docs`
   - Health check: `http://localhost:4000/health`

### Tài khoản demo (khi `SEED_DEMO_USERS=true`)
- **Khách hàng:** `customer@brewlite.local` / `BrewLite123!`
- **Nhân viên quầy (`STAFF`):** `staff@brewlite.local` / `BrewLiteStaff123!`

---

## 3. Chạy Kiểm thử (Lint, Unit, Integration, E2E)

### Backend (`apps/api`)
```bash
npm --prefix apps/api run lint
npm --prefix apps/api run typecheck
npm --prefix apps/api test
# Chạy integration test trên PostgreSQL thật (yêu cầu TEST_DATABASE_URL chứa "test")
TEST_DATABASE_URL=postgresql://brewlite:brewlite_local_dev_pw@localhost:5432/brewlite_test?schema=public \
  npm --prefix apps/api run test:integration
npm --prefix apps/api run build
```

### Frontend (`apps/web`)
```bash
npm --prefix apps/web run lint
npm --prefix apps/web run typecheck
npm --prefix apps/web test
npm --prefix apps/web run build
```

### Smoke Test & End-to-End (`tests/e2e`)
```bash
node scripts/smoke-test.mjs
E2E_WEB_URL=http://localhost:3000 E2E_API_URL=http://localhost:4000 \
  npm --prefix tests/e2e test
```

---

## 4. Triển khai Production (Render) & Tài liệu Liên quan

- **Web PWA Production:** https://brewlite-web-587y.onrender.com
- **API & Swagger UI:** https://brewlite-api-nz0h.onrender.com/docs
- **API Health Check:** https://brewlite-api-nz0h.onrender.com/health
- **Video Demo End-to-End (`I-41`):** https://drive.google.com/file/d/1dS5-W5MC-p_4SJpQD6M1TPccmSW7MuUD/view?usp=sharing
- **GitHub Project Board (`I-48`):** https://github.com/users/nhattranhuynhthien/projects/3
- **API Contract:** [docs/api-contract.yaml](docs/api-contract.yaml)
- **Hướng dẫn Production & Rollback:** [docs/deployment.md](docs/deployment.md)
- **SRS & Kiến trúc / ADR:** [docs/requirements/srs.md](docs/requirements/srs.md), [docs/architecture/architecture.md](docs/architecture/architecture.md)
- **Ma trận truy vết:** [docs/traceability-matrix.md](docs/traceability-matrix.md)
