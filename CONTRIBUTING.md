# Quy ước làm việc nhóm

## Chiến lược branch

- `main` luôn ở trạng thái có thể deploy; không push trực tiếp vào `main`.
- Nhánh tính năng dùng định dạng `feature/<issue-id>-<mô-tả-ngắn>`.
- Nhánh tài liệu dùng định dạng `docs/<issue-id>-<mô-tả-ngắn>`.
- Thay đổi được đưa vào `main` thông qua pull request; pull request cần CI xanh và ít nhất một người review.

## Vòng review chéo

Mỗi pull request cần được thành viên được phân công review:

| Tác giả PR | Người review |
|---|---|
| TV1 | TV2 |
| TV2 | TV3 |
| TV3 | TV4 |
| TV4 | TV1 |
| TV5 | TV6 |
| TV6 | TV5 |

Với mảng backend/DevOps, vòng review luân phiên TV1 → TV2 → TV3 → TV4 → TV1. TV5 và TV6 review chéo nhau cho mảng frontend.

## Quy ước commit (Conventional Commits)

Commit theo Conventional Commits với các tiền tố: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `ci:`.

## Pull request và issue

- Mỗi pull request liên kết với một issue. Dùng `Closes #<id>` để đóng issue khi PR hoàn tất.
- Nếu pull request thay đổi yêu cầu, sơ đồ hoặc kiến trúc, cần ghi rõ lý do.
- Một issue có thể cần nhiều pull request: PR trung gian ghi `Refs #<id>`; PR cuối cùng ghi `Closes #<id>`.

## Definition of Done

Một issue được xem là hoàn thành khi:

- Code hoặc tài liệu đã được merge vào nhánh chính thông qua pull request và có ít nhất một review.
- CI xanh: lint, unit test và build đều đạt.
- Có kiểm thử cho nghiệp vụ mới: unit test hoặc integration/E2E test theo yêu cầu của issue.
- Đáp ứng tiêu chí hoàn thành ghi trong issue.
- Không có secret trong code, log hoặc commit.
- Sơ đồ và tài liệu liên quan được cập nhật nếu hành vi thay đổi; dòng tương ứng trong traceability matrix được điền.
- Có thể chạy hệ thống bằng `docker-compose` hoặc làm theo hướng dẫn trong README.

