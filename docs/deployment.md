# Hướng dẫn Triển khai & Vận hành Production (BrewLite)

Tài liệu này mô tả kiến trúc triển khai production trên Render + PostgreSQL + GHCR (phù hợp `docs/diagrams/deployment-render.puml` và `docs/architecture/architecture.md`), danh sách biến môi trường/secrets, quy trình migrate/seed an toàn và kịch bản rollback.

---

## 1. Kiến trúc Production Mục tiêu

- **Container Registry:** GitHub Container Registry (`ghcr.io/<owner>/brewlite-api`, `ghcr.io/<owner>/brewlite-web`), tag theo Git Commit SHA (`sha-<short_sha>`). Không dùng tag mutable `:latest` làm nguồn deploy.
- **Database Service:** Render Managed PostgreSQL (`brewlite-db`), chỉ kết nối từ `brewlite-api` thông qua Internal/Private Database URL (`DATABASE_URL`). Không mở cổng DB ra public internet.
- **Backend Service (`brewlite-api`):** NestJS Docker service lắng nghe `PORT` do Render cấp, phục vụ `/health` (kiểm tra kết nối DB), `/health/live`, `/docs` (Swagger UI), và toàn bộ API nghiệp vụ.
- **Frontend Service (`brewlite-web`):** Next.js standalone Docker service, gọi trực tiếp `NEXT_PUBLIC_API_URL` HTTPS của `brewlite-api`.

---

## 2. Biến Môi trường & Secrets Bắt buộc

> [!CAUTION]
> Tuyệt đối không commit giá trị thật của `DATABASE_URL`, `JWT_SECRET`, `PAYMENT_WEBHOOK_SECRET`, `GHCR_TOKEN` hoặc Render Deploy Hook / API Key vào Git.

### 2.1. Backend (`brewlite-api` trên Render Environment & Secrets)

| Biến | Môi trường | Giá trị mẫu / Quy tắc | Ghi chú |
|---|---|---|---|
| `NODE_ENV` | Production | `production` | Bật fail-fast kiểm tra secret yếu |
| `DATABASE_URL` | Production | `postgresql://...` (Internal Render URL) | Bắt buộc SSL nếu kết nối ngoài |
| `JWT_SECRET` | Production | Chuỗi ngẫu nhiên >= 32 ký tự (`openssl rand -hex 32`) | Cấm dùng placeholder trong `.env.example` |
| `JWT_EXPIRES_IN` | Production | `30m` (khuyến nghị 15m–60m theo ADR-002) | Local dùng `1d` |
| `CORS_ORIGIN` | Production | `https://<ten-mien-web>.onrender.com` | Origin HTTPS chính xác của Frontend |
| `PAYMENT_PROVIDER` | Production | `mock` | MVP dùng Mock Payment Gateway |
| `PAYMENT_WEBHOOK_SECRET` | Production | Chuỗi ngẫu nhiên >= 16 ký tự | Bắt buộc khi `NODE_ENV=production` |
| `PAYMENT_TIMEOUT_MS` | Production | `5000` | Timeout cổng thanh toán mô phỏng |
| `SEED_DEMO_USERS` | Production | `false` | **Chỉ** seed danh mục sản phẩm trên prod; không bật user mẫu trừ khi demo có kiểm soát |

### 2.2. Frontend (`brewlite-web` build args & runtime)

| Biến | Giá trị mẫu | Ghi chú |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://<ten-mien-api>.onrender.com` | Truyền lúc build image và runtime; không chứa secret |
| `NEXT_PUBLIC_API_MOCK` | `false` | Đảm bảo UI gọi API thật trên production |
| `PORT` / `HOSTNAME` | `3000` / `0.0.0.0` | Chuẩn Next.js standalone |

### 2.3. GitHub Actions Secrets (cho CI/CD)

| Secret Name | Chủ sở hữu cấu hình | Mục đích |
|---|---|---|
| `GITHUB_TOKEN` *(tự động bởi Actions)* | GitHub Actions | Đăng nhập và push image lên GHCR (`packages: write`) |
| `RENDER_API_DEPLOY_HOOK_URL` | TV1 | URL webhook kích hoạt deploy service `brewlite-api` trên Render |
| `RENDER_WEB_DEPLOY_HOOK_URL` | TV1 | URL webhook kích hoạt deploy service `brewlite-web` trên Render |
| `PRODUCTION_API_URL` | TV1 / TV2 | HTTPS URL của `brewlite-api` để chạy `smoke-test.mjs` sau deploy |
| `PRODUCTION_WEB_URL` | TV1 / TV2 | HTTPS URL của `brewlite-web` để kiểm tra HTTP 200 sau deploy |

---

## 3. Quy trình Deploy & Safe Migration

1. **Quality Gate:** Push lên `main` phải qua `.github/workflows/ci.yml` (`lint`, `typecheck`, unit test, integration test trên PostgreSQL thật, `build`, `docker compose config`).
2. **Build & Push Image (GHCR):** CD workflow build hai Docker image tag immutable `ghcr.io/<owner>/brewlite-api:sha-<short_sha>` và `brewlite-web:sha-<short_sha>` (12 ký tự đầu của `GITHUB_SHA`).
3. **Database Migration An toàn:** Chạy `npx prisma migrate deploy` với `DATABASE_URL` production trước khi nhận traffic mới. Không bao giờ chạy `prisma migrate dev` hoặc `prisma db push` trên production.
4. **Seed Catalog:** Trên lần khởi tạo đầu tiên (hoặc môi trường staging), chạy `npm run prisma:seed` (đã viết idempotent với `upsert`, giữ `SEED_DEMO_USERS=false` trên production thực tế trừ khi tạo tài khoản demo phục vụ nghiệm thu có mật khẩu riêng).
5. **Post-Deploy Smoke Test:** Chạy:
   ```bash
   SMOKE_API_URL=https://<api-url> SMOKE_WEB_URL=https://<web-url> node scripts/smoke-test.mjs
   ```
   Kiểm tra `/health/live` = 200, `/health` (`database: "up"`) = 200, `/products` = 200 (`items` hợp lệ), và trang chủ Web trả về HTTP 200.

---

## 4. Quy trình Rollback Khẩn cấp

Khi release mới lỗi CI/CD, `/health` trả `503`, hoặc smoke test thất bại:

1. **Ngừng đẩy traffic:** Không merge PR mới lên `main`.
2. **Rollback Application Image trên Render:**
   - Trong Render Dashboard -> service `brewlite-api` / `brewlite-web` -> tab **Events / Deploys** -> chọn bản deploy ổn định trước đó (tag SHA trước) -> nhấn **Rollback to this deploy** (hoặc deploy lại đúng tag `ghcr.io/<owner>/brewlite-*:<previous_good_sha>`).
3. **Xử lý Schema / Database:**
   - BrewLite ưu tiên migration tiến (backward-compatible additive migrations). Không chạy câu lệnh phá hủy (`DROP TABLE`, `TRUNCATE`) trên dữ liệu thật.
   - Nếu migration vừa chạy gây lỗi logic ứng dụng: sau khi rollback code về bản cũ, kiểm tra log `npx prisma migrate status`; nếu cần sửa dữ liệu, khôi phục từ Render Automated Snapshot/Backup trước thời điểm deploy.
4. **Xác nhận sau Rollback:** Chạy lại `node scripts/smoke-test.mjs` và ghi nhận sự cố vào `docs/sprint-2-review.md` hoặc `RELEASE_NOTES.md`.
