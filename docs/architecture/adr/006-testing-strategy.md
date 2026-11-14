# ADR-006: Chiến lược kiểm thử và truy vết yêu cầu

- **Trạng thái:** Proposed — chờ review TV6/TV5
- **Ngày:** 2026-11-14
- **Liên quan:** [SRS](../../requirements/srs.md) (NFR-13, NFR-14 và các FR/NFR khác), [ma trận truy vết](../../traceability-matrix.md), [quy ước đóng góp](../../../CONTRIBUTING.md), ADR-001

## Bối cảnh

BrewLite có yêu cầu xuyên suốt web, API, PostgreSQL, thanh toán mô phỏng và CI. SRS đã định nghĩa mã FR-01–FR-39, NFR-01–NFR-20 và tiêu chí nghiệm thu; Definition of Done yêu cầu kiểm thử nghiệp vụ mới và cập nhật dòng truy vết.

Tại thời điểm viết ADR, SRS ghi `apps/web`, `apps/api` và `tests` chưa được triển khai; README cũng ghi công cụ/lệnh lint, test, build và CI chưa được cấu hình. Do đó quyết định này là chiến lược mục tiêu, không phải báo cáo test đã chạy hay công cụ đã được cài đặt.

## Các lựa chọn

1. Chỉ kiểm thử thủ công trước khi bàn giao.
2. Chỉ dùng unit test cho các hàm riêng lẻ.
3. **Phân tầng kiểm thử và truy vết từng yêu cầu đến thiết kế, mã nguồn, kiểm thử và bằng chứng.**

## Quyết định

### Phân tầng kiểm thử

- **Unit:** kiểm tra các quy tắc thuần và các nhánh nghiệp vụ nhỏ độc lập, như tính giá, tính tổng giỏ, validate chuyển trạng thái và xử lý idempotency. Test phải tập trung vào hành vi và biên nghiệp vụ.
- **Component/UI:** kiểm tra tương tác quan trọng và các trạng thái loading/empty/error, giỏ hàng, điều hướng, xác nhận thao tác và thông báo lỗi. Kiểm tra responsive/PWA theo tiêu chí SRS.
- **Integration:** kiểm tra các service/API với PostgreSQL thật hoặc môi trường test tương đương, gồm migration, ràng buộc DB, transaction rollback, quyền sở hữu, tồn kho đồng thời và cập nhật thanh toán. Gateway ngoài được thay bằng gateway mô phỏng xác định được kịch bản.
- **End-to-end:** xác minh các luồng đại diện từ giao diện qua API đến database, gồm đăng nhập, đặt hàng, thanh toán thành công/thất bại/timeout, xem lịch sử và các thao tác STAFF. Không dùng E2E để lặp lại mọi tổ hợp đã được kiểm tra ở tầng thấp hơn.
- **Hợp đồng:** đối chiếu request/response API với hợp đồng OpenAPI theo NFR-12.
- **Phi chức năng:** đo riêng theo ngưỡng và dataset quy định trong SRS; báo cáo phải ghi commit, cấu hình môi trường, tải/dataset, phương pháp đo và kết quả. Kiểm tra trình duyệt, viewport, thời gian phản hồi, độ trễ polling và Lighthouse không thay bằng một assertion unit test.

### Quy tắc chạy và chất lượng

- Khi đã cấu hình dự án, PR phải chạy lint, unit test và build cho các ứng dụng bị ảnh hưởng; integration/E2E chạy ở job phù hợp với dependency như PostgreSQL. Không merge nếu required check thất bại, theo NFR-14 và Definition of Done.
- Test phải độc lập, có dữ liệu cô lập/dọn dẹp xác định; không gọi cổng thanh toán thật hoặc dùng secret production.
- Mỗi test được đặt tên theo hành vi cần bảo vệ và được liên kết với một hoặc nhiều mã FR/NFR trong [traceability matrix](../../traceability-matrix.md). Một yêu cầu có thể cần nhiều test ở các tầng khác nhau.
- Ma trận dùng mã yêu cầu chuẩn từ SRS; không tự tạo hoặc tái sử dụng FR/NFR. Mã test dùng các tiền tố `TC-UNIT`, `TC-UI`, `TC-API`, `TC-E2E`, `TC-CONTRACT` và `TC-NFR`, tiếp theo là nhóm ngắn và số thứ tự (ví dụ `TC-API-ORDER-001`).
- Bằng chứng nghiệm thu phải trỏ đến đường dẫn test hoặc báo cáo, commit/PR và kết quả CI/đo kiểm. Chỉ ghi **Đã xác minh** khi có bằng chứng tái lập và tiêu chí liên quan đạt.
- Chưa chọn test runner, browser automation hay coverage threshold vì repository hiện chưa cấu hình các công cụ đó. Chọn công cụ trong task triển khai test, ưu tiên tương thích với package manager/framework đã được chốt và cập nhật ADR nếu thay đổi chiến lược.

## Hệ quả

- (+) Có thể truy từ yêu cầu đến test và bằng chứng, giảm nguy cơ bỏ sót phạm vi.
- (+) Test tích hợp xác minh các ràng buộc quan trọng của PostgreSQL; test UI/E2E bao phủ hành vi người dùng mà unit test không thể chứng minh.
- (+) Kiểm thử hiệu năng và tương thích dựa trên tiêu chí đo đã nêu trong SRS.
- (–) Cần duy trì ma trận khi thay đổi yêu cầu, thiết kế, mã nguồn hoặc test.
- (–) PostgreSQL và kiểm thử trình duyệt làm một số job CI tốn thời gian/tài nguyên hơn; cần phân tầng job và tránh chạy lại test đắt tiền không cần thiết.
- (–) Chưa có toolchain/test pipeline trong checkout hiện tại; chiến lược chỉ được xem là triển khai khi có cấu hình và bằng chứng tương ứng.

## Điều kiện nghiệm thu quyết định

TV6/TV5 review các tầng test, mã test và quy tắc bằng chứng. Trước khi chuyển sang **Accepted**, cần xác nhận CI có lint, unit test và build bắt buộc theo NFR-14; các test integration/E2E và kiểm tra NFR được lập kế hoạch theo rủi ro, không tuyên bố đạt nếu chưa chạy.
