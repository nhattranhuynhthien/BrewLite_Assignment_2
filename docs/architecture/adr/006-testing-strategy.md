# ADR-006: Chiến lược kiểm thử unit, integration và E2E

- **Trạng thái:** Accepted
- **Ngày:** 2026-11-14
- **Người quyết định:** Nhóm BrewLite
- **Liên quan:** [Kiến trúc hệ thống](../architecture.md), [SRS](../../requirements/srs.md) (NFR-13, NFR-14), [ADR-004](004-order-payment-consistency.md)

## Bối cảnh

BrewLite gồm Next.js/PWA, NestJS modular monolith và PostgreSQL qua Prisma. Backend phân lớp Controller → Service → PrismaService/Adapter; các module phụ thuộc theo chiều `payments → orders → products`. Giỏ hàng lưu ở client; `MockPaymentGateway` chạy bên trong API.

Rủi ro chính của hệ thống là tính sai giá, bán vượt tồn kho, transaction không rollback, thanh toán hoặc hoàn kho lặp, truy cập đơn trái quyền và UI hiển thị sai trạng thái. Unit test với mock không đủ chứng minh transaction và ràng buộc PostgreSQL; chỉ kiểm thử qua trình duyệt lại chậm và khó chẩn đoán. Vì vậy cần kết hợp ba mức kiểm thử theo ranh giới kiến trúc.

## Các lựa chọn

| Lựa chọn | Đánh giá |
|---|---|
| Chủ yếu kiểm thử thủ công | Dễ bắt đầu nhưng khó lặp lại và dễ bỏ sót hồi quy, đồng thời, timeout. |
| Chỉ unit test, mock toàn bộ phụ thuộc | Chạy nhanh nhưng không xác minh được transaction, constraint, wiring NestJS hoặc luồng web–API. |
| Chủ yếu E2E | Kiểm tra được luồng người dùng nhưng tốn thời gian chạy, bảo trì và chẩn đoán. |
| **Kết hợp unit, integration và E2E** | Phân bổ kiểm tra theo ranh giới kiến trúc; phù hợp các rủi ro về dữ liệu và luồng nghiệp vụ của BrewLite. |

## Quyết định

Chọn kết hợp ba mức kiểm thử: nhiều unit test cho logic độc lập, integration test với PostgreSQL thật cho ranh giới module/database và một bộ E2E tập trung vào luồng người dùng trọng tâm.

### 1. Phân chia mức kiểm thử

| Mức | Công cụ | Phạm vi và phụ thuộc |
|---|---|---|
| Unit | Jest; React Testing Library | Kiểm tra hàm/service độc lập, logic giỏ hàng và component web. Mock `PrismaService`, `PaymentGateway` và HTTP khi cần; không kết nối DB/mạng thật. Đặt cạnh mã nguồn (`*.spec.ts`/`*.spec.tsx`). |
| Integration | Jest, NestJS TestingModule, Supertest, PostgreSQL thật | Khởi tạo module/API với controller, validation, guard, service và Prisma thật (`apps/api/test/integration/`). Không mock transaction, unique index hoặc cập nhật tồn kho. |
| E2E | Playwright | Chạy trình duyệt với Next.js, NestJS và PostgreSQL test (`tests/e2e/`). Dùng `MockPaymentGateway` với kết quả điều khiển được; không mock API nghiệp vụ. |

### 2. Nội dung kiểm thử trọng yếu

| Nhóm | Kiểm tra cần có | Mức chính |
|---|---|---|
| Giá và giỏ hàng | Giá VND nguyên; size/topping/số lượng hợp lệ; server bỏ qua giá client; gộp dòng cùng tùy chọn, cập nhật tổng, xác nhận xóa, giỏ trống và giữ giỏ sau đăng nhập/tải lại. | Unit; integration; E2E |
| Tạo đơn và tồn kho | Tạo đơn, dòng đơn và trừ kho cùng transaction; lỗi giữa chừng phải rollback. Hai yêu cầu đồng thời mua món cuối: chỉ một đơn thành công, đơn còn lại nhận `409 OUT_OF_STOCK`, tồn kho không âm. | Integration với DB thật |
| Xác thực và quyền | JWT thiếu/hết hạn/không hợp lệ; chủ đơn lấy từ JWT; khách không đọc/thanh toán đơn người khác; chỉ `STAFF` cập nhật trạng thái. | Integration; E2E |
| Idempotency | Cùng key/khác nội dung trả `422`; cùng key/cùng nội dung đã `COMPLETED` trả nguyên response đã lưu, không gọi lại gateway; đang `IN_PROGRESS` trả `409`. Tối đa một payment `SUCCESS` cho mỗi đơn. | Unit; integration |
| Thanh toán và phục hồi | Thành công → `PAID`; thất bại → `PAYMENT_FAILED` (trạng thái cuối, muốn thử lại phải tạo đơn mới kèm key mới) và hoàn kho đúng một lần. Timeout → HTTP `202`, payment `PENDING`, đơn `PENDING_PAYMENT` rồi đối soát. | Integration; E2E |
| Job nền và trạng thái | Hủy đơn quá hạn không hủy đơn có payment `PENDING`/`SUCCESS` chưa đối soát; không hoàn kho hai lần. `STAFF` chỉ chuyển `PAID → PREPARING → READY → COMPLETED`; chuyển sai trả lỗi. | Unit; integration |
| Lịch sử và UI | Lịch sử/chi tiết đúng chủ, đúng snapshot; polling 5 giây dừng ở trạng thái cuối/rời trang; hiển thị đủ `loading`/`empty`/`error`, ngăn bấm lặp. | Unit/component; integration; E2E |
| Vận hành | Migration và seed idempotent; `GET /health` trả `200`/`503` theo DB; log che mật khẩu, JWT và secret. | Integration; smoke test |

### 3. Dữ liệu, môi trường và CI

- Dùng database test riêng qua `TEST_DATABASE_URL`, khởi tạo bằng migration đã commit và dữ liệu test xác định trước; dọn dữ liệu giữa các ca test.
- Mỗi pull request trên CI chạy `Install → Lint → Unit Test → Build` cho `apps/web` và `apps/api` (NFR-14), kèm integration/E2E cho các luồng liên quan; không merge khi kiểm tra bắt buộc thất bại.
- Mỗi test gắn với mã FR/NFR tương ứng để đối chiếu trong [Ma trận truy vết](../../traceability-matrix.md).

## Hệ quả

- (+) Unit phát hiện nhanh sai logic; integration kiểm chứng transaction, ràng buộc DB và phân quyền; E2E xác minh luồng tích hợp đầu-cuối.
- (+) `MockPaymentGateway` giúp tái hiện định sẵn các kịch bản thành công, thất bại, timeout và retry trên CI.
- (–) CI cần thêm PostgreSQL service và trình duyệt cho integration/E2E; khắc phục bằng cách giữ bộ E2E gọn vào các luồng cốt lõi.
