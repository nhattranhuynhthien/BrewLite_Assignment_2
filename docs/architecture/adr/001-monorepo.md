# ADR-001: Sử dụng monorepo và đóng gói Docker cho web, API và tài liệu

- **Trạng thái:** Accepted
- **Ngày:** 2026-11-08 (cập nhật 2026-11-14)
- **Người quyết định:** Nhóm BrewLite

## Bối cảnh
Dự án gồm frontend (Next.js), backend (NestJS), tài liệu, test tích hợp/E2E và pipeline CI/CD. Đề bài yêu cầu cấu trúc `apps/web`, `apps/api`, `docs`, `tests`, `.github/workflows` và truy vết xuyên suốt từ yêu cầu → thiết kế → code → test, đồng thời chạy được đồng nhất giữa local và môi trường triển khai bằng Docker.

## Các lựa chọn
1. **Monorepo + Docker** (một repository cho web, API, tài liệu và kiểm thử; đóng gói từng dịch vụ bằng `Dockerfile` riêng và chạy local bằng `docker-compose.yml`).
2. Polyrepo (tách repo riêng cho web, API, docs).

## Quyết định
Chọn **monorepo** với cấu trúc `apps/web`, `apps/api`, `docs`, `tests`, `.github/workflows`, kết hợp đóng gói **Docker**:
- `apps/web/Dockerfile` và `apps/api/Dockerfile` sử dụng multi-stage build để giữ image gọn và ổn định cho CI/CD.
- `docker-compose.yml` ở thư mục gốc khởi chạy đủ 3 service `web`, `api` và `db` (PostgreSQL kèm persistent volume) cho môi trường local/test.
- Image production của web nhúng `NEXT_PUBLIC_API_URL` lúc build; cả web và API lắng nghe `0.0.0.0:$PORT` trên Render và không đưa secret vào image hoặc biến `NEXT_PUBLIC_*`.
- Migration cơ sở dữ liệu chạy bằng `prisma migrate deploy` (Prisma) như bước kiểm soát trước khi chuyển lưu lượng; `prisma generate` chạy trong quá trình build API.
- GitHub Actions thực thi quality gate trên một lịch sử commit thống nhất trong monorepo.

## Hệ quả
- (+) Một pull request có thể sửa đồng thời yêu cầu, sơ đồ, code và test → dễ truy vết.
- (+) Môi trường local, CI và production dùng chung cấu hình đóng gói Docker, hạn chế sai khác giữa máy thành viên.
- (+) Dễ chia sẻ kiểu dữ liệu/hợp đồng API giữa frontend và backend.
- (–) Cần quản lý Docker context, cache lớp image và lọc job hợp lý để pipeline không build chậm.
- (–) Repo lớn dần theo thời gian (không đáng kể ở quy mô đề tài).
