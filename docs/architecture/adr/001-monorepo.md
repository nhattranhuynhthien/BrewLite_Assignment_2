# ADR-001: Sử dụng monorepo cho web, API và tài liệu

- **Trạng thái:** Accepted
- **Ngày:** 2026-11-08
- **Người quyết định:** Nhóm BrewLite

## Bối cảnh
Dự án gồm frontend (Next.js), backend (NestJS), tài liệu, test tích hợp và pipeline CI/CD. Đề bài yêu cầu cấu trúc `apps/web`, `apps/api`, `docs`, và truy vết yêu cầu → thiết kế → code → test.

## Các lựa chọn
1. **Monorepo** (một repository, nhiều thư mục).
2. Polyrepo (repo riêng cho web, api, docs).

## Quyết định
Chọn **monorepo** với cấu trúc `apps/web`, `apps/api`, `docs`, `tests`, `.github/workflows`.

## Hệ quả
- (+) Một pull request có thể sửa đồng thời yêu cầu, sơ đồ, code và test → dễ truy vết.
- (+) Một bộ CI/CD, một lịch sử commit, dễ chấm bài.
- (+) Dễ chia sẻ kiểu dữ liệu/hợp đồng API.
- (–) Pipeline cần lọc theo đường dẫn để tránh build không cần thiết.
- (–) Repo lớn dần theo thời gian (không đáng kể ở quy mô đề tài).
