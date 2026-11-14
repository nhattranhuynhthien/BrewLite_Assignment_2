# ADR-006: Chiến lược kiểm thử unit, integration và E2E

- **Trạng thái:** Proposed — chờ TV5 review.
- **Ngày:** 2026-11-14.
- **Công việc:** D-19, Task 3 — TV6 phụ trách, TV5 review.
- **Căn cứ:** [D-13 — Kiến trúc hệ thống, phiên bản 1.2](../architecture.md), [SRS](../../requirements/srs.md), [ADR-004 — Tính nhất quán trong đặt hàng và thanh toán](004-order-payment-consistency.md). Thiết kế gateway mô phỏng được mô tả tại mục 7 và 9 của D-13.

## Bối cảnh

BrewLite gồm Next.js/PWA, NestJS modular monolith và PostgreSQL qua Prisma. Backend phân lớp Controller → Service → PrismaService/Adapter; các module phụ thuộc theo chiều `payments → orders → products`. Giỏ hàng lưu ở client, không có cart API/database. `MockPaymentGateway` chạy trong API, không phải dịch vụ triển khai riêng.

Rủi ro chính là tính sai giá, bán vượt tồn, transaction không rollback, thanh toán hoặc hoàn kho lặp, truy cập đơn trái quyền và UI hiển thị sai kết quả. Unit test với database giả không đủ chứng minh tính đúng đắn của transaction/ràng buộc PostgreSQL; chỉ kiểm thử qua trình duyệt lại chậm và khó xác định lỗi. Nhóm 6 người trong hai Sprint cần kết hợp ba mức kiểm thử, ưu tiên các quy tắc nghiệp vụ và luồng MVP.

Tại baseline `main@7bda4ff`, `apps/api`, `apps/web` và `tests` chỉ chứa `.gitkeep`. ADR này quyết định cách kiểm thử khi triển khai, không phải báo cáo các test đã chạy hoặc đạt.

## Các lựa chọn

| Lựa chọn | Đánh giá |
|---|---|
| Chủ yếu kiểm thử thủ công | Dễ bắt đầu nhưng khó lặp lại và dễ bỏ sót hồi quy, đồng thời, timeout. |
| Chỉ unit test, mock toàn bộ phụ thuộc | Chạy nhanh nhưng không xác minh được transaction, constraint, wiring NestJS hoặc luồng web–API. |
| Chủ yếu E2E | Kiểm tra được luồng người dùng nhưng tốn thời gian chạy, bảo trì và chẩn đoán. |
| Kết hợp unit, integration và E2E | Phân bổ kiểm tra theo ranh giới kiến trúc; cần thêm môi trường DB và trình duyệt nhưng phù hợp các rủi ro của BrewLite. |

## Quyết định

Chọn kết hợp ba mức theo hướng nhiều unit test cho logic độc lập, integration test cho ranh giới module/database và một bộ E2E tập trung vào luồng quan trọng. Không dùng tỷ lệ số test hoặc phần trăm coverage tùy ý làm bằng chứng thay cho kiểm tra nghiệp vụ.

### 1. Phân chia mức kiểm thử

| Mức | Công cụ lựa chọn | Phạm vi và phụ thuộc |
|---|---|---|
| Unit | Jest; React Testing Library cho component web | Kiểm tra hàm/service độc lập, logic giỏ và component. Mock PrismaService, interface PaymentGateway và HTTP khi cần; không kết nối DB/mạng thật. |
| Integration | Jest, NestJS TestingModule, Supertest, PostgreSQL thật | Khởi tạo module/API với controller, validation, guard, service và Prisma thật. Gửi HTTP để kiểm tra hợp đồng và tác động DB. Không mock transaction, unique index hoặc cập nhật tồn kho. |
| E2E | Playwright | Chạy trình duyệt với bản build Next.js, NestJS và PostgreSQL test. Dùng MockPaymentGateway của ứng dụng với kết quả điều khiển được; không mock API nghiệp vụ trong các luồng nghiệm thu. |

Unit test đặt cạnh mã nguồn với hậu tố `*.spec.ts`/`*.spec.tsx`; integration test tại `apps/api/test/integration/`; E2E tại `tests/e2e/`. Đây là vị trí triển khai dự kiến, không tạo các bộ test trong phạm vi D-19.

### 2. Nội dung kiểm thử trọng yếu

| Nhóm | Kiểm tra cần có | Mức chính |
|---|---|---|
| Giá và giỏ hàng | Giá VND nguyên; size/topping/số lượng hợp lệ; server bỏ qua giá client. Gộp đúng dòng cùng tùy chọn, cập nhật tổng, xác nhận xóa, giỏ trống và giữ giỏ sau đăng nhập/tải lại. | Unit; integration xác nhận giá server; E2E luồng giỏ |
| Tạo đơn và tồn kho | Tạo đơn, dòng đơn và trừ kho cùng transaction; gây lỗi giữa các bước phải rollback hết. Hai yêu cầu đồng thời mua món cuối: chỉ một đơn thành công, đơn còn lại nhận `409 OUT_OF_STOCK`, tồn kho không âm. | Integration với DB thật |
| Xác thực và quyền | JWT thiếu/hết hạn/không hợp lệ; chủ đơn lấy từ JWT; khách không đọc/thanh toán đơn người khác; chỉ STAFF cập nhật trạng thái. Kiểm tra cả HTTP và dữ liệu không bị thay đổi khi bị từ chối. | Integration; E2E luồng đăng nhập |
| Idempotency | Tạo key IN_PROGRESS và Payment trong cùng transaction ngắn; lỗi giữa hai bước phải rollback cả hai. Cùng key/khác nội dung trả 422 trước khi xét trạng thái key; cùng key/cùng nội dung đã COMPLETED trả nguyên response đã lưu, không gọi lại gateway; còn IN_PROGRESS trả 409. Kiểm tra yêu cầu tuần tự và đồng thời, kể cả khác key cùng đơn: tối đa một payment SUCCESS và một lần tính tiền ở gateway. | Unit phân nhánh; integration xác minh DB/gateway |
| Thanh toán và phục hồi | Ví/Thẻ thành công → PAID; từ chối → PAYMENT_FAILED và hoàn kho đúng một lần. Timeout → HTTP 202, payment PENDING, đơn PENDING_PAYMENT; đối soát cả timeout đã trừ tiền và chưa trừ tiền. Khởi động lại API rồi đối soát vẫn dùng giao dịch đã lưu. | Integration; E2E thành công/thất bại/timeout |
| Job nền và trạng thái | Hủy đơn quá hạn không đụng payment PENDING/SUCCESS khi chưa đối soát; chạy job lặp hoặc cạnh tranh với kết quả thanh toán không hoàn kho hai lần. STAFF chỉ chuyển PAID → PREPARING → READY → COMPLETED; chuyển sai hoặc cập nhật cạnh tranh trên trạng thái cũ bị từ chối. | Unit; integration đồng thời |
| Lịch sử và UI | Lịch sử/chi tiết đúng chủ, đúng snapshot; polling dừng khi ra trang/trạng thái cuối, không chồng request. Có loading/empty/error, không báo thành công khi payment đang chờ, bấm lặp không tạo thao tác thanh toán mới. | Unit/component; integration; E2E |
| Vận hành | Migration tạo đúng schema/constraint, seed chạy lặp không trùng. Readiness trả 200/503 theo DB, liveness độc lập DB; thiếu cấu hình bắt buộc thì không khởi động; log che JWT, mật khẩu và dữ liệu nhạy cảm. | Integration; smoke test |

Theo D-13 mục 9, `PAYMENT_FAILED` là trạng thái cuối: muốn thanh toán lại sau thất bại phải tạo **đơn mới và key mới**. Retry cùng key chỉ lấy lại kết quả hoặc đối soát ý định cũ, không mở lại đơn thất bại. Áp dụng yêu cầu key mới của ADR-004 cùng quy tắc này; không thanh toán lại trên đơn đã hoàn kho.

Bộ E2E tối thiểu bao gồm: xem menu → chọn size/topping → giỏ → đăng ký/đăng nhập → đặt đơn → thanh toán thành công → lịch sử/chi tiết; nhánh hết hàng; thanh toán bị từ chối; timeout rồi đối soát; theo dõi chuyển trạng thái do STAFF thực hiện. Nếu giao diện STAFF chưa thuộc phần được triển khai, bước chuẩn bị/cập nhật STAFF dùng API thật, phần theo dõi của khách vẫn kiểm tra trên trình duyệt.

### 3. Dữ liệu, môi trường và tính lặp lại

- Dùng database test riêng qua `TEST_DATABASE_URL`, cùng phiên bản PostgreSQL mục tiêu; mỗi job/worker có database hoặc schema độc lập. Không chạy reset/seed kiểm thử trên database phát triển dùng chung hoặc production.
- Khởi tạo bằng migration đã commit và fixture xác định trước: khách A/B, STAFF, sản phẩm với size/topping, hàng còn/hết và tồn kho bằng 1. Dọn dữ liệu test giữa các ca để kết quả không phụ thuộc thứ tự chạy.
- Integration/E2E dùng adapter mô phỏng thật trong API và bảng giao dịch mô phỏng; điều khiển kết quả thành công/từ chối/timeout bằng dữ liệu test. Unit dùng test double qua interface. Không gọi cổng thanh toán thật.
- Unit kiểm soát thời gian bằng fake timers cho polling, hết hạn và job. Integration kích hoạt job có kiểm soát, đồng bộ các request cạnh tranh; kiểm tra trạng thái DB sau khi mọi tác vụ kết thúc, không chỉ kiểm tra HTTP hoặc chờ một khoảng thời gian cố định.
- Với ADR-004, kiểm tra key hết hạn sau 24 giờ và job dọn dẹp; kiểm tra riêng phục hồi key IN_PROGRESS sau khi API khởi động lại để việc dọn key không làm mất giao dịch chưa đối soát. Thời gian test được điều khiển, không chờ đủ 24 giờ thực.
- Mỗi test ghi mã FR/NFR liên quan trong tên/mô tả và kiểm tra hành vi quan sát được. Việc lập khung traceability matrix thuộc D-21.

### 4. Chạy kiểm thử và điều kiện chấp nhận

- Khi triển khai CI, mỗi PR chạy install theo lockfile, lint, unit test và build web/API theo NFR-14. Integration chạy cho thay đổi API/schema/migration; E2E chạy cho thay đổi ảnh hưởng luồng web–API. Trước phát hành chạy toàn bộ các bộ kiểm thử và smoke test health/menu sau deploy.
- Các kiểm tra bắt buộc phải đạt trước merge; không bỏ qua test lỗi để tạo trạng thái CI xanh. Lưu báo cáo, commit và lỗi; E2E lỗi lưu trace/screenshot đã tránh dữ liệu nhạy cảm để tái hiện.
- Coverage dùng để phát hiện phần logic chưa được kiểm tra. Chấp nhận dựa trên các ca thành công, lỗi, biên và đồng thời của nghiệp vụ liên quan; không tuyên bố đạt yêu cầu chỉ vì coverage cao.
- Hiệu năng, responsive, PWA và tương thích trình duyệt được kiểm tra theo đúng tiêu chí/dataset trong SRS ở các task kiểm thử tương ứng; ba mức trên không thay thế đo tải hoặc đánh giá usability. Không bổ sung ngưỡng nghiệm thu mới trong ADR này.

## Hệ quả

- **Tích cực:** Unit phát hiện nhanh sai logic; integration kiểm chứng transaction/ràng buộc và quyền với hệ thống thật; E2E xác minh các thành phần phối hợp đúng từ góc nhìn khách hàng.
- **Tích cực:** Gateway mô phỏng và dữ liệu xác định giúp tái hiện timeout, retry và đối soát mà không phụ thuộc dịch vụ thanh toán bên ngoài.
- **Đánh đổi:** CI cần PostgreSQL, browser và thời gian khởi tạo dữ liệu; integration/E2E chậm hơn unit. Giới hạn E2E ở luồng quan trọng, đưa kiểm tra nhánh chi tiết xuống unit/integration.
- **Đánh đổi:** Fixture, test double và selector UI cần cập nhật khi hợp đồng thay đổi; ưu tiên kết quả nghiệp vụ và locator theo vai trò/nhãn thay vì cấu trúc nội bộ dễ đổi.
- **Giới hạn:** Gateway mô phỏng không chứng minh khả năng tích hợp cổng thật, webhook hay đối soát thực tế. Các nội dung đó nằm ngoài MVP theo D-13.
