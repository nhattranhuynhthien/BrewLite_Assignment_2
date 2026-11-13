# SRS rút gọn – Nhóm Đặt đơn và Thanh toán

| Mục | Nội dung |
|---|---|
| Task | 1.2 – Yêu cầu chức năng và phi chức năng (issue D-05) |
| Phiên bản | 0.1 (bản nháp) |
| Tác giả | TV4 |
| Phạm vi | Tạo đơn, tính tổng tiền, trừ tồn kho trong transaction, thanh toán Ví/Thẻ mô phỏng, idempotency, xử lý thành công/thất bại/timeout, hủy đơn quá hạn, màn hình xác nhận đơn, khuyến mãi/tích điểm (Could) |
| Hợp nhất | Chi tiết yêu cầu thành phần; mã chính thức theo [SRS tổng quát](./srs.md) |
| Tài liệu liên quan | `context-and-scope.md`, `srs-menu-product.md`, đặc tả UC-01, `docs/diagrams/sequence-checkout.puml`, ADR-004, ADR-005, ADR-006, ADR-007 |

> Các mã FR/NFR trong tài liệu này dùng theo bộ mã chuẩn tại [SRS tổng quát](./srs.md). Đây là phần tiêu chí chi tiết cho đặt đơn/thanh toán; SRS tổng quát là nguồn chuẩn khi tra mã và phạm vi.

## 0. Phụ thuộc vào các nhóm yêu cầu khác

| Nhóm | Yêu cầu liên quan | Dùng cho |
|---|---|---|
| Menu/sản phẩm (TV3) | FR-06 (tính giá phía server), FR-07 (kiểm tra và trừ tồn kho), NFR-02 (toàn vẹn dữ liệu) | FR-31, FR-32 |
| Giỏ hàng (TV5, FR-10…19) | Giỏ hàng phía client, tổng tiền tạm tính | Dữ liệu đầu vào của FR-30 |
| Xác thực (TV2, FR-20…29) | Đăng nhập, JWT, phân quyền customer/staff | FR-30, FR-33 |
| Lịch sử/trạng thái đơn (TV6, FR-40…49) | `GET /orders/:id`, lịch sử đơn, trạng thái sau thanh toán do staff cập nhật | FR-36, FR-38 |

Trạng thái đơn thuộc nhóm này (đề xuất): `PENDING_PAYMENT` → `PAID` | `PAYMENT_FAILED` | `CANCELLED`. Các trạng thái sau khi đã thanh toán (đang pha, sẵn sàng, hoàn tất) do nhóm TV6 đặc tả.
Trạng thái thanh toán (`Payment`): `PENDING`, `SUCCESS`, `FAILED`.

## 1. Yêu cầu chức năng

| Mã | Yêu cầu | MoSCoW | API / Thành phần | Nguồn (stakeholder) |
|---|---|---|---|---|
| FR-30 | Khách hàng đã đăng nhập tạo đơn từ giỏ hàng. Hệ thống xác thực JWT, validate dữ liệu, tạo `Order` (`PENDING_PAYMENT`) và các `OrderItem`; chủ đơn lấy từ JWT, bỏ qua `userId` do client gửi. | Must | `POST /orders` | S1 |
| FR-31 | Hệ thống tính giá và tổng tiền đơn phía server (dùng FR-06) và lưu snapshot tên, giá, size, topping của từng dòng tại thời điểm đặt; giá do client gửi bị bỏ qua. | Must | `PricingService`, `OrderItem` | S1, S3 |
| FR-32 | Việc kiểm tra và trừ tồn kho diễn ra trong cùng một transaction với việc tạo đơn (dùng FR-07). Đủ hàng thì tạo đơn; không đủ thì không tạo đơn và không đổi tồn kho. | Must | `OrdersService`, `ProductsService.decreaseStock` | S1, S3 |
| FR-33 | Khách thanh toán đơn bằng Ví hoặc Thẻ mô phỏng. Chỉ đơn của chính khách và đang `PENDING_PAYMENT` mới được thanh toán; số tiền lấy từ đơn trong database. Khách có thể đổi phương thức trước khi xác nhận. | Must | `POST /payments`, `PaymentGateway.charge` | S1, S6 |
| FR-34 | Khi client gửi lại yêu cầu thanh toán với cùng `Idempotency-Key`, hệ thống không tính tiền lần hai và trả lại kết quả đã lưu; một đơn có tối đa một thanh toán thành công. | Must | `Idempotency-Key`, bảng `idempotency_keys` | S1, S6 |
| FR-35 | Hệ thống xử lý kết quả thanh toán: thành công thì đơn `PAID`; thất bại thì đơn `PAYMENT_FAILED` (trạng thái cuối) và hoàn tồn kho trong cùng transaction. Muốn thử lại, khách tạo đơn mới từ giỏ hàng. | Must | `PaymentsService`, `OrdersService.markPaymentFailed` | S1, S3 |
| FR-36 | Khi Payment Service không phản hồi (timeout), hệ thống giữ thanh toán `PENDING` và đơn `PENDING_PAYMENT`, sau đó đối soát trạng thái giao dịch theo key để hoàn tất đơn. | Should | `PaymentGateway.getStatus` | S1, S6 |
| FR-37 | Hệ thống hủy đơn `PENDING_PAYMENT` quá hạn và hoàn tồn kho; không hủy đơn đang có thanh toán `PENDING`/`SUCCESS` khi chưa đối soát. | Should | Job nền trong module `payments` | S3 |
| FR-38 | Hệ thống hiển thị kết quả cho khách: màn hình xác nhận đơn khi thanh toán thành công; thông báo lỗi rõ ràng khi hết hàng, chưa đăng nhập hoặc thanh toán thất bại; chống bấm nhiều lần. | Must | Màn hình Giỏ hàng/Thanh toán/Xác nhận (`apps/web`) | S1 |
| FR-39 | Khách áp dụng mã khuyến mãi và dùng điểm tích lũy khi đặt đơn; hệ thống tính lại tổng tiền phía server. | Could | `PromotionsService`, `LoyaltyService` | S1, S3 |

**Won't (không đánh mã):** hoàn tiền, hủy đơn sau khi đã thanh toán, đổi/trả, cổng thanh toán thật, thông báo đẩy (khớp mục out-of-scope của `context-and-scope.md`).

## 2. Yêu cầu phi chức năng

| Mã | Nhóm | Yêu cầu | MoSCoW |
|---|---|---|---|
| NFR-02 | Toàn vẹn dữ liệu và đồng thời | Tồn kho không bao giờ âm; mỗi đơn có tối đa một thanh toán `SUCCESS`; hai yêu cầu đồng thời không làm sai tồn kho hoặc tính tiền hai lần; tạo đơn và trừ kho là all-or-nothing. | Must |
| NFR-03 | Bảo mật | `POST /orders` và `POST /payments` yêu cầu JWT hợp lệ; chỉ chủ đơn được thanh toán đơn của mình; không lưu hoặc ghi log số thẻ, mật khẩu, JWT; hệ thống chỉ tin giá và số tiền do server tính. | Must |
| NFR-04 | Khả năng phục hồi | Lỗi giữa chừng hoặc timeout của Payment Service không làm mất, trùng hoặc lệch tiền, tồn kho; trạng thái cuối của đơn xác định được bằng đối soát. | Must |
| NFR-01 | Hiệu năng | `POST /orders` có p95 ≤ 500 ms với bộ dữ liệu seed, đo ở local bằng công cụ tải (không tính độ trễ giả lập của gateway). Ngưỡng đề xuất, nhóm xác nhận. | Should |
| NFR-05 | Khả dụng (UI) | Màn hình giỏ hàng, thanh toán, xác nhận có trạng thái loading/error; nút gửi bị vô hiệu hóa khi đang xử lý; thông báo lỗi nêu được nguyên nhân (hết hàng, thanh toán thất bại, hết phiên). | Should |
| NFR-06 | Khả năng tích hợp | Hợp đồng `POST /orders`, `POST /payments` (request, response, mã lỗi 400/401/402/403/409/422/202) được công bố trong Swagger/OpenAPI và khớp với code. | Must |
| NFR-07 | Khả năng kiểm thử | Có unit test cho tính tổng, chuyển trạng thái, idempotency; integration test cho tạo đơn và thanh toán trên PostgreSQL thật, gồm các kịch bản: thành công, hết hàng, thanh toán thất bại, gửi lại cùng key, đồng thời, timeout. | Must |

## 3. Tiêu chí chấp nhận

### FR-30 – Tạo đơn
- **AC-30.1** Given khách đã đăng nhập, giỏ có 2 dòng hợp lệ và đủ hàng, When gọi `POST /orders` (Bearer JWT, items), Then trả HTTP 201 với `orderId`, `status = PENDING_PAYMENT`, `totalAmount`, danh sách dòng; database có đúng 1 `Order` và 2 `OrderItem`.
- **AC-30.2** Given thiếu, sai chữ ký hoặc hết hạn JWT, When gọi `POST /orders`, Then trả HTTP 401, không tạo đơn và tồn kho không đổi.
- **AC-30.3** Given `items` rỗng, hoặc `quantity ≤ 0`, hoặc size/topping không thuộc sản phẩm, When gọi `POST /orders`, Then trả HTTP 400/422 và không tạo đơn.
- **AC-30.4** Given client gửi kèm `userId` của người khác, When tạo đơn, Then `Order.userId` bằng `sub` trong JWT.

### FR-31 – Tính giá và snapshot
- **AC-31.1** Given dòng 1: giá cơ bản 40.000, size M +5.000, topping +7.000 và +5.000, số lượng 2; dòng 2: giá 30.000, size S +0, số lượng 1, When tạo đơn, Then dòng 1 = 114.000, dòng 2 = 30.000 và `totalAmount` = 144.000.
- **AC-31.2** Given client gửi `unitPrice` hoặc `totalAmount` khác giá thật, When tạo đơn, Then server dùng giá tính từ database và bỏ qua giá client gửi.
- **AC-31.3** Given giá sản phẩm bị đổi sau khi đặt, When đọc lại đơn, Then `OrderItem` vẫn có tên và giá tại thời điểm đặt.
- **AC-31.4** Mọi giá và tổng tiền là số nguyên VND.

### FR-32 – Trừ tồn kho trong transaction
- **AC-32.1** Given sản phẩm A tồn kho = 5, When đặt số lượng 2, Then đơn được tạo và tồn kho A = 3.
- **AC-32.2** Given sản phẩm A tồn kho = 1, When đặt số lượng 2, Then trả HTTP 409 mã `OUT_OF_STOCK` kèm sản phẩm không đủ hàng, không có `Order` mới và tồn kho không đổi.
- **AC-32.3** Given đơn gồm A (đủ hàng) và B (hết hàng), When tạo đơn, Then toàn bộ đơn bị rollback, tồn kho A không đổi.
- **AC-32.4** Given tồn kho = 1, When hai yêu cầu đồng thời cùng mua 1, Then đúng một yêu cầu thành công (201), yêu cầu còn lại nhận 409; tồn kho = 0, không âm.
- **AC-32.5** Given lỗi xảy ra khi ghi `OrderItem` (giả lập trong test), When tạo đơn, Then transaction rollback và tồn kho không đổi.

### FR-33 – Thanh toán Ví/Thẻ mô phỏng
- **AC-33.1** Given đơn `PENDING_PAYMENT` của khách, `method` là `WALLET` hoặc `CARD`, `Idempotency-Key` hợp lệ, gateway trả SUCCESS, When gọi `POST /payments`, Then trả HTTP 200, `Payment = SUCCESS`, `Order = PAID`.
- **AC-33.2** Given `orderId` thuộc người dùng khác, When gọi `POST /payments`, Then trả HTTP 403 và không gọi gateway.
- **AC-33.3** Given đơn không ở `PENDING_PAYMENT` (đã `PAID`, `PAYMENT_FAILED` hoặc `CANCELLED`), When gọi `POST /payments`, Then trả HTTP 409 và không gọi gateway.
- **AC-33.4** Given thiếu hoặc hết hạn JWT, When gọi `POST /payments`, Then trả HTTP 401.
- **AC-33.5** Số tiền gửi sang gateway bằng `totalAmount` của đơn trong database; mọi `amount` do client gửi bị bỏ qua.
- **AC-33.6** Given `method` không hợp lệ hoặc thiếu `Idempotency-Key`, When gọi `POST /payments`, Then trả HTTP 400.
- **AC-33.7** Given khách đang ở màn hình thanh toán, When đổi phương thức trước khi bấm xác nhận, Then chưa có `Payment` nào được tạo.

### FR-34 – Idempotency
- **AC-34.1** Given cùng `Idempotency-Key` và cùng nội dung, When gửi hai lần liên tiếp, Then lần hai trả lại đúng response của lần một; gateway chỉ được gọi 1 lần và chỉ có 1 `Payment`.
- **AC-34.2** Given hai yêu cầu đồng thời cùng key, When xử lý, Then gateway chỉ được gọi 1 lần; yêu cầu còn lại nhận 409 (đang xử lý) hoặc kết quả đã lưu.
- **AC-34.3** Given cùng key nhưng khác `orderId` hoặc `method`, When gửi, Then trả HTTP 422 và không gọi gateway.
- **AC-34.4** Given hai người dùng khác nhau gửi cùng chuỗi key, When xử lý, Then hai yêu cầu độc lập, không xung đột.
- **AC-34.5** Given đơn đã `PAID`, When gửi thanh toán mới với key khác, Then trả HTTP 409; đơn không bao giờ có hơn một `Payment` `SUCCESS`.

### FR-35 – Kết quả thanh toán
- **AC-35.1** Given gateway trả SUCCESS, Then đơn `PAID`, payment `SUCCESS`, tồn kho giữ nguyên (đã trừ khi tạo đơn).
- **AC-35.2** Given gateway từ chối, Then trả HTTP 402, payment `FAILED`, đơn `PAYMENT_FAILED`, tồn kho được hoàn đúng số lượng của đơn.
- **AC-35.3** Given thanh toán đã thất bại, When gửi lại cùng key, Then trả lại kết quả 402 đã lưu và tồn kho không bị hoàn lần hai.
- **AC-35.4** Given đơn `PAYMENT_FAILED`, When thanh toán lại bằng key mới, Then trả HTTP 409; khách tạo đơn mới từ giỏ hàng được bình thường.
- **AC-35.5** Cập nhật payment, đơn, tồn kho và key idempotency diễn ra trong một transaction: khi lỗi giả lập giữa chừng, không có thay đổi một phần.

### FR-36 – Timeout và đối soát
- **AC-36.1** Given kịch bản `TIMEOUT_CHARGED`, When gateway không phản hồi quá ngưỡng, Then trả HTTP 202; payment `PENDING`, đơn `PENDING_PAYMENT`.
- **AC-36.2** Given payment `PENDING`, When đối soát và `getStatus` trả SUCCESS, Then payment `SUCCESS`, đơn `PAID`, tồn kho giữ nguyên.
- **AC-36.3** Given kịch bản `TIMEOUT_NOT_CHARGED`, When đối soát trả FAILED hoặc NOT_FOUND, Then đơn `PAYMENT_FAILED` và tồn kho được hoàn đúng một lần.
- **AC-36.4** Given hai tiến trình đối soát chạy đồng thời cho cùng đơn, Then tồn kho được hoàn tối đa một lần.

### FR-37 – Hủy đơn quá hạn
- **AC-37.1** Given đơn `PENDING_PAYMENT` quá hạn (ngưỡng cấu hình, mặc định 15 phút) và không có payment `PENDING`/`SUCCESS`, When job chạy, Then đơn `CANCELLED` và tồn kho được hoàn.
- **AC-37.2** Given đơn quá hạn có payment `PENDING`, When job chạy, Then job không hủy đơn mà đối soát trước.
- **AC-37.3** Given job chạy lặp lại trên cùng đơn, Then tồn kho không bị hoàn lần hai.

### FR-38 – Xác nhận và thông báo kết quả
- **AC-38.1** Given thanh toán thành công, Then UI hiển thị mã đơn, các món (size, topping, số lượng), tổng tiền, phương thức và trạng thái "Đã thanh toán".
- **AC-38.2** Given thanh toán thất bại, Then UI báo lỗi và cho đặt lại bằng cách tạo đơn mới từ giỏ hàng còn giữ.
- **AC-38.3** Given nhận 409 `OUT_OF_STOCK`, Then UI chỉ ra món hết hàng và cho chỉnh giỏ.
- **AC-38.4** Given nhận 401, Then UI chuyển sang trang đăng nhập và giỏ hàng được giữ sau khi đăng nhập lại.
- **AC-38.5** Given yêu cầu đang xử lý, Then nút gửi bị vô hiệu hóa và hiển thị loading; bấm lại không tạo thêm yêu cầu mới.

### FR-39 – Khuyến mãi và tích điểm (Could)
- **AC-39.1** Given mã hợp lệ giảm 10.000 và đơn 144.000, When áp dụng, Then `totalAmount` = 134.000; tổng tiền không bao giờ âm.
- **AC-39.2** Given mã không tồn tại hoặc hết hạn, When áp dụng, Then trả HTTP 422 và không tạo đơn.
- **AC-39.3** Given khách dùng điểm không vượt số dư, When tạo đơn, Then điểm bị trừ trong cùng transaction; thanh toán thất bại thì điểm được hoàn.

### NFR
- **AC-ORD-01** (NFR-02) Ghi `stock_quantity = -1` trực tiếp vào database bị từ chối; chèn payment `SUCCESS` thứ hai cho cùng đơn bị từ chối bởi partial unique index; kết hợp AC-32.4 và AC-34.2.
- **AC-ORD-02** (NFR-03) Gọi `POST /orders` và `POST /payments` không có JWT trả 401; log của luồng thành công và lỗi không chứa mật khẩu, JWT, số thẻ.
- **AC-ORD-03** (NFR-04) Chạy đủ bốn kịch bản của gateway (thành công, từ chối, `TIMEOUT_CHARGED`, `TIMEOUT_NOT_CHARGED`) thì mọi đơn kết thúc ở trạng thái cuối đúng và tồn kho khớp với số đơn `PAID`.
- **AC-ORD-04** (NFR-01) Với seed chuẩn, 50 kết nối đồng thời trong 30 giây, p95 của `POST /orders` ≤ 500 ms.
- **AC-ORD-05** (NFR-05) Kiểm tra giao diện: có loading, error và nút bị vô hiệu hóa khi đang gửi (đi kèm AC-38.5).
- **AC-ORD-06** (NFR-06) Swagger mô tả `POST /orders` và `POST /payments` với schema request/response, header `Idempotency-Key`, các mã lỗi, và khớp với phản hồi thực tế.
- **AC-ORD-07** (NFR-07) Lệnh test của `apps/api` chạy được các unit test và integration test nêu trên trong CI; mỗi AC-32.x, AC-34.x, AC-35.x, AC-36.x có ít nhất một test.

## 4. Liên kết với use-case, sơ đồ và code (đầu vào cho ma trận truy vết)

| Mã yêu cầu | User story / Use-case | Sơ đồ | Code / API | Test (dự kiến) |
|---|---|---|---|---|
| FR-30 | UC-01 Đặt và thanh toán đơn hàng | Activity-01, Sequence-01, Class-01 (Order, OrderItem) | `POST /orders` | INT-T10 |
| FR-31 | UC-01 | Sequence-01, Class-01 (OrderItem) | `PricingService` | UT-T10, INT-T11 |
| FR-32 | UC-01 | Activity-01 (nhánh hết hàng), Sequence-01 (Transaction) | `OrdersService`, `ProductsService.decreaseStock` | INT-T12, INT-T13 |
| FR-33 | UC-01 | Activity-01, Sequence-01, Class-01 (Payment) | `POST /payments` | INT-T14 |
| FR-34 | UC-01 (luồng E4) | Sequence-01 (nhánh key), Class-01 (IdempotencyKey) | `idempotency_keys`, `POST /payments` | UT-T11, INT-T15 |
| FR-35 | UC-01 (luồng E3) | Activity-01 (thanh toán thất bại), Sequence-01 | `PaymentsService`, `OrdersService.markPaymentFailed` | INT-T16 |
| FR-36 | UC-01 (luồng E5) | Sequence-01 (nhánh timeout) | `PaymentGateway.getStatus` | INT-T17 |
| FR-37 | UC-01 (ghi chú job nền) | Sequence-01 (ghi chú) | Job nền `payments` | INT-T18 |
| FR-38 | UC-01 | Activity-01, Sequence-01 | Màn hình xác nhận (`apps/web`) | E2E-T01 |
| FR-39 | UC-01 (luồng A1, mở rộng) | Use-case diagram (extend), Class-01 (Promotion, LoyaltyTransaction) | `PromotionsService`, `LoyaltyService` | INT-T19 |
| NFR-02 | UC-01 | Class-01 | Migration (CHECK, partial unique index) | MIG-T10, INT-T13 |
| NFR-06 | – | – | Swagger/OpenAPI | API-T10 |

Mã test trong bảng là mã đề xuất để lập ma trận truy vết; chúng không phải mã FR/NFR. Mã UC-01 và các mã FR/NFR tuân theo [SRS tổng quát](./srs.md).

## 5. Quy ước hợp nhất

SRS tổng quát chốt mã dùng chung và kết hợp yêu cầu bảo mật, hiệu năng, API, kiểm thử và vận hành. Bảng này giữ tiêu chí chấp nhận chi tiết của nhóm đặt đơn/thanh toán; mọi thay đổi mã hoặc phạm vi sau này cần cập nhật SRS tổng quát và bảng ánh xạ NFR tại đó.

