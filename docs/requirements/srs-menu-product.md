# SRS rút gọn – Nhóm Menu và Chi tiết sản phẩm

| Mục | Nội dung |
|---|---|
| Task | 1.2 – Yêu cầu chức năng và phi chức năng (issue I-03 / D-02) |
| Phiên bản | 0.1 (bản nháp) |
| Tác giả | Đỗ Hoàng Vinh (TV3) |
| Phạm vi | Menu, chi tiết sản phẩm, size/topping, tính giá, tồn kho, dữ liệu mẫu |
| Hợp nhất | Chi tiết yêu cầu thành phần; mã chính thức theo [SRS tổng quát](./srs.md) |

> Các mã FR/NFR trong tài liệu này dùng theo bộ mã chuẩn tại [SRS tổng quát](./srs.md). Đây là phần tiêu chí chi tiết cho menu/sản phẩm; SRS tổng quát là nguồn chuẩn khi tra mã và phạm vi.

## 1. Yêu cầu chức năng

| Mã | Yêu cầu | MoSCoW | API / Thành phần | Nguồn (stakeholder) |
|---|---|---|---|---|
| FR-01 | Hệ thống hiển thị danh sách menu gồm các sản phẩm đang bán, có phân trang, kèm tên, ảnh, giá cơ bản, danh mục và trạng thái còn/hết hàng. | Must | `GET /products` | S1, S2 |
| FR-02 | Hệ thống cho phép lọc menu theo danh mục. | Should | `GET /products?categoryId=` | S1 |
| FR-03 | Hệ thống cho phép tìm sản phẩm theo tên (không phân biệt hoa thường, có dấu hoặc không dấu). | Could | `GET /products?q=` | S1 |
| FR-04 | Hệ thống hiển thị chi tiết một sản phẩm: mô tả, ảnh, giá cơ bản, tồn kho, danh mục. | Must | `GET /products/:id` | S1 |
| FR-05 | Hệ thống hiển thị các size và topping khả dụng của sản phẩm cùng giá phụ thu của từng lựa chọn. | Must | `GET /products/:id` (size, topping) | S1, S3 |
| FR-06 | Hệ thống tính giá phía server theo công thức `(giá cơ bản + phụ thu size + tổng phụ thu topping) × số lượng`; giá do client gửi lên bị bỏ qua. | Must | `PricingService` (dùng trong `POST /orders`) | S1, S3 |
| FR-07 | Hệ thống kiểm tra tồn kho và đánh dấu sản phẩm hết hàng; không cho đặt số lượng vượt tồn kho. | Must | `ProductsService.checkStock/decreaseStock` | S1, S2, S3 |
| FR-08 | Hệ thống có dữ liệu menu mẫu (danh mục, sản phẩm, size, topping) nạp bằng migration/seed; chạy lặp lại không tạo dữ liệu trùng. | Must | Script `db:seed` | S4, S5 |
| FR-09 | Staff/quản lý thêm, sửa, xóa sản phẩm qua giao diện hoặc API quản trị. | Won't | – | S3 |

## 2. Yêu cầu phi chức năng

| Mã | Nhóm | Yêu cầu | MoSCoW |
|---|---|---|---|
| NFR-01 | Hiệu năng | `GET /products` có p95 ≤ 300 ms với bộ dữ liệu seed không quá 200 sản phẩm, đo trên môi trường local bằng công cụ tải (ví dụ autocannon). | Should |
| NFR-02 | Toàn vẹn dữ liệu | Giá lưu số nguyên VND; tồn kho không bao giờ âm (ràng buộc CHECK ở database); tên sản phẩm/topping không rỗng. | Must |
| NFR-06 | Khả năng tích hợp | Hợp đồng request/response của `/products` được công bố bằng Swagger/OpenAPI và luôn khớp với code. | Must |
| NFR-07 | Khả năng kiểm thử | `ProductsService` và `PricingService` có unit test chạy trong CI; các nhánh giá và tồn kho đều có test. | Must |

## 3. Tiêu chí chấp nhận

Dùng dạng Given/When/Then để có thể viết test trực tiếp.

### FR-01 – Xem danh sách menu
- **AC-01.1** Given database có 12 sản phẩm đang bán, When gọi `GET /products`, Then trả HTTP 200 và mảng sản phẩm; mỗi phần tử có `id`, `name`, `basePrice`, `imageUrl`, `category`, `isAvailable`.
- **AC-01.2** Given có hơn 20 sản phẩm, When gọi `GET /products` không tham số, Then trả tối đa 20 sản phẩm (mặc định) kèm `page`, `limit`, `total`.
- **AC-01.3** When gọi `GET /products?limit=1000`, Then `limit` bị giới hạn ở mức tối đa 50 hoặc trả HTTP 400 (nhóm chọn một cách và ghi trong Swagger).
- **AC-01.4** Given không có sản phẩm nào, When gọi `GET /products`, Then trả HTTP 200 với mảng rỗng và `total = 0` (để UI hiển thị trạng thái *empty*).
- **AC-01.5** Sản phẩm có `isAvailable = false` không xuất hiện trong menu, hoặc xuất hiện với nhãn hết hàng (theo quyết định ghi trong Swagger).

### FR-02 – Lọc theo danh mục
- **AC-02.1** Given danh mục "Trà sữa" có 5 sản phẩm, When gọi `GET /products?categoryId=<id>`, Then chỉ trả 5 sản phẩm thuộc danh mục đó.
- **AC-02.2** When `categoryId` không tồn tại, Then trả HTTP 200 với mảng rỗng.

### FR-03 – Tìm theo tên
- **AC-03.1** Given có sản phẩm "Trà sữa trân châu", When gọi `GET /products?q=tra sua`, Then sản phẩm đó nằm trong kết quả.
- **AC-03.2** When `q` rỗng, Then hành vi giống không có tham số `q`.

### FR-04 – Chi tiết sản phẩm
- **AC-04.1** Given sản phẩm tồn tại, When gọi `GET /products/:id`, Then trả HTTP 200 với đầy đủ thông tin mô tả ở FR-04.
- **AC-04.2** When `id` không tồn tại, Then trả HTTP 404 với thông điệp lỗi thống nhất của API.
- **AC-04.3** When `id` không đúng định dạng UUID, Then trả HTTP 400.

### FR-05 – Size và topping
- **AC-05.1** Given sản phẩm có ba size S/M/L với phụ thu 0/5.000/10.000 VND, When gọi `GET /products/:id`, Then phản hồi liệt kê đủ ba size cùng `extraPrice`.
- **AC-05.2** Given sản phẩm cho phép 4 topping và 1 topping có `isAvailable = false`, When gọi `GET /products/:id`, Then topping hết hàng không được trả về hoặc được đánh dấu không chọn được.
- **AC-05.3** Topping không nằm trong danh sách cho phép của sản phẩm không xuất hiện trong phản hồi.

### FR-06 – Tính giá phía server
- **AC-06.1** Given giá cơ bản 40.000, size M +5.000, topping A +7.000 và topping B +5.000, số lượng 2, Then giá dòng = (40.000 + 5.000 + 7.000 + 5.000) × 2 = 114.000.
- **AC-06.2** When client gửi `unitPrice` khác giá thật, Then server dùng giá tính từ database và bỏ qua giá client gửi.
- **AC-06.3** When `quantity ≤ 0` hoặc không phải số nguyên, Then trả lỗi validate (HTTP 400).
- **AC-06.4** When size hoặc topping không thuộc sản phẩm, Then trả lỗi validate (HTTP 400/422).

### FR-07 – Tồn kho
- **AC-07.1** Given tồn kho = 3, When kiểm tra số lượng 3, Then hợp lệ; When kiểm tra số lượng 4, Then báo hết hàng/không đủ hàng.
- **AC-07.2** Given tồn kho = 0, When gọi `GET /products/:id`, Then sản phẩm được đánh dấu hết hàng (`isAvailable = false` hoặc `stockQuantity = 0`).
- **AC-07.3** Hàm trừ tồn kho chạy được bên trong transaction của `POST /orders`; khi transaction rollback thì tồn kho không đổi.
- **AC-07.4** Hai yêu cầu đồng thời mua cùng sản phẩm còn tồn kho = 1 thì chỉ một yêu cầu thành công; tồn kho không âm.

### FR-08 – Seed dữ liệu
- **AC-08.1** Given database trống, When chạy một lệnh migrate + seed, Then database có schema đầy đủ và tối thiểu 3 danh mục, 10 sản phẩm, 3 size cho mỗi sản phẩm, 5 topping.
- **AC-08.2** When chạy seed lần thứ hai, Then số bản ghi không thay đổi.

### NFR-01 – Hiệu năng
- **AC-N01** Với 200 sản phẩm seed, 50 kết nối đồng thời trong 30 giây, p95 của `GET /products` ≤ 300 ms.

### NFR-02 – Toàn vẹn dữ liệu
- **AC-N02.1** Ghi `stock_quantity = -1` trực tiếp vào database bị từ chối bởi ràng buộc CHECK.
- **AC-N02.2** Cột giá có kiểu số nguyên; không có giá trị thập phân trong dữ liệu seed.

### NFR-06 – Hợp đồng API
- **AC-N03** Trang Swagger mô tả `GET /products` và `GET /products/:id` với schema request/response, mã lỗi 400/404, và khớp với phản hồi thực tế.

### NFR-07 – Kiểm thử
- **AC-N04** Lệnh test của `apps/api` chạy `ProductsService` và `PricingService` thành công trong CI; mỗi ví dụ AC-06.x và AC-07.x có ít nhất một test tương ứng.

## 4. Liên kết với use-case, sơ đồ và code (đầu vào cho ma trận truy vết)

| Mã yêu cầu | User story / Use-case | Sơ đồ | Code / API | Test (dự kiến) |
|---|---|---|---|---|
| FR-01 | US-01 Xem menu | Activity-01, Class-01 (Product, Category) | `GET /products` | API-T01 |
| FR-02 | US-01 Xem menu | Class-01 (Category) | `GET /products?categoryId=` | API-T02 |
| FR-03 | US-01 Xem menu | Class-01 (Product) | `GET /products?q=` | API-T03 |
| FR-04 | US-02 Xem chi tiết sản phẩm | Activity-01, Class-01 (Product) | `GET /products/:id` | API-T04 |
| FR-05 | US-03 Chọn size/topping | Class-01 (Size, Topping) | `GET /products/:id` | API-T05 |
| FR-06 | UC-01 Đặt và thanh toán đơn hàng | Sequence-01, Class-01 (OrderItem) | `PricingService`, `POST /orders` | UT-T01 |
| FR-07 | UC-01 Đặt và thanh toán đơn hàng | Activity-01 (nhánh hết hàng), Sequence-01 | `ProductsService`, `POST /orders` | UT-T02, INT-T01 |
| FR-08 | – (hỗ trợ MVP) | Class-01 | `db:seed`, migration | MIG-T01 |
| NFR-02 | – | Class-01 | Migration (CHECK, kiểu số nguyên) | MIG-T02 |
| NFR-06 | – | – | Swagger/OpenAPI | API-T06 |

Mã user story (US-xx), use-case (UC-xx) và mã test là **đề xuất**; TV2, TV4 và TV6 xác nhận khi hợp nhất SRS và điền `docs/traceability-matrix.md`.

## 5. Lịch sử thay đổi

| Phiên bản | Ngày | Tác giả | Thay đổi / Lý do |
|---|---|---|---|
| 0.1 | 2026-11-01 | Đỗ Hoàng Vinh | Bản nháp đầu tiên cho nhóm menu và chi tiết sản phẩm |
