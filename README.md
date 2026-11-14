# BrewLite

BrewLite là ứng dụng đặt đồ uống theo hướng mobile-first, dành cho khách hàng của một cửa hàng cà phê, trà và trà sữa. Ứng dụng hướng đến việc giúp khách xem menu, chọn size và topping, đặt và thanh toán đơn, rồi theo dõi trạng thái mà không phải xếp hàng tại quầy.

## Phạm vi MVP

- Xem menu, chi tiết sản phẩm, size, topping và tình trạng còn hàng.
- Chọn món và tùy chỉnh giỏ hàng.
- Đăng ký, đăng nhập và phân quyền khách hàng/nhân viên.
- Đặt đơn, kiểm tra tồn kho và tính giá ở phía máy chủ.
- Thanh toán mô phỏng và theo dõi trạng thái, lịch sử đơn hàng.
- Hỗ trợ nhân viên cập nhật trạng thái đơn; giao diện nhân viên có thể được bổ sung sau MVP.

Cổng thanh toán thật, chương trình khuyến mãi và tích điểm không thuộc phạm vi MVP. Chi tiết phạm vi và yêu cầu được ghi trong [tài liệu bối cảnh và phạm vi](docs/requirements/context-and-scope.md) và [SRS Menu và sản phẩm](docs/requirements/srs-menu-product.md).

## Công nghệ

- Web: Next.js
- API: NestJS
- Cơ sở dữ liệu: PostgreSQL
- Đóng gói môi trường: Docker
- CI/CD: sẽ được xác định và bổ sung trong quá trình triển khai

Đây là nền tảng theo tài liệu yêu cầu hiện có. Quyết định về ORM, schema và migration được ghi tại [ADR-003](docs/architecture/adr/003-orm-schema-catalog.md); việc triển khai ứng dụng vẫn chưa hoàn tất.

## Bắt đầu

### Chạy nhanh bằng Docker Compose

Cách chạy dự kiến của đồ án là Docker Compose, khởi động web, API và PostgreSQL cùng nhau. Khi checkout có `docker-compose.yml` và Dockerfile cho các ứng dụng, mở Docker Desktop ở chế độ Linux containers rồi chạy từ thư mục gốc repo trong PowerShell:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
docker compose config --quiet
docker compose up -d --build
```

Sau khi dịch vụ được cấu hình, xem trạng thái và log bằng:

```powershell
docker compose ps
docker compose logs --tail 50
```

Địa chỉ web, API, Swagger và lệnh kiểm tra health sẽ được ghi ở đây khi port và endpoint đã được triển khai.

Để dừng dịch vụ, dùng `docker compose stop`; chạy lại bằng `docker compose up -d`. `docker compose down` gỡ container và network nhưng thường giữ dữ liệu trong named volume của database. Không dùng `docker compose down -v` nếu muốn giữ dữ liệu.

> **Trạng thái hiện tại:** các lệnh trên mô tả cách chạy mục tiêu theo tài liệu Assignment 2, chưa chạy được trên checkout hiện tại. Repo chưa có `docker-compose.yml`, Dockerfile, mã nguồn trong `apps/web`/`apps/api`, `package.json` hoặc cấu hình migration. Cần bổ sung các thành phần này trước khi chạy.

### Chuẩn bị repository

Clone repository và tạo file cấu hình local từ mẫu nếu cần:

```powershell
git clone https://github.com/nhattranhuynhthien/BrewLite_Assignment_2.git
cd BrewLite_Assignment_2
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

## Cấu hình môi trường

File [.env.example](.env.example) liệt kê các biến dự kiến cho môi trường phát triển:

- Cấu hình chung: `NODE_ENV`.
- PostgreSQL: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, `POSTGRES_HOST`.
- Kết nối database: `DATABASE_URL`, `TEST_DATABASE_URL`.
- API: `API_PORT`, `CORS_ORIGIN`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PAYMENT_WEBHOOK_SECRET`.
- Web: `PORT`, `NEXT_PUBLIC_API_URL`.

Các giá trị trong `.env.example` chỉ là giá trị mẫu cho local. Không dùng chúng cho production, không ghi secret thật vào code, log hoặc commit, và không commit file `.env`.

## Migration và dữ liệu mẫu

Quy trình migration và seed chưa được triển khai. Theo [ADR-003: ORM, schema và migration](docs/architecture/adr/003-orm-schema-catalog.md), schema được quản lý bằng Prisma Migrate; không dùng `db push` làm nguồn schema chung. Migration và seed cần được cập nhật cùng hướng dẫn lệnh sau khi backend được thiết lập.

## Chạy ứng dụng khi phát triển

Khi cần chạy web và API riêng để phát triển, dự kiến dùng Node.js/npm trong từng thư mục ứng dụng và giữ PostgreSQL chạy bằng Docker Compose. Hiện chưa thể cung cấp lệnh `npm` cụ thể vì hai thư mục ứng dụng chưa có mã nguồn hoặc `package.json`. Phiên bản Node.js và các lệnh cài dependencies, migration, seed sẽ được bổ sung sau khi cấu hình dự án được chốt.

## Lệnh kiểm thử và build

Các script lint, test và build chưa được cấu hình trong repo. Khi có cấu hình, phần này sẽ ghi các lệnh kiểm thử unit/integration/E2E và build tương ứng cho `apps/api` và `apps/web`. Theo Definition of Done, CI cần xanh với lint, unit test và build; nghiệp vụ mới cần có test phù hợp với issue.

## Checklist nghiệm thu MVP

- Menu hiển thị sản phẩm, chi tiết, size, topping và tình trạng còn hàng.
- Khách hàng đăng ký, đăng nhập, chọn món, tùy chỉnh giỏ hàng và đặt đơn.
- Giá được tính phía máy chủ; tồn kho được kiểm tra khi tạo đơn.
- Thanh toán mô phỏng, xác nhận đơn, lịch sử và theo dõi trạng thái đơn hoạt động.
- Nhân viên có thể cập nhật trạng thái đơn qua API; giao diện nhân viên có thể được bổ sung sau MVP.

Đây là checklist theo phạm vi yêu cầu, chưa phải kết quả kiểm thử của một ứng dụng đã triển khai.

## Cấu trúc chính

```text
apps/
  api/          # Backend API (chưa triển khai)
  web/          # Web app (chưa triển khai)
docs/
  architecture/ # Quyết định kiến trúc
  diagrams/     # Sơ đồ hệ thống
  requirements/ # Bối cảnh và yêu cầu
tests/          # Kiểm thử (chưa triển khai)
.env.example    # Mẫu biến môi trường cho phát triển local
CONTRIBUTING.md # Quy ước branch, commit, pull request và Definition of Done
```

## Tài liệu

- [Bối cảnh, stakeholder và phạm vi](docs/requirements/context-and-scope.md)
- [SRS tổng quát – mã FR/NFR chuẩn](docs/requirements/srs.md)
- [Use-case tổng quát (PlantUML)](docs/diagrams/use-case-overview.puml) · [SVG](docs/diagrams/use-case-overview.svg)
- [SRS: Menu và sản phẩm](docs/requirements/srs-menu-product.md)
- [ADR 003: ORM, schema và migration](docs/architecture/adr/003-orm-schema-catalog.md)
- [Sơ đồ domain (PUML)](docs/diagrams/class-domain.puml) · [SVG](docs/diagrams/class-domain.svg) · [PNG](docs/diagrams/class-domain.png)
- [Quy ước đóng góp và Definition of Done](CONTRIBUTING.md)

## Đóng góp

Làm việc trên nhánh `feature/<issue-id>-<mô-tả-ngắn>` hoặc `docs/<issue-id>-<mô-tả-ngắn>`. Không push trực tiếp vào `main`; mọi thay đổi cần qua pull request có CI xanh và ít nhất một người review. Chi tiết quy ước commit, review, liên kết issue và Definition of Done nằm trong [CONTRIBUTING.md](CONTRIBUTING.md).

## Triển khai và phát hành

Quy trình deploy production, rollback, release notes và version tag chưa được thiết lập trong repo. Theo yêu cầu Assignment 2, README sẽ được hoàn thiện để hướng dẫn chạy local, test, build, deploy và rollback khi các quy trình tương ứng đã được triển khai; không dùng các lệnh local thay thế cho hướng dẫn production.
