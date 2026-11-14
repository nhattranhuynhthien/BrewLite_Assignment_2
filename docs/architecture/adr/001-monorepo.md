# ADR-001: Sử dụng monorepo và đóng gói Docker cho web, API và tài liệu

- **Trạng thái:** Bản cập nhật đề xuất (`I-08a / D-14`), chờ TV2 review (14/11/2026) — giữ trạng thái mở thay cho nhãn `Accepted` cũ vì chưa đủ bằng chứng CI/Docker nghiệm thu.
- **Ngày:** 2026-11-08 (cập nhật 2026-11-14)
- **Người quyết định:** Nhóm BrewLite (chủ trì phần đóng gói/monorepo: TV1)

## Bối cảnh
Dự án gồm frontend (Next.js), backend (NestJS), tài liệu đặc tả/sơ đồ, test tích hợp/E2E và pipeline CI/CD. Đề bài Assignment 2 (mục 9) yêu cầu cấu trúc thống nhất `apps/web`, `apps/api`, `docs`, `tests`, `.github/workflows` và truy vết xuyên suốt yêu cầu → thiết kế → code → test.

## Các lựa chọn
1. **Monorepo** (một repository cho toàn bộ web, API, tài liệu và kiểm thử).
2. Polyrepo (tách repo riêng cho frontend, backend, tài liệu).

## Quyết định
Chọn **monorepo** với cấu trúc `apps/web`, `apps/api`, `docs`, `tests`, `.github/workflows`.

Về đóng gói và vận hành (**D-14**, căn cứ `NFR-14`, `NFR-15`, `NFR-17`, `NFR-18`):
- Đóng gói `apps/web` và `apps/api` bằng `Dockerfile` riêng (multi-stage build để giữ image gọn); dùng `docker-compose.yml` ở root để chạy đủ 3 service `web`, `api`, `db` khi phát triển và kiểm thử ở local.
- PostgreSQL local dùng persistent volume; migration chạy có kiểm soát (`prisma migrate deploy` vì nhóm đã chốt Prisma) trước khi phục vụ lưu lượng ở production, seed tài khoản demo chỉ chạy ở local/staging.
- **Cấu hình và bảo mật container:** không nhúng secret vào image hoặc biến `NEXT_PUBLIC_*`. Khi chạy trên nền tảng **Render** (lựa chọn triển khai dự kiến ở D-20), ứng dụng web và API phải lắng nghe `0.0.0.0:$PORT`, còn `NEXT_PUBLIC_API_URL` cần được truyền đúng thời điểm build image web.
- **CI/CD:** GitHub Actions chạy `Install → Lint → Unit Test → Build` cho cả `apps/web` và `apps/api` trên pull request; không cấu hình bộ lọc đường dẫn làm bỏ qua trạng thái kiểm tra bắt buộc khi merge vào `main`.
- **Phạm vi quyết định:** ADR-001 chỉ quyết định cấu trúc monorepo và chiến lược đóng gói Docker. Quyết định ORM (`ADR-003`), xác thực (`ADR-007`), state frontend (`D-18`) và kiểm thử (`D-19`) thuộc owner tương ứng.

**Bằng chứng tại 14/11/2026:** `origin/main@ad3e7a2` mới chỉ có khung thư mục và tài liệu; `origin/tai@15cb1f8` có khung NestJS/Prisma và `docker-compose.yml` mới chạy riêng service `db`; chưa có `apps/web`, chưa có `Dockerfile` web/api và chưa có workflow CI trong `.github/workflows/`. Chỉ được xác nhận hoàn thành sau khi clone mới → Docker Compose 3 service chạy được → migrate/seed DB rỗng thành công → CI xanh trên PR và qua review TV2.

## Hệ quả
- (+) Một pull request có thể đồng bộ yêu cầu, sơ đồ, code và test → dễ truy vết.
- (+) Tập trung một bộ pipeline CI/CD và một lịch sử Git chuẩn theo đề bài.
- (+) Dễ dùng chung contract/DTO giữa frontend và backend.
- (–) Cần quản lý tốt Docker context, khóa lockfile và cache để build trong CI không chậm.
- (–) Chưa thể tạo workflow CI/Dockerfile chính thức trên `main` chừng nào chưa có `apps/web` và chưa hợp nhất khung `apps/api` (Prisma) từ nhánh làm việc vào `main`.
