# ADR-005: Kiến trúc frontend Next.js, PWA và quản lý trạng thái client

- **Trạng thái:** Proposed — chờ review TV5/TV6
- **Ngày:** 2026-11-14
- **Liên quan:** [SRS](../../requirements/srs.md) (FR-10–FR-19, FR-25–FR-33, NFR-04, NFR-06, NFR-09–NFR-11), [kiến trúc hệ thống](../architecture.md), ADR-001, ADR-004

## Bối cảnh

BrewLite dùng Next.js cho web mobile-first/PWA. Các yêu cầu hiện tại quy định giỏ hàng chỉ lưu phía client, phải tồn tại sau khi đóng/mở trình duyệt, không đồng bộ nhiều thiết bị; API là nguồn dữ liệu chuẩn cho giá, tồn kho, đơn hàng và thanh toán. Giao diện cần có loading/empty/error state, giữ giỏ khi chuyển sang đăng nhập, và không cache dữ liệu cá nhân hoặc API thanh toán.

SRS hiện là nguồn yêu cầu chuẩn và ghi rõ `apps/web` chưa được triển khai. Vì vậy ADR này chốt hướng thiết kế, không khẳng định thư viện hay cơ chế đã có trong mã nguồn.

## Các lựa chọn

### Trạng thái giỏ hàng
1. Lưu giỏ trong API/database và đồng bộ giữa thiết bị.
2. Chỉ giữ giỏ trong state bộ nhớ của trình duyệt.
3. **Quản lý giỏ ở client và lưu bền vững bằng LocalStorage.**

### Truy vấn dữ liệu
1. Gọi `fetch` tùy ý từ từng component.
2. **Dùng lớp API client tập trung, dựa trên `fetch` của nền tảng; chưa thêm thư viện quản lý server-state.**
3. Chọn thêm thư viện server-state/cache như SWR hoặc TanStack Query.

## Quyết định

- Dùng Next.js theo kiến trúc web/API tách biệt trong ADR-001. Tổ chức giao diện theo luồng và thành phần; các màn hình dữ liệu phải thể hiện riêng loading, empty và error state.
- Giữ giỏ hàng ở client, dùng LocalStorage để tồn tại qua lần đóng/mở trình duyệt. Giỏ phải dùng được trước và sau đăng nhập; lỗi đọc dữ liệu cũ phải được xử lý rõ ràng, không âm thầm thay bằng giỏ rỗng. Phiên bản hóa dữ liệu lưu để có thể xử lý thay đổi cấu trúc sau này.
- Đồng bộ thay đổi giỏ giữa các tab cùng origin. Không dùng chiến lược last-write-wins âm thầm nếu các tab sửa đồng thời; phát hiện và hợp nhất xung đột hoặc báo cho người dùng khôi phục/thử lại. Không đồng bộ giỏ qua API hoặc giữa thiết bị trong MVP.
- Thao tác giỏ thực hiện optimistic tại client để đáp ứng NFR-04 (<100 ms). Khi đặt đơn, API vẫn phải tính lại giá và kiểm tra tồn kho theo FR-06/FR-07 và ADR-004; dữ liệu giá/tồn kho phía client chỉ để hiển thị.
- Tập trung gọi API trong một lớp client (ví dụ `lib/api`) dùng `NEXT_PUBLIC_API_URL`, gắn JWT cho request được bảo vệ và chuẩn hóa lỗi để giao diện có thể hiển thị/thử lại phù hợp. Tiếp tục dùng `fetch`; chỉ cân nhắc thư viện server-state nếu nhu cầu cache, đồng bộ hoặc hủy request thực tế phát sinh và được review.
- Không cache response cá nhân, lịch sử/trạng thái đơn, thanh toán hoặc request có xác thực trong service worker hay cache dùng chung. PWA chỉ cache app shell, tài nguyên tĩnh và trang công khai được phép; offline không đồng nghĩa với khả năng đặt hàng/thanh toán ngoại tuyến.
- Dùng cache/revalidation của Next.js chỉ cho dữ liệu công khai khi chính sách được khai báo rõ. Request phụ thuộc người dùng hoặc dữ liệu thay đổi nhanh phải lấy dữ liệu mới, không dùng cache dùng chung giữa người dùng.
- Cơ chế lưu JWT trên trình duyệt **chưa được quyết định** trong các tài liệu hiện tại. Lớp API client phải nhận token qua ranh giới auth/session để có thể thay đổi cách lưu sau khi được review; ADR này không chọn LocalStorage hay cookie và không cho phép đưa token vào URL hoặc log.
- Giao diện mobile-first hỗ trợ viewport từ 320 px và vùng chạm chính ít nhất 48×48 CSS px theo SRS.

## Hệ quả

- (+) Giỏ hoạt động cho khách chưa đăng nhập và được giữ khi cần chuyển sang đăng nhập; không cần cart API/database.
- (+) API vẫn là nguồn chuẩn của giá, tồn kho và trạng thái đơn; dữ liệu cá nhân không bị phục vụ từ cache công khai.
- (+) Lớp API tập trung giúp thống nhất xác thực, xử lý lỗi và idempotency; chưa thêm dependency server-state khi chưa có ứng dụng triển khai.
- (–) LocalStorage chỉ thuộc một trình duyệt/thiết bị; dữ liệu có thể bị xóa và không đồng bộ tài khoản.
- (–) Cần kiểm thử tình huống dữ liệu LocalStorage lỗi/cũ và chỉnh sửa nhiều tab để không âm thầm mất thay đổi.
- (–) Quyết định lưu JWT vẫn cần được chốt trước khi triển khai luồng xác thực trên web.
- (–) Các quyết định này chưa được xác minh bằng mã nguồn vì `apps/web` hiện chưa được triển khai theo SRS.

## Điều kiện nghiệm thu quyết định

TV5/TV6 review cách lưu và đồng bộ giỏ nhiều tab, chính sách cache dữ liệu công khai/cá nhân, cũng như ranh giới lưu JWT. Chỉ chuyển sang **Accepted** khi các quyết định này nhất quán với SRS và ADR bảo mật.
