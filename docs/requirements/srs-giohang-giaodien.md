# SRS BrewLite – Nhóm Giỏ hàng và Giao diện

Bài tập lớn Công nghệ Phần mềm – Assignment 2, Task 1.2 · Phiên bản 1.0 · 13/11/2026 · Trường Đại học Sài Gòn, Khoa CNTT

## 1. Giới thiệu

### 1.1 Mục đích

Tài liệu này đặc tả yêu cầu phần mềm cho hai nhóm chức năng của BrewLite: **Giỏ hàng** (mã CART) và **Giao diện người dùng** (mã UI). Tài liệu là một phần của SRS rút gọn theo Task 1.2, dùng làm căn cứ để thiết kế (Task 2–3), hiện thực (Task 4–5) và viết kiểm thử.

### 1.2 Phạm vi

BrewLite là ứng dụng đặt đồ uống mobile-first/PWA (Next.js, NestJS, PostgreSQL). Luồng nghiệp vụ tối thiểu: Xem menu → Chọn tùy chọn → **Giỏ hàng** → Đặt đơn → Thanh toán → Theo dõi đơn.

**Trong phạm vi tài liệu này:**

* Thêm, sửa, xóa món; tính tổng tiền; kiểm tra tồn kho và giá của giỏ hàng; chuyển từ giỏ sang đặt đơn.
* Yêu cầu chung về giao diện: bố cục, trạng thái màn hình, điều hướng, phản hồi người dùng, khả năng truy cập, hiệu năng phía giao diện.
* Các màn hình liên quan trực tiếp đến giỏ hàng: Menu, Chi tiết sản phẩm, Giỏ hàng, Đăng nhập khi thanh toán.

**Ngoài phạm vi (thuộc nhóm khác trong SRS):** logic đăng ký/đăng nhập, tạo đơn, thanh toán, quản lý trạng thái đơn, trang quản trị của nhân viên.

### 1.3 Thuật ngữ

| Thuật ngữ | Giải thích |
| --- | --- |
| Dòng giỏ hàng (CartItem) | Một mục trong giỏ, xác định bởi sản phẩm + size + tập topping + ghi chú |
| Đơn giá dòng | Giá gốc + phụ thu size + tổng giá topping, cho một ly |
| Tạm tính | Tổng (đơn giá dòng × số lượng) của mọi dòng |
| MoSCoW | Must / Should / Could / Won’t |
| FR / NFR | Yêu cầu chức năng / phi chức năng |

### 1.4 Tài liệu tham chiếu

* Đề bài BrewLite – Assignment 2, Ver 1.0.
* docs/requirements/context-and-scope.md (Task 1.1).
* docs/traceability-matrix.md.

## 2. Mô tả tổng quan

### 2.1 Actor

| Actor | Vai trò với giỏ hàng và giao diện |
| --- | --- |
| Khách hàng (chưa đăng nhập) | Xem menu, thêm món vào giỏ, chỉnh giỏ; phải đăng nhập mới được đặt đơn |
| Khách hàng (đã đăng nhập) | Như trên, và tiếp tục sang đặt đơn |
| NestJS API | Cung cấp dữ liệu sản phẩm, kiểm tra giỏ, tính lại giá |
| Nhân viên quầy, quản lý | Không thao tác giỏ hàng; chỉ nhận đơn sau khi khách đặt |

### 2.2 Giả định và ràng buộc

* **GS-01:** Giỏ hàng được giữ ở phía client (state + localStorage) để khách chưa đăng nhập vẫn dùng được; server chỉ kiểm tra và tính lại khi cần. Đây là quyết định đề xuất, cần xác nhận khi viết ADR (Task 3.1).
* **GS-02:** Mọi giá tiền dùng VND, số nguyên, không có phần thập phân.
* **GS-03:** Menu, size, topping và tồn kho lấy từ API; giỏ chỉ lưu mã tham chiếu và ảnh chụp giá để hiển thị.
* **RB-01:** Frontend bắt buộc dùng Next.js theo hướng mobile-first/PWA; backend NestJS; cơ sở dữ liệu PostgreSQL.
* **RB-02:** Ngôn ngữ giao diện của MVP là tiếng Việt.

## 3. Use-case nhóm Giỏ hàng

| Mã | Use-case | Actor chính | FR liên quan |
| --- | --- | --- | --- |
| UC-C1 | Thêm món vào giỏ | Khách hàng | FR-CART-01, 02, 03 |
| UC-C2 | Xem giỏ và tổng tiền | Khách hàng | FR-CART-04, 07 |
| UC-C3 | Sửa số lượng món | Khách hàng | FR-CART-05, 07 |
| UC-C4 | Xóa món / làm trống giỏ | Khách hàng | FR-CART-06, 12 |
| UC-C5 | Chuyển sang đặt đơn | Khách hàng | FR-CART-09, 10, 11 |

### 3.1 Đặc tả UC-C1 – Thêm món vào giỏ

| Mục | Nội dung |
| --- | --- |
| Actor | Khách hàng; hệ thống phụ: NestJS API |
| Trigger | Khách bấm “Thêm vào giỏ” trên màn hình Chi tiết sản phẩm |
| Tiền điều kiện | Sản phẩm đang bán và còn hàng; màn hình đã tải xong dữ liệu tùy chọn |
| Hậu điều kiện | Giỏ có thêm dòng mới hoặc số lượng của dòng trùng được tăng; badge giỏ cập nhật |

**Luồng chính**

1. Khách chọn size, các topping (nếu có) và số lượng.
2. Giao diện cập nhật đơn giá và thành tiền theo lựa chọn.
3. Khách bấm “Thêm vào giỏ”.
4. Hệ thống kiểm tra tính hợp lệ (đã chọn size, số lượng trong giới hạn, số topping trong giới hạn).
5. Hệ thống tìm dòng giỏ trùng (cùng sản phẩm, size, tập topping, ghi chú); nếu có thì cộng dồn số lượng, nếu không thì tạo dòng mới.
6. Hệ thống lưu giỏ vào localStorage, cập nhật badge và hiện thông báo “Đã thêm vào giỏ”.

**Luồng thay thế**

* **A1:** Khách bấm “Thêm vào giỏ” khi chưa chọn size → hiện lỗi cạnh nhóm size, giữ nguyên màn hình, không thêm.
* **A2:** Cộng dồn làm số lượng vượt 20 → đặt về 20 và báo “Tối đa 20 ly mỗi món”.

**Luồng ngoại lệ**

* **E1:** Sản phẩm hoặc topping vừa hết hàng khi đang chọn → vô hiệu hóa nút, hiện “Tạm hết hàng”.
* **E2:** localStorage không ghi được → vẫn giữ giỏ trong bộ nhớ phiên và báo giỏ có thể mất khi tải lại trang.

## 4. Yêu cầu chức năng – Giỏ hàng

| Mã | Yêu cầu | Ưu tiên | Tiêu chí chấp nhận |
| --- | --- | --- | --- |
| FR-CART-01 | Thêm món vào giỏ kèm size, topping và số lượng | Must | Chọn Cà phê sữa, size M, 2 topping, SL 2 → giỏ có đúng 1 dòng với các giá trị đó |
| FR-CART-02 | Kiểm tra dữ liệu trước khi thêm: size bắt buộc, SL từ 1 đến 20, tối đa 5 topping | Must | Thiếu size → không thêm và có thông báo lỗi; SL 21 bị chặn |
| FR-CART-03 | Gộp dòng trùng (cùng sản phẩm, size, tập topping, ghi chú) | Must | Thêm cùng cấu hình 2 lần → 1 dòng, SL cộng dồn; khác topping → 2 dòng |
| FR-CART-04 | Hiển thị giỏ: tên, ảnh, size, topping, đơn giá, số lượng, thành tiền từng dòng | Must | Mỗi dòng hiển thị đủ 7 trường; thứ tự theo thời điểm thêm |
| FR-CART-05 | Tăng/giảm số lượng từng dòng; giảm về 0 thì hỏi xác nhận xóa | Must | Bấm “+” tăng 1 và tổng cập nhật ngay; giảm từ 1 xuống 0 hiện hộp thoại xác nhận |
| FR-CART-06 | Xóa một dòng khỏi giỏ | Must | Dòng biến mất, tổng cập nhật, badge giảm tương ứng |
| FR-CART-07 | Tính tạm tính theo công thức BR-01 | Must | Với dữ liệu mẫu, tổng hiển thị bằng tổng tính tay; làm tròn không phát sinh |
| FR-CART-08 | Giữ giỏ sau khi tải lại trang, đóng và mở lại trình duyệt, và sau khi đăng nhập | Should | Thêm món → tải lại → giỏ không đổi; đăng nhập xong giỏ vẫn còn |
| FR-CART-09 | Kiểm tra hết hàng/ngừng bán khi mở giỏ và khi bấm đặt đơn | Must | Món hết hàng bị đánh dấu “Hết hàng”, nút Đặt đơn bị khóa cho đến khi xóa hoặc đổi món |
| FR-CART-10 | Khi giá server khác giá trong giỏ, cập nhật giá mới và thông báo cho khách trước khi tiếp tục | Must | Đổi giá trong DB → mở giỏ → hiện giá mới và thông báo thay đổi; tổng khớp giá mới |
| FR-CART-11 | Bấm “Đặt đơn” khi chưa đăng nhập thì chuyển đến đăng nhập, sau đó quay lại giỏ với dữ liệu nguyên vẹn | Must | Giỏ trước và sau đăng nhập giống nhau từng dòng |
| FR-CART-12 | Làm trống toàn bộ giỏ có xác nhận | Should | Sau xác nhận giỏ rỗng và hiện trạng thái giỏ trống |
| FR-CART-13 | Ghi chú cho từng món (tối đa 100 ký tự) | Could | Ghi chú lưu cùng dòng và hiển thị trong giỏ |
| FR-CART-14 | Nhập mã khuyến mãi tại giỏ | Could | Mã hợp lệ làm giảm tổng theo quy tắc Promotion; mã sai báo lỗi rõ ràng |
| FR-CART-15 | Đồng bộ giỏ giữa nhiều thiết bị | Won’t (MVP) | Không thực hiện trong MVP |

## 5. Quy tắc nghiệp vụ

| Mã | Quy tắc |
| --- | --- |
| BR-01 | Đơn giá dòng = giá gốc + phụ thu size + tổng giá topping. Thành tiền dòng = đơn giá dòng × số lượng. Tạm tính = tổng thành tiền các dòng |
| BR-02 | Mỗi dòng tối đa 20 ly; mỗi giỏ tối đa 30 dòng; mỗi món tối đa 5 topping |
| BR-03 | Server là nguồn giá đúng. Giá trong giỏ chỉ để hiển thị; khi tạo đơn, server tính lại toàn bộ và bỏ qua giá do client gửi |
| BR-04 | Chỉ khách đã đăng nhập (JWT hợp lệ) mới tạo được đơn; khách chưa đăng nhập vẫn được dùng giỏ |
| BR-05 | Giỏ không được chứa món đã ngừng bán hoặc hết hàng khi chuyển sang đặt đơn |

## 6. Yêu cầu giao diện người dùng

### 6.1 Nguyên tắc chung

* Thiết kế mobile-first, bố cục cơ sở 360 px, mở rộng lên máy tính bảng và desktop.
* Dùng chung bộ thành phần (nút, thẻ sản phẩm, hộp thoại, thông báo) và design tokens (màu, cỡ chữ, khoảng cách).
* Tiền hiển thị theo dạng 45.000 ₫; thông báo và nhãn bằng tiếng Việt.

### 6.2 Danh sách màn hình

| Mã | Màn hình | Thành phần chính | FR liên quan |
| --- | --- | --- | --- |
| SCR-01 | Menu | Thanh danh mục, thẻ sản phẩm, badge giỏ | FR-UI-01, 03 |
| SCR-02 | Chi tiết sản phẩm | Chọn size, topping, số lượng, giá động, nút Thêm vào giỏ | FR-UI-02, 06 |
| SCR-03 | Giỏ hàng | Danh sách dòng, bộ chỉnh số lượng, thanh tổng tiền cố định, nút Đặt đơn | FR-UI-04, 05, 10 |
| SCR-04 | Đăng nhập / Đăng ký | Biểu mẫu có kiểm tra dữ liệu | FR-UI-08 |
| SCR-05 | Xác nhận đơn và theo dõi | Thanh trạng thái đơn | FR-UI-11 |

### 6.3 Yêu cầu chức năng giao diện

| Mã | Yêu cầu | Ưu tiên | Tiêu chí chấp nhận |
| --- | --- | --- | --- |
| FR-UI-01 | Màn hình Menu hiển thị sản phẩm theo danh mục, có trạng thái loading, empty và error | Must | Giả lập API chậm → thấy skeleton; trả mảng rỗng → thấy thông báo trống; API lỗi → có nút Thử lại |
| FR-UI-02 | Chi tiết sản phẩm cho chọn size (bắt buộc), topping, số lượng; giá cập nhật ngay khi đổi lựa chọn | Must | Đổi size → đơn giá và thành tiền đổi trong vòng 100 ms, không gọi lại API |
| FR-UI-03 | Biểu tượng giỏ ở thanh điều hướng có badge tổng số ly, cập nhật tức thì | Must | Thêm 2 ly → badge tăng 2; giỏ rỗng → ẩn badge |
| FR-UI-04 | Màn hình Giỏ hiển thị danh sách dòng và thanh tổng tiền cố định ở cuối màn hình cùng nút Đặt đơn | Must | Cuộn danh sách dài vẫn thấy tổng tiền và nút Đặt đơn |
| FR-UI-05 | Giỏ rỗng hiển thị hình minh họa, lời nhắn và nút quay lại Menu | Must | Giỏ rỗng → nút Đặt đơn không xuất hiện |
| FR-UI-06 | Phản hồi thao tác: thông báo sau khi thêm món, hộp thoại xác nhận khi xóa, hoàn tác xóa trong 5 giây | Must (thông báo, xác nhận); Should (hoàn tác) | Xóa món → có hộp thoại; nếu bấm Hoàn tác trong 5 giây, món trở lại đúng vị trí |
| FR-UI-07 | Mọi màn hình gọi API đều có trạng thái loading và lỗi kèm cách thử lại | Must | Ngắt mạng → hiện thông báo lỗi và nút Thử lại; dữ liệu giỏ không mất |
| FR-UI-08 | Biểu mẫu kiểm tra dữ liệu ngay dưới từng ô nhập, bằng tiếng Việt | Must | Email sai định dạng → thông báo ngay khi rời ô; nút gửi bị khóa khi còn lỗi |
| FR-UI-09 | Thanh điều hướng dưới cùng gồm Menu, Giỏ hàng, Đơn hàng, Tài khoản | Should | Mỗi mục dẫn đúng màn hình; mục hiện tại được tô nổi bật |
| FR-UI-10 | Nút gửi (Đặt đơn, Thanh toán) bị vô hiệu hóa và hiện trạng thái đang xử lý trong lúc gửi | Must | Bấm liên tiếp 5 lần chỉ phát sinh 1 yêu cầu |
| FR-UI-11 | Màn hình theo dõi đơn hiển thị các bước trạng thái và bước hiện tại | Should | Trạng thái đơn đổi → giao diện cập nhật sau lần tải lại hoặc làm mới |
| FR-UI-12 | Ứng dụng cài được lên màn hình chính (PWA: manifest, biểu tượng, service worker cơ bản) | Should | Lighthouse PWA báo installable; mở từ biểu tượng cài đặt chạy toàn màn hình |
| FR-UI-13 | Chế độ tối | Could | Giao diện theo cài đặt hệ thống, vẫn đạt tương phản tối thiểu |
| FR-UI-14 | Đa ngôn ngữ | Won’t (MVP) | Chỉ hỗ trợ tiếng Việt |

## 7. Yêu cầu phi chức năng

| Mã | Nhóm | Yêu cầu | Ưu tiên | Tiêu chí chấp nhận |
| --- | --- | --- | --- | --- |
| NFR-UI-01 | Tương thích | Bố cục hiển thị đúng từ 360 đến 1440 px, không cuộn ngang | Must | Kiểm tra ở 360, 768, 1280 px: không tràn nội dung |
| NFR-UI-02 | Trình duyệt | Hỗ trợ 2 phiên bản mới nhất của Chrome, Edge, Safari (kể cả iOS) | Must | Luồng Menu → Giỏ chạy đúng trên các trình duyệt này |
| NFR-UI-03 | Hiệu năng | Màn hình Menu đạt LCP ≤ 2,5 s trên mạng 4G giả lập | Should | Lighthouse mobile ghi nhận LCP ≤ 2,5 s trên dữ liệu mẫu |
| NFR-UI-04 | Hiệu năng | Thao tác trên giỏ (thêm, sửa, xóa) phản hồi trên giao diện ≤ 100 ms | Should | Đo bằng công cụ trình duyệt trên dữ liệu 30 dòng |
| NFR-UI-05 | Khả năng truy cập | Tương phản chữ/nền ≥ 4,5:1; vùng chạm ≥ 44×44 px; nút và ô nhập có nhãn | Should | Kiểm tra Lighthouse Accessibility ≥ 90 và đo thủ công vùng chạm |
| NFR-UI-06 | Tính khả dụng | Từ Menu đến thêm một món vào giỏ không quá 3 lần chạm | Should | Thử nghiệm với 3 người dùng không thuộc nhóm, đều hoàn thành |
| NFR-UI-07 | Nhất quán | Dùng chung design tokens và thành phần cho mọi màn hình | Should | Không có màu hoặc cỡ chữ cố định ngoài tokens trong mã giao diện |
| NFR-CART-01 | Bảo mật | Server không tin giá từ client; mọi dữ liệu giỏ gửi lên được validate | Must | Gửi giá sai qua công cụ API → đơn vẫn tính theo giá server |
| NFR-CART-02 | Bảo mật | Không lưu token hay thông tin nhạy cảm cùng dữ liệu giỏ trong localStorage | Must | Kiểm tra bộ nhớ trình duyệt: giỏ chỉ có mã, số lượng, tùy chọn, giá hiển thị |
| NFR-CART-03 | Độ tin cậy | Lỗi mạng hoặc API không làm mất giỏ | Must | Ngắt mạng khi kiểm tra giỏ → giỏ còn nguyên, có thông báo lỗi |
| NFR-CART-04 | Hiệu năng | API kiểm tra giỏ có p95 ≤ 500 ms với giỏ 30 dòng | Should | Kiểm thử tải nhẹ trên môi trường local ghi nhận p95 ≤ 500 ms |

## 8. Giao diện với hệ thống (API)

Các endpoint dưới đây là đề xuất, sẽ được chốt cùng nhóm thiết kế kiến trúc.

| Endpoint | Mục đích | FR liên quan |
| --- | --- | --- |
| GET /products | Danh sách sản phẩm cho Menu | FR-UI-01 |
| GET /products/:id | Chi tiết, size, topping, tồn kho | FR-UI-02, FR-CART-02 |
| POST /cart/validate | Gửi các dòng giỏ; trả về giá hiện tại, tình trạng còn hàng và tạm tính | FR-CART-09, 10 |
| POST /auth/login | Đăng nhập để tiếp tục đặt đơn | FR-CART-11 |
| POST /orders | Tạo đơn từ giỏ; server tính lại giá | BR-03, FR-CART-10 |

## 9. Mô hình dữ liệu của giỏ hàng

**CartItem**: productId, sizeId, toppingIds[], quantity, note, unitPriceSnapshot, addedAt.

**Cart**: items[] (tối đa 30), subtotal (tính từ items).

Quan hệ: một Cart chứa 0..30 CartItem; mỗi CartItem tham chiếu 1 Product, 1 size và 0..5 topping. Khi đặt đơn, mỗi CartItem được chuyển thành một OrderItem (giá lấy lại từ server) trong Order. Cart là cấu trúc phía client, không có bảng riêng trong PostgreSQL ở MVP.

## 10. Truy vết (trích mẫu)

| Mã yêu cầu | Use-case / User story | Thiết kế | Code / API | Test |
| --- | --- | --- | --- | --- |
| FR-CART-01 | UC-C1 | Activity-01, Class-01 | Cart store (web) | UI-T01 |
| FR-CART-07 | UC-C2 | Class-01 | Hàm tính tổng (web, api) | UNIT-T02 |
| FR-CART-10 | UC-C5 | Sequence-01 | POST /cart/validate | INT-T04 |
| FR-UI-01 | US-01 Xem menu | Activity-01 | GET /products | API-T01, UI-T02 |
| FR-UI-10 | UC-C5 | Sequence-01 | Nút gửi (web) | E2E-T01 |

## 11. Rủi ro và vấn đề mở

| Mã | Nội dung | Hướng xử lý |
| --- | --- | --- |
| OI-01 | Giỏ lưu ở client hay server (GS-01) | Quyết định bằng ADR ở Task 3.1; nếu chọn server, bổ sung bảng cart và endpoint tương ứng |
| OI-02 | Khuyến mãi có vào MVP không (FR-CART-14) | Chốt cùng nhóm phụ trách Promotion trước Sprint 2 |
| OI-03 | Giới hạn 20 ly và 5 topping là giả định | Xác nhận với giảng viên hoặc khách hàng nghiệm thu |
| RK-01 | Giá đổi giữa lúc thêm và lúc đặt đơn gây khiếu nại | Đã xử lý bằng BR-03 và FR-CART-10 |
