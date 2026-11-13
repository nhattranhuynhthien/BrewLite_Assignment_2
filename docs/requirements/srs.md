# SRS tổng quát – BrewLite

| Mục | Nội dung |
|---|---|
| Phiên bản | 1.0 – hợp nhất từ phạm vi, SRS menu/sản phẩm, SRS đặt hàng/thanh toán và yêu cầu triển khai |
| Trạng thái | Bộ mã FR/NFR chính thức dùng chung trong repository |
| Phạm vi | MVP đặt đồ uống tại quầy; thanh toán mô phỏng; một cửa hàng |
| Nguồn | [`context-and-scope.md`](./context-and-scope.md), [`srs-menu-product.md`](./srs-menu-product.md), [`srs-order-payment.md`](./srs-order-payment.md), [`deployment-nfr.md`](./deployment-nfr.md), [`architecture.md`](../architecture/architecture.md), README |

> **Căn cứ triển khai:** tại thời điểm hợp nhất, `apps/api`, `apps/web` và `tests` chỉ chứa `.gitkeep`; README cũng ghi rõ ứng dụng chưa được triển khai. Vì vậy, SRS này chuẩn hóa yêu cầu từ tài liệu và kiến trúc đã duyệt, không khẳng định tính năng đã có trong mã chạy được.

## 1. Quy ước mã

- Mã `FR-01`…`FR-49` và `NFR-01`…`NFR-14` là mã chuẩn, duy nhất cho toàn dự án.
- Các dải FR giữ nguyên quy ước phân nhóm: `01–09` menu/sản phẩm; `10–19` giỏ hàng; `20–29` xác thực; `30–39` đặt hàng/thanh toán; `40–49` lịch sử/trạng thái đơn. Mã chưa dùng được để trống, không tái sử dụng cho yêu cầu khác.
- NFR được đánh số lại liên tục để loại bỏ các mã cục bộ trùng hoặc không đồng nhất. Bảng ánh xạ NFR cũ ở mục 4 phục vụ truy vết; chỉ mã NFR chuẩn được dùng khi tạo yêu cầu mới.
- FR-09 là mã Won't được giữ duy nhất để lưu quyết định loại bỏ quản trị catalog; Won't và nội dung ngoài phạm vi khác không được cấp mã FR/NFR.

## 2. Stakeholder và quy tắc nghiệp vụ

| Actor | Mục tiêu / quyền chính |
|---|---|
| Khách hàng | Xem menu, chọn món, đăng ký/đăng nhập, đặt và thanh toán đơn, xem lịch sử và trạng thái đơn của mình |
| Nhân viên quầy (STAFF) | Xem đơn và cập nhật trạng thái xử lý đơn |
| Payment Service mô phỏng | Actor phụ nhận yêu cầu thanh toán Ví/Thẻ và trả kết quả; adapter được cài trong API |

Hệ thống phục vụ một cửa hàng, khách nhận tại quầy, đơn vị tiền tệ là VND nguyên, khách phải đăng nhập để đặt đơn, giá hợp lệ do server tính, còn giỏ hàng được giữ ở client. Thanh toán là mô phỏng. Promotion/tích điểm là phạm vi mở rộng (Could); gateway thật, giao hàng, quản trị catalog, hoàn tiền, hủy đơn đã thanh toán và push/SMS/email nằm ngoài phạm vi.

## 3. Yêu cầu chức năng

MoSCoW: **Must** bắt buộc, **Should** nên có, **Could** tùy thời gian.

### 3.1 Menu và sản phẩm (`FR-01`–`FR-09`)

| Mã | Yêu cầu | Ưu tiên |
|---|---|---|
| FR-01 | Hệ thống hiển thị menu phân trang gồm sản phẩm đang bán, tên, ảnh, giá cơ bản, danh mục và tình trạng còn/hết hàng. | Must |
| FR-02 | Khách hàng có thể lọc menu theo danh mục. | Should |
| FR-03 | Khách hàng có thể tìm sản phẩm theo tên, không phân biệt hoa thường và dấu tiếng Việt. | Could |
| FR-04 | Hệ thống hiển thị chi tiết sản phẩm gồm mô tả, ảnh, giá cơ bản, tồn kho và danh mục. | Must |
| FR-05 | Hệ thống hiển thị các size và topping khả dụng của sản phẩm cùng giá phụ thu. | Must |
| FR-06 | Hệ thống tính giá món ở server theo `(giá cơ bản + phụ thu size + tổng phụ thu topping) × số lượng`; không tin giá client gửi. | Must |
| FR-07 | Hệ thống kiểm tra tồn kho và không chấp nhận số lượng vượt tồn kho; mặt hàng hết được biểu thị rõ. | Must |
| FR-08 | Migration/seed tạo dữ liệu menu mẫu và chạy lặp lại không sinh bản ghi trùng. | Must |
| FR-09 | Quản lý thêm/sửa/xóa sản phẩm qua UI/API quản trị. **Won't trong MVP; giữ mã để truy vết quyết định phạm vi.** | Won't |

### 3.2 Giỏ hàng (`FR-10`–`FR-19`)

| Mã | Yêu cầu | Ưu tiên |
|---|---|---|
| FR-10 | Khách có thể thêm sản phẩm vào giỏ hàng. | Must |
| FR-11 | Khách có thể chọn size và các topping khả dụng cho từng dòng hàng. | Must |
| FR-12 | Khách có thể sửa số lượng hoặc lựa chọn của dòng hàng trong giỏ. | Must |
| FR-13 | Khách có thể xóa một dòng hoặc làm trống giỏ hàng. | Must |
| FR-14 | Giao diện hiển thị tổng tiền tạm tính từ menu hiện tại; giá trong giỏ chỉ để tham khảo, server tính lại lúc đặt đơn. | Must |
| FR-15 | Giỏ hàng được giữ ở phía client và được giữ lại khi khách cần đăng nhập trước khi đặt đơn. | Should |

FR-16…FR-19 để trống.

### 3.3 Xác thực và phân quyền (`FR-20`–`FR-29`)

| Mã | Yêu cầu | Ưu tiên |
|---|---|---|
| FR-20 | Người dùng có thể đăng ký tài khoản khách hàng bằng thông tin hợp lệ. | Must |
| FR-21 | Người dùng có thể đăng nhập và nhận thông tin xác thực phiên bằng JWT. | Must |
| FR-22 | Hệ thống yêu cầu JWT hợp lệ khi tạo đơn, thanh toán hoặc xem dữ liệu đơn cá nhân. | Must |
| FR-23 | Hệ thống chỉ cho khách hàng truy cập đơn của chính họ; không tin `userId` do client gửi để xác định chủ đơn. | Must |
| FR-24 | Hệ thống giới hạn thao tác cập nhật trạng thái đơn cho nhân viên có vai trò STAFF. | Must |

FR-25…FR-29 để trống. Đăng xuất phía client kết thúc phiên bằng cách xóa thông tin xác thực.

### 3.4 Đặt hàng và thanh toán (`FR-30`–`FR-39`)

| Mã | Yêu cầu | Ưu tiên |
|---|---|---|
| FR-30 | Khách đã đăng nhập có thể tạo đơn từ giỏ hàng hợp lệ; chủ đơn lấy từ JWT và đơn mới ở trạng thái `PENDING_PAYMENT`. | Must |
| FR-31 | Server tính tổng tiền và lưu snapshot tên, giá, size, topping của từng dòng tại thời điểm đặt; bỏ qua giá client gửi. | Must |
| FR-32 | Tạo đơn, tạo dòng đơn và trừ tồn kho diễn ra trong cùng transaction; thiếu hàng thì rollback toàn bộ. | Must |
| FR-33 | Khách có thể thanh toán đơn của mình đang `PENDING_PAYMENT` bằng Ví hoặc Thẻ mô phỏng; số tiền lấy từ đơn trong database. | Must |
| FR-34 | Yêu cầu thanh toán lặp lại với cùng `Idempotency-Key` không phát sinh tính tiền lần hai và trả lại kết quả đã lưu; mỗi đơn tối đa một thanh toán thành công. | Must |
| FR-35 | Khi gateway thành công, đơn chuyển `PAID`; khi thất bại, đơn chuyển `PAYMENT_FAILED` và tồn kho được hoàn đúng một lần. | Must |
| FR-36 | Khi gateway timeout, payment và đơn giữ trạng thái chờ; hệ thống đối soát theo key để xác định kết quả cuối. | Should |
| FR-37 | Hệ thống hủy đơn `PENDING_PAYMENT` quá hạn và hoàn tồn kho, nhưng không hủy payment đang chờ/thành công trước khi đối soát. | Should |
| FR-38 | Giao diện hiển thị xác nhận hoặc lỗi đặt/thanh toán rõ ràng, trạng thái đang xử lý và ngăn gửi lặp do bấm nhiều lần. | Must |
| FR-39 | Khách có thể áp dụng khuyến mãi và điểm tích lũy; server tính lại tổng tiền. | Could |

### 3.5 Lịch sử và trạng thái đơn (`FR-40`–`FR-49`)

| Mã | Yêu cầu | Ưu tiên |
|---|---|---|
| FR-40 | Khách có thể xem danh sách lịch sử đơn của chính mình. | Must |
| FR-41 | Khách có thể xem chi tiết và trạng thái hiện tại của một đơn thuộc quyền sở hữu của mình. | Must |
| FR-42 | Nhân viên có thể xem các đơn cần xử lý tại cửa hàng. | Must |
| FR-43 | Nhân viên có thể cập nhật trạng thái đơn theo luồng hợp lệ sau thanh toán (`PAID` → `PREPARING` → `READY` → `COMPLETED`). | Must |
| FR-44 | Hệ thống từ chối cập nhật trạng thái không hợp lệ hoặc do người dùng không đủ quyền. | Must |

FR-45…FR-49 để trống. Theo dõi trạng thái bằng cách tải/làm mới dữ liệu; thông báo đẩy không thuộc MVP.

## 4. Yêu cầu phi chức năng

| Mã chuẩn | Nhóm | Yêu cầu và tiêu chí nghiệm thu | Ưu tiên |
|---|---|---|---|
| NFR-01 | Hiệu năng | Với dữ liệu seed ≤200 sản phẩm, 50 kết nối đồng thời trong 30 giây: p95 `GET /products` ≤300 ms và `POST /orders` ≤500 ms, không tính độ trễ giả lập gateway. | Should |
| NFR-02 | Toàn vẹn và đồng thời | Giá là số nguyên VND; tồn kho không âm; tạo đơn/trừ kho all-or-nothing; đồng thời không bán vượt tồn; mỗi đơn tối đa một payment SUCCESS. | Must |
| NFR-03 | Bảo mật | Mật khẩu được băm; API yêu cầu JWT và kiểm tra quyền sở hữu/vai trò; chỉ tin giá phía server; không ghi log mật khẩu, JWT, secret hoặc dữ liệu thanh toán nhạy cảm. | Must |
| NFR-04 | Phục hồi giao dịch | Timeout/lỗi gateway không làm mất hoặc tính trùng giao dịch; trạng thái payment/đơn có thể đối soát; hoàn kho/hủy đơn chỉ thực hiện tối đa một lần. | Must |
| NFR-05 | Trải nghiệm UI | Màn hình dữ liệu có loading/empty/error; thao tác gửi bị khóa khi đang xử lý; thông báo nêu nguyên nhân và giữ giỏ khi chuyển sang đăng nhập. | Should |
| NFR-06 | Hợp đồng API | Hợp đồng request/response cho API sản phẩm, đơn, thanh toán, xác thực và mã lỗi liên quan được công bố bằng Swagger/OpenAPI, khớp hành vi API. | Must |
| NFR-07 | Khả năng kiểm thử | Unit test bao phủ định giá, tồn kho, chuyển trạng thái và idempotency; integration test PostgreSQL bao phủ đặt đơn/thanh toán, lỗi, đồng thời và timeout; test chạy trong CI. | Must |
| NFR-08 | CI | PR được kiểm tra tự động install, lint, unit test và build cho web/API; không merge khi kiểm tra bắt buộc thất bại. | Must |
| NFR-09 | Chạy local và tái tạo dữ liệu | Docker Compose khởi chạy web/API/PostgreSQL; database mới có thể migrate/seed theo README và menu/API truy cập được; PostgreSQL dùng persistent volume. | Must |
| NFR-10 | Health check | `GET /health` trả 200 khi API và DB sẵn sàng, 503 khi DB không sẵn sàng; smoke test sau deploy kiểm tra health và menu. | Must |
| NFR-11 | Cấu hình và secrets | Cấu hình lấy từ môi trường; repository chỉ có `.env.example`; secret thật không xuất hiện trong Git hoặc log CI/CD. | Must |
| NFR-12 | Phát hành và rollback | Deploy có quality gate, image/tag theo phiên bản, migration trước khi chuyển lưu lượng, smoke test sau deploy; lỗi thì dừng và có hướng dẫn rollback an toàn. | Must |
| NFR-13 | Production | Web production truy cập qua HTTPS; database production có persistent storage và không public trực tiếp; deployment diagram phản ánh hạ tầng thực tế. | Must |
| NFR-14 | Bàn giao | Có release/tag và hướng dẫn chạy, test, build, deploy, rollback đủ để người ngoài nhóm kiểm tra hệ thống. | Must |

### 4.1 Ánh xạ mã NFR từ tài liệu thành phần

| Mã cũ trong tài liệu thành phần | Mã chuẩn |
|---|---|
| Menu `NFR-01` | NFR-01 |
| Menu `NFR-02` | NFR-02 |
| Menu `NFR-03` | NFR-06 |
| Menu `NFR-04` | NFR-07 |
| `NFR-ORD-01` | NFR-02 |
| `NFR-ORD-02` | NFR-03 |
| `NFR-ORD-03` | NFR-04 |
| `NFR-ORD-04` | NFR-01 |
| `NFR-ORD-05` | NFR-05 |
| `NFR-ORD-06` | NFR-06 |
| `NFR-ORD-07` | NFR-07 |
| `NFR-DEP-01` | NFR-08 |
| `NFR-DEP-02` | NFR-09 |
| `NFR-DEP-03` | NFR-10 |
| `NFR-DEP-04` | NFR-03 |
| `NFR-DEP-05` | NFR-11 |
| `NFR-DEP-06` | NFR-12 |
| `NFR-DEP-07` | NFR-13 |
| `NFR-DEP-08` | NFR-14 |

## 5. Use-case tổng quát và truy vết

Nguồn sơ đồ: [`use-case-overview.puml`](../diagrams/use-case-overview.puml); bản SVG: [`use-case-overview.svg`](../diagrams/use-case-overview.svg).

| Use-case | Actor chính | Yêu cầu liên quan |
|---|---|---|
| UC-01 Đặt và thanh toán đơn | Khách hàng, Payment Service mô phỏng | FR-06, FR-07, FR-30…FR-39 |
| UC-02 Xem menu và chi tiết sản phẩm | Khách hàng | FR-01…FR-05 |
| UC-03 Quản lý giỏ hàng | Khách hàng | FR-10…FR-15 |
| UC-04 Đăng ký/đăng nhập | Khách hàng, Nhân viên | FR-20…FR-24 |
| UC-05 Xem lịch sử/theo dõi đơn | Khách hàng | FR-40, FR-41 |
| UC-06 Xử lý đơn tại quầy | Nhân viên | FR-42…FR-44 |

Đặc tả luồng checkout chi tiết tại [`use-case-checkout.md`](./use-case-checkout.md); sơ đồ trình tự tại [`sequence-checkout.puml`](../diagrams/sequence-checkout.puml).

![Sơ đồ use-case tổng quát BrewLite](../diagrams/use-case-overview.svg)

## 6. Lịch sử thay đổi

| Phiên bản | Thay đổi |
|---|---|
| 1.0 | Hợp nhất các nhóm yêu cầu; chốt mã FR/NFR chuẩn; ghi nhận trạng thái hiện tại của mã nguồn và tạo truy vết sơ đồ use-case. |
