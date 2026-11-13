# SRS rút gọn – Lịch sử đơn, quản lý trạng thái, hiệu năng và tính khả dụng

| Mục | Nội dung |
|---|---|
| Task | 1.2 – Yêu cầu chức năng và phi chức năng; D-06 / I-13a, thuộc issue #47 |
| Phiên bản | 0.1 – Chờ review |
| Tác giả | Nguyễn Cao Tòng Nhân (TV6) |
| Reviewer | TV5 |
| Phạm vi | Lịch sử và chi tiết đơn của khách; theo dõi trạng thái; cập nhật trạng thái phục vụ của staff; hiệu năng và giao diện dễ sử dụng |
| Đầu vào | D-01 và D-02 đã hoàn tất theo xác nhận của TV6; SRS đặt đơn và thanh toán dùng để thống nhất trạng thái và dữ liệu đơn |
| Hợp nhất | Mã chuẩn và yêu cầu đã hợp nhất tại [SRS tổng hợp](./srs.md); tài liệu này giữ tiêu chí chi tiết |

Mã FR-40–FR-49 thuộc nhóm lịch sử/trạng thái đơn. Các mã NFR-HIS-01–NFR-HIS-04 là mã cục bộ; xem ánh xạ sang mã chuẩn trong [SRS tổng hợp](./srs.md). “Tính khả dụng” trong tài liệu này là tính dễ sử dụng của giao diện, không phải tỷ lệ uptime.

Đây là đặc tả để triển khai và kiểm thử ở các task sau, không phải báo cáo tính năng đã chạy hoặc kết quả đo hiệu năng.

## 1. Phạm vi và tài liệu đầu vào

- [Bối cảnh và phạm vi – D-01](context-and-scope.md): khách nhận tại quầy; lịch sử/theo dõi đơn là Must; API cập nhật trạng thái của staff là Must, giao diện staff là Should; theo dõi bằng làm mới/polling.
- [SRS menu và sản phẩm – D-02](srs-menu-product.md): dải mã FR-40–FR-49 dành cho TV6; ngưỡng hiệu năng menu được giữ tại D-02.
- [SRS đặt đơn và thanh toán – D-05](srs-order-payment.md): FR-31 lưu snapshot đơn; FR-35–FR-37 quản lý kết quả thanh toán, đối soát và hủy quá hạn; FR-38 đặc tả màn hình xác nhận.
- [Bảng phân công](https://docs.google.com/spreadsheets/d/15VLxzyJ0v3ia--efn-OwMkaQ-XRYAGbF3JuVSmXxduY/edit?gid=816437868#gid=816437868): D-06 thuộc Task 1, mỗi FR/NFR phải có mã, MoSCoW và tiêu chí kiểm chứng.
- [Issue I-13](https://github.com/nhattranhuynhthien/BrewLite_Assignment_2/issues/47): D-06 là phần I-13a; ADR kiểm thử và khung traceability thuộc phần I-13b riêng.

D-06 sử dụng đăng nhập và phân quyền customer/staff của nhóm xác thực. D-06 không bổ sung hủy đơn sau thanh toán, hoàn tiền, giao hàng, push/SMS/email, chức năng quản trị sản phẩm hoặc thanh toán thật.

## 2. Yêu cầu chức năng

| Mã | Yêu cầu | MoSCoW | Thành phần | Nguồn |
|---|---|---|---|---|
| FR-40 | Khách đã đăng nhập xem lịch sử toàn bộ đơn của chính mình, gồm cả đơn chờ thanh toán, thất bại và bị hủy; danh sách hiển thị đơn mới nhất trước và có phân trang. | Must | GET /orders; màn hình lịch sử đơn | S1 |
| FR-41 | Khách xem chi tiết đơn của chính mình: mã đơn, thời điểm tạo, món, size, topping, số lượng, giá đã lưu, tổng tiền, trạng thái đơn và thông tin thanh toán hiện có. | Must | GET /orders/:id; màn hình chi tiết đơn | S1 |
| FR-42 | Khách theo dõi trạng thái hiện tại của đơn bằng làm mới hoặc polling; trạng thái được lấy từ server và hiển thị bằng nhãn tiếng Việt. | Must | Màn hình theo dõi đơn; GET /orders/:id | S1, S2 |
| FR-43 | Staff cập nhật trạng thái phục vụ của đơn theo đúng các bước PAID → PREPARING → READY → COMPLETED. Hệ thống từ chối người không có quyền, chuyển trạng thái không hợp lệ và cập nhật dựa trên trạng thái đã cũ. | Must | API cập nhật trạng thái đơn | S2, S3 |
| FR-44 | Staff có giao diện xem đơn cần phục vụ và thực hiện chuyển trạng thái hợp lệ, có phản hồi thành công/thất bại. | Should | Màn hình staff | S2 |

S1, S2, S3 lần lượt là khách hàng, nhân viên quầy và quản lý cửa hàng trong D-01. Quản lý chỉ sử dụng chức năng này khi có quyền staff; tài liệu không thêm vai trò mới.

### FR-40 – Lịch sử đơn

- **AC-40.1:** Given khách A và B đều có đơn, When A mở lịch sử, Then chỉ có đơn của A. Chủ đơn được xác định từ phiên đăng nhập; thay tham số người dùng không được làm lộ đơn của B.
- **AC-40.2:** Given A có 25 đơn, When mở trang đầu với kích thước mặc định 20, Then trả 20 đơn và thông tin trang/tổng số; trang kế tiếp trả 5 đơn còn lại khi dữ liệu không thay đổi. Thứ tự là thời điểm tạo giảm dần; các đơn cùng thời điểm có thứ tự phụ theo mã đơn để kết quả ổn định.
- **AC-40.3:** Mỗi dòng lịch sử hiển thị mã đơn, thời điểm tạo, tổng tiền VND và trạng thái; khách chọn một dòng để mở đúng chi tiết đơn đó.
- **AC-40.4:** Given khách chưa có đơn, Then API trả danh sách rỗng thành công và giao diện hiển thị “Bạn chưa có đơn hàng”, kèm đường dẫn về menu; không hiển thị như lỗi hệ thống.
- **AC-40.5:** Given chưa đăng nhập hoặc phiên hết hạn, When gọi API lịch sử, Then trả 401, không trả dữ liệu đơn; giao diện yêu cầu đăng nhập.
- **AC-40.6:** Với dữ liệu đủ các trạng thái ở mục 4, lịch sử vẫn hiển thị các đơn PAYMENT_FAILED và CANCELLED, không chỉ đơn thành công.

### FR-41 – Chi tiết đơn

- **AC-41.1:** Given đơn thuộc khách đang đăng nhập, When mở chi tiết, Then hiển thị đủ mã đơn, thời điểm tạo, từng món với size/topping/số lượng/đơn giá/thành tiền, tổng tiền và trạng thái hiện tại. Tên và giá dùng snapshot theo FR-31, không tính lại từ menu hiện tại.
- **AC-41.2:** Given menu thay tên hoặc giá sau lúc đặt, When xem lại đơn, Then tên, giá và tổng tiền trong đơn không đổi.
- **AC-41.3:** Given đơn chưa có giao dịch thanh toán, Then hiển thị chưa thanh toán, không tự gán phương thức Ví/Thẻ. Khi đã có giao dịch, hiển thị phương thức và trạng thái thanh toán do server trả về; thanh toán đang chờ xử lý không được hiển thị là thành công.
- **AC-41.4:** Given A yêu cầu chi tiết đơn của B, Then API trả 403 và không trả nội dung đơn. Mã đơn không tồn tại trả 404; phiên thiếu/hết hạn trả 401.
- **AC-41.5:** Khi tải lại trang hoặc đăng nhập lại bằng cùng tài khoản, khách vẫn truy cập được đơn đã lưu trong database.

### FR-42 – Theo dõi trạng thái

- **AC-42.1:** Khi tải hoặc làm mới thành công, nhãn trạng thái trên UI khớp dữ liệu server theo bảng mục 4; việc đọc đơn không làm thay đổi trạng thái.
- **AC-42.2:** Với trang theo dõi đang mở và hiển thị, các đơn chưa kết thúc được polling mỗi 5 giây, không gửi chồng yêu cầu khi lần trước chưa hoàn tất. Dừng polling khi rời trang hoặc đơn đã COMPLETED, PAYMENT_FAILED, CANCELLED.
- **AC-42.3:** Given staff chuyển đơn từ PREPARING sang READY, When lần làm mới tiếp theo thành công, Then UI chuyển từ “Đang pha chế” sang “Sẵn sàng nhận”; không yêu cầu khách tạo lại đơn.
- **AC-42.4:** Given làm mới thất bại do mạng/API, Then giữ thông tin thành công gần nhất, hiển thị “Chưa cập nhật được trạng thái” và cho thử lại; không báo đó là trạng thái mới nhất, không đổi đơn thành thất bại thanh toán.
- **AC-42.5:** Given đơn PENDING_PAYMENT đang chờ đối soát, Then hiển thị đang chờ kết quả thanh toán; chỉ đổi trạng thái sau phản hồi server, không suy đoán thất bại từ timeout.

### FR-43 – API cập nhật trạng thái phục vụ

- **AC-43.1:** Given JWT staff hợp lệ, đơn ở PAID, When yêu cầu chuyển sang PREPARING, Then cập nhật thành công và lần đọc tiếp theo trả PREPARING. Kiểm tra tương tự PREPARING → READY và READY → COMPLETED.
- **AC-43.2:** Không có JWT hợp lệ trả 401; customer yêu cầu cập nhật trả 403. Trong cả hai trường hợp, trạng thái và dữ liệu đơn không đổi.
- **AC-43.3:** Yêu cầu nhảy bước PAID → READY, đi lùi READY → PREPARING hoặc chuyển từ trạng thái cuối trả 409 và không thay đổi dữ liệu.
- **AC-43.4:** API cập nhật của staff không được chuyển PENDING_PAYMENT thành PAID, không được sửa PAYMENT_FAILED/CANCELLED hoặc thay đổi kết quả thanh toán, giá và tồn kho. Các chuyển trạng thái thanh toán thuộc D-05.
- **AC-43.5:** Mỗi yêu cầu kèm trạng thái hiện tại mà staff đã đọc. Given hai yêu cầu cùng dựa trên PAID đến đồng thời, Then chỉ một yêu cầu chuyển thành PREPARING thành công; yêu cầu còn lại trả 409 vì trạng thái đã thay đổi. Không tự chuyển tiếp sang READY.
- **AC-43.6:** Thiếu trạng thái đích, trạng thái không thuộc danh sách hoặc mã đơn sai định dạng trả 400; đơn không tồn tại trả 404. Khi ghi dữ liệu thất bại, không thông báo cập nhật thành công.
- **AC-43.7:** API có thể được kiểm chứng qua Swagger nếu chưa làm FR-44; việc thiếu giao diện staff không thay đổi mức Must của FR-43.

### FR-44 – Giao diện staff

- **AC-44.1:** Staff xem được các đơn PAID, PREPARING, READY cùng mã đơn và thông tin món/size/topping/số lượng cần phục vụ.
- **AC-44.2:** Mỗi đơn chỉ có hành động cho bước hợp lệ tiếp theo: “Bắt đầu pha”, “Sẵn sàng nhận” hoặc “Hoàn tất”. Không có thao tác đánh dấu đã thanh toán hay hủy đơn sau thanh toán.
- **AC-44.3:** Khi gửi cập nhật, nút thao tác bị vô hiệu hóa đến khi nhận kết quả; thành công thì hiển thị trạng thái server trả về.
- **AC-44.4:** Khi nhận 409 do dữ liệu đã cũ, UI thông báo đơn đã thay đổi và tải lại; không tự gửi tiếp chuyển trạng thái. Lỗi mạng hiển thị khả năng thử lại, không báo thành công giả.

## 3. Yêu cầu phi chức năng

| Mã | Nhóm | Yêu cầu | MoSCoW |
|---|---|---|---|
| NFR-HIS-01 | Hiệu năng API | API lịch sử và chi tiết đơn có p95 ≤ 500 ms; API cập nhật trạng thái phục vụ có p95 ≤ 500 ms trong điều kiện đo bên dưới. | Should |
| NFR-HIS-02 | Hiệu năng hiển thị | Với trang theo dõi đang hiển thị và mạng hoạt động bình thường, thay đổi trạng thái đã lưu ở server xuất hiện trên UI trong tối đa 7 giây. | Should |
| NFR-HIS-03 | Dễ sử dụng trên điện thoại | Lịch sử, chi tiết và theo dõi đơn đọc và thao tác được ở màn hình nhỏ; nhãn trạng thái bằng tiếng Việt, không chỉ phân biệt bằng màu. | Must |
| NFR-HIS-04 | Phản hồi và phục hồi thao tác | UI phân biệt loading, empty, error; thông báo lỗi có cách xử lý; không làm người dùng hiểu nhầm kết quả hoặc gửi lặp thao tác cập nhật. | Must |

### NFR-HIS-01 – Điều kiện đo và tiêu chí chấp nhận

- **AC-HIS-01.1:** Đo API trên local với web/API/PostgreSQL cùng bộ cấu hình kiểm thử; không dùng mock database. Dataset có 100 khách hàng và 1.000 đơn, trong đó một khách có 100 đơn để kiểm tra phân trang; mỗi đơn có 1–5 dòng món.
- **AC-HIS-01.2:** Với từng API đọc, làm nóng 10 giây, sau đó đo 60 giây với 20 kết nối đồng thời và JWT hợp lệ. Lịch sử dùng trang 20 đơn; chi tiết dùng các mã đơn có thật và đúng chủ sở hữu. p95 của mỗi API ≤ 500 ms; không có phản hồi 5xx hoặc timeout trong lượt đo.
- **AC-HIS-01.3:** Đo riêng API cập nhật trạng thái trong 60 giây với 5 kết nối đồng thời và JWT staff hợp lệ. Chuẩn bị đủ đơn PAID riêng biệt trước lượt đo; mỗi đơn chỉ được chuyển một lần sang PREPARING, không tạo xung đột chủ ý. p95 ≤ 500 ms; mọi yêu cầu hợp lệ thành công, không có 5xx/timeout.
- **AC-HIS-01.4:** Thời gian đo là từ lúc công cụ gửi request đến khi nhận đủ response; không gồm thời gian dựng dataset/làm nóng. Báo cáo kiểm thử sau này phải ghi CPU, RAM, phiên bản phần mềm, commit, công cụ/cấu hình tải, số request, mã phản hồi và p95; không loại yêu cầu lỗi khỏi báo cáo để làm đẹp kết quả.

### NFR-HIS-02 – Độ trễ hiển thị trạng thái

- **AC-HIS-02.1:** Dùng trang theo dõi đang hiển thị, không ở tab nền; API phản hồi trong 500 ms, không giả lập mất mạng. Đo từ lúc cập nhật trạng thái commit thành công đến lúc nhãn mới xuất hiện trên UI.
- **AC-HIS-02.2:** Thực hiện 10 lần chuyển trạng thái hợp lệ trên các đơn thử, phân bố ở các thời điểm khác nhau trong chu kỳ polling. Cả 10 lần có độ trễ ≤ 7 giây; nhãn hiển thị khớp trạng thái server.
- **AC-HIS-02.3:** Khi mạng/API lỗi, áp dụng AC-42.4 thay vì khẳng định đạt ngưỡng cập nhật hoặc hiển thị trạng thái tự suy đoán.

### NFR-HIS-03 – Giao diện dễ sử dụng

- **AC-HIS-03.1:** Kiểm tra lịch sử, chi tiết và theo dõi đơn ở viewport rộng 360 px và 390 px, mức thu phóng mặc định. Không cần cuộn ngang để đọc thông tin hoặc thao tác; tên món dài xuống dòng, không che số lượng, giá hay nút.
- **AC-HIS-03.2:** Vùng bấm của hành động chính (mở đơn, chuyển trang, làm mới/thử lại và chuyển trạng thái nếu có UI staff) ít nhất 44 × 44 CSS px.
- **AC-HIS-03.3:** Mọi trạng thái ở mục 4 đều có nhãn tiếng Việt hiển thị bằng chữ; người dùng vẫn phân biệt được trạng thái khi không dựa vào màu sắc.
- **AC-HIS-03.4:** Từ danh sách lịch sử, chọn một đơn mở đúng chi tiết bằng một thao tác; có điều hướng quay lại lịch sử. Tổng tiền có đơn vị VND/đ và thời gian có ngày, tháng, năm, giờ, phút theo múi giờ Asia/Ho_Chi_Minh.

### NFR-HIS-04 – Phản hồi khi tải và khi lỗi

- **AC-HIS-04.1:** Với API cố tình trì hoãn 2 giây, UI hiện trạng thái đang tải; với danh sách rỗng hiện thông báo chưa có đơn; với lỗi API hiện thông báo lỗi và nút thử lại. Ba trường hợp không dùng chung thông báo “không có đơn”.
- **AC-HIS-04.2:** Khi thử lại sau lỗi mạng, UI lấy lại dữ liệu từ server và bỏ cảnh báo lỗi khi thành công. Thử lại thao tác đọc không tạo đơn, thanh toán hoặc chuyển trạng thái.
- **AC-HIS-04.3:** Khi phiên hết hạn, UI thông báo cần đăng nhập và không tiếp tục hiển thị dữ liệu đơn được bảo vệ; không đưa stack trace hoặc HTML lỗi thô lên màn hình.
- **AC-HIS-04.4:** Nếu triển khai giao diện staff, khi gửi cập nhật chỉ có một yêu cầu đang xử lý cho một thao tác; thông báo thành công chỉ xuất hiện sau API thành công. Lỗi 403, 404, 409 được hiển thị lần lượt là không có quyền, không tìm thấy đơn, và trạng thái đã thay đổi/không hợp lệ.

## 4. Quy tắc trạng thái dùng chung

| Trạng thái đơn | Nhãn hiển thị | Chuyển tiếp | Thành phần chịu trách nhiệm |
|---|---|---|---|
| PENDING_PAYMENT | Chờ thanh toán | PAID, PAYMENT_FAILED hoặc CANCELLED theo điều kiện D-05 | Đặt đơn/thanh toán, đối soát hoặc xử lý quá hạn |
| PAID | Đã thanh toán | PREPARING | Staff |
| PREPARING | Đang pha chế | READY | Staff |
| READY | Sẵn sàng nhận | COMPLETED | Staff |
| COMPLETED | Hoàn tất | Không có | Trạng thái cuối |
| PAYMENT_FAILED | Thanh toán thất bại | Không có; muốn thử lại phải tạo đơn mới theo D-05 | Trạng thái cuối |
| CANCELLED | Đã hủy | Không có | Trạng thái cuối do xử lý quá hạn theo D-05 |

Các trạng thái thanh toán PENDING, SUCCESS, FAILED là trạng thái của Payment theo D-05, không thay thế trạng thái Order. Nếu giao dịch còn PENDING thì UI bổ sung thông báo “Đang chờ kết quả thanh toán”; staff không tự xác nhận kết quả.

Luồng hủy quá hạn và điều kiện đối soát tuân theo FR-36/FR-37 của D-05; D-06 không bổ sung thao tác khách/staff hủy đơn.

## 5. Điểm đối chiếu khi hợp nhất

- TV2 chốt mã FR/NFR toàn hệ thống tại D-08; giữ ánh xạ mã cũ khi đổi mã.
- Endpoint/mẫu dữ liệu API cập nhật trạng thái sẽ được ghi trong hợp đồng Swagger khi triển khai; phải đáp ứng FR-43. Quy tắc nghiệp vụ không phụ thuộc tên endpoint.
- Các tiêu chí trên là đầu vào cho test ở task triển khai; không tạo ADR kiểm thử, ma trận truy vết hay mã ứng dụng trong D-06.

## 6. Lịch sử thay đổi

| Phiên bản | Ngày | Tác giả | Nội dung / Lý do |
|---|---|---|---|
| 0.1 | 2026-11-14 | Nguyễn Cao Tòng Nhân | Bổ sung SRS D-06 cho lịch sử/trạng thái đơn, hiệu năng và tính dễ sử dụng; cung cấp mã, MoSCoW và tiêu chí chấp nhận để hợp nhất SRS. |

