# Kiểm thử API BrewLite bằng Postman

Collection có 47 request gồm các ca kiểm thử 9 endpoint nghiệp vụ, Swagger JSON và bước tạo đơn mẫu cho mỗi lượt chạy. Các biến mặc định nằm trong tab **Variables** của collection.

## Import collection

- **VS Code:** Mở Command Palette bằng `Ctrl+Shift+P`, chạy **Postman: Import**, chọn **File** và mở [BrewLite.postman_collection.json](BrewLite.postman_collection.json). Collection xuất hiện với tên **BrewLite API Tests**.
- **Postman Web hoặc Desktop:** Mở workspace, chọn **Import** rồi mở cùng file JSON. Nếu VS Code báo **Could not import collection**, có thể import bằng Postman Web vào cùng workspace và mở lại workspace đó trong extension. [Tài liệu import của Postman](https://learning.postman.com/docs/getting-started/importing-and-exporting/importing-data/)

Có thể import trước khi khởi động API và seed dữ liệu. Để chạy test từ terminal, xem lệnh Newman bên dưới.

Nếu dùng Postman, chạy **BrewLite API Tests** từ `postman/collections/` trong workspace local. Nếu dùng bản đã import vào workspace khác, import lại file JSON đã cập nhật để có request đầu nhóm đơn hàng **Tạo đơn mẫu cho lượt chạy (201)**.

Import thêm [BrewLite.local.postman_environment.json](BrewLite.local.postman_environment.json) bằng cùng thao tác, rồi chọn **BrewLite Local** trong danh sách environment. File chứa URL API local, thông tin tài khoản mẫu và biến kiểm tra readiness. Collection tự điền JWT, email đăng ký và các ID lấy từ API.

## Chuẩn bị API và dữ liệu mẫu

Chạy các lệnh sau từ thư mục gốc nếu dùng Docker Compose. Project `brewlite-postman` dùng API ở cổng `4001` và PostgreSQL ở cổng `55432` để chạy song song với các dịch vụ local khác.

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
$env:API_PORT = '4001'
$env:POSTGRES_PORT = '55432'
$env:NODE_ENV = 'test'
$env:POSTMAN_FIXTURES_ENABLED = 'true'
docker compose -p brewlite-postman up -d --build --wait db api
docker compose -p brewlite-postman ps
```

```powershell
docker compose -p brewlite-postman exec -T -e SEED_DEMO_USERS=true api node prisma/seed.cjs
docker compose -p brewlite-postman exec -T api node prisma/seed-postman.cjs
```

Nếu chạy trực tiếp, khởi động PostgreSQL rồi trỏ `DATABASE_URL` trong `.env` ở thư mục gốc tới database kiểm thử. Chạy với Node.js 22 trở lên.

```powershell
Push-Location apps/api
npm.cmd ci
node --env-file=../../.env --run prisma:generate
node --env-file=../../.env --run prisma:migrate:deploy
$env:SEED_DEMO_USERS = 'true'
node --env-file=../../.env prisma/seed.cjs
node --env-file=../../.env prisma/seed-postman.cjs
Pop-Location
$env:PORT = '4001'
$env:NODE_ENV = 'test'
$env:POSTMAN_FIXTURES_ENABLED = 'true'
npm.cmd --prefix apps/api run start:dev
```

Seed danh mục, tài khoản mẫu và sản phẩm đã ẩn một lần khi chuẩn bị database. Mỗi lượt collection tự tạo một tài khoản `CUSTOMER` và hai đơn mẫu với ID mới. Có thể bấm **Run Again** ngay sau khi lượt trước hoàn tất. API tạo đơn mẫu chỉ được bật khi `POSTMAN_FIXTURES_ENABLED=true` trong môi trường `test` hoặc `development`, và yêu cầu JWT của `STAFF`. Dùng database kiểm thử dành riêng cho collection.

## Chạy collection

1. Chọn **BrewLite Local** và đặt `baseUrl` thành `http://127.0.0.1:4001` nếu đã import file environment cũ. Nếu tài khoản STAFF mẫu dùng thông tin khác, chỉnh `staffEmail` và `staffPassword` trong environment.
2. Chọn **Run collection** và chạy tất cả thư mục theo thứ tự. Request đăng ký tự tạo email. Hai request đăng nhập tự lưu JWT và nhóm đơn hàng tự chuẩn bị đơn mẫu mỗi lượt.

Nếu `/health/live` trả `404` hoặc phản hồi thiếu `service: "brewlite-api"`, kiểm tra lại `baseUrl` và bản API đang chạy. Collection dừng tại liveness khi gặp trường hợp này.

Nếu gửi từng request, chạy đăng ký trước đăng nhập CUSTOMER và đăng nhập STAFF trước request **Tạo đơn mẫu cho lượt chạy (201)**. Chạy request tạo đơn trước các ca cập nhật đơn. Chạy danh sách danh mục trước các ca lọc theo danh mục và chạy trang mặc định trước ca trang 2.

Có thể chạy từ thư mục gốc bằng Newman trên PowerShell. [Tài liệu Newman](https://learning.postman.com/docs/collections/using-newman-cli/installing-running-newman)

```powershell
npx.cmd --yes newman@6 run docs/postman/BrewLite.postman_collection.json -e docs/postman/BrewLite.local.postman_environment.json
```

Để ghi đè URL qua Newman, thêm `--env-var "baseUrl=http://127.0.0.1:4001"` với địa chỉ API cần kiểm thử.

## Các nhóm kiểm thử

| Nhóm | Nội dung |
| --- | --- |
| Health và Swagger | Liveness, kết nối PostgreSQL, cấu trúc tài liệu OpenAPI. |
| Xác thực | Đăng ký, email trùng, chuẩn hóa dữ liệu, kiểm tra đầu vào, đăng nhập CUSTOMER và STAFF, thông tin đăng nhập sai. |
| Danh mục sản phẩm | Thứ tự danh mục, phân trang, lọc, tìm tiếng Việt không dấu, chi tiết kèm size và topping, ID sai, sản phẩm đã ẩn hoặc không tồn tại. |
| Đơn hàng nhân viên | JWT và phân quyền, hàng đợi đơn đang xử lý, luồng `PAID → PREPARING → READY → COMPLETED`, đơn chưa thanh toán, chuyển sai bước, `expectedStatus` cũ và `404`. |

Để kiểm tra readiness `503`, giữ API đang chạy và tạm dừng PostgreSQL của môi trường kiểm thử. Đặt `expectDatabaseDown=true` rồi gửi riêng request **Readiness**. Khởi động lại PostgreSQL và đặt biến về `false` trước khi chạy toàn bộ collection.

Các route đặt đơn, tra cứu đơn và thanh toán trong `docs/api-contract.yaml` chưa có controller tương ứng trong source hiện tại. Các module khuyến mãi và tích điểm cũng chưa có API để gửi request từ Postman.
