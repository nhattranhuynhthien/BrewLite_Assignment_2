# BrewLite – Bối cảnh, stakeholder và phạm vi

| Mục | Nội dung |
|---|---|
| Task | 1.1 – Bối cảnh, stakeholder và phạm vi (issue I-03 / D-01) |
| Phiên bản | 0.1 (bản nháp để review) |
| Tác giả | Đỗ Hoàng Vinh (TV3) |
| Reviewer | TV4 (theo vòng review chéo); TV1 bổ sung phần rủi ro/ràng buộc kỹ thuật |
| Tài liệu liên quan | `srs-menu-product.md`, `docs/diagrams/class-domain.puml` |

## 1. Bối cảnh và vấn đề nghiệp vụ

BrewLite là hệ thống đặt đồ uống mobile-first cho một cửa hàng đồ uống (cà phê, trà, trà sữa) có nhiều tùy chọn như size và topping. Hệ thống số hóa chuỗi thao tác từ lúc khách xem menu đến lúc nhận đồ uống.

Các vấn đề BrewLite cần giải quyết với mô hình đặt tại quầy truyền thống:

1. **Xếp hàng và chờ đợi**: khách phải đứng chờ gọi món và thanh toán, nhất là giờ cao điểm.
2. **Sai sót khi ghi đơn**: tùy chọn size, topping, số lượng được truyền miệng nên dễ nhầm.
3. **Thông tin menu không đồng bộ**: món hết hàng chỉ biết khi đã gọi; giá và topping thay đổi không được cập nhật ngay.
4. **Thanh toán rời rạc**: tiền mặt/chuyển khoản thủ công, khó đối soát.
5. **Khách không theo dõi được đơn**: không biết đơn đang được pha hay đã xong.

**Luồng nghiệp vụ tối thiểu** (theo đề Assignment 2):

```
Xem menu → Chọn tùy chọn → Giỏ hàng → Đặt đơn → Thanh toán → Theo dõi đơn
```

## 2. Stakeholder

| # | Stakeholder | Vai trò trong hệ thống | Mục tiêu | Kỳ vọng với BrewLite | Ảnh hưởng / Quan tâm |
|---|---|---|---|---|---|
| S1 | Khách hàng | Người dùng cuối, đặt và thanh toán đơn trên điện thoại | Đặt đồ uống nhanh, đúng ý, không phải xếp hàng | Menu rõ ràng, giá chính xác; biết món nào hết hàng; thanh toán dễ; theo dõi được trạng thái đơn; xem lại lịch sử | Cao / Cao |
| S2 | Nhân viên quầy | Nhận đơn, pha chế, cập nhật trạng thái đơn | Xử lý đơn đúng và nhanh | Đơn hiển thị đủ size/topping; đổi được trạng thái đơn; ít phải nhập tay | Trung bình / Cao |
| S3 | Quản lý cửa hàng | Theo dõi vận hành, menu, tồn kho, khuyến mãi | Tăng doanh thu, giảm sai sót, kiểm soát tồn kho | Dữ liệu menu/giá/tồn kho đáng tin; khuyến mãi và tích điểm (mức mở rộng) | Cao / Trung bình |
| S4 | Giảng viên / khách hàng nghiệm thu | Đánh giá sản phẩm và quy trình | Xác nhận nhóm hoàn thành đủ tạo phẩm và sản phẩm chạy được | Tài liệu, sơ đồ, mã nguồn, CI/CD, URL production, truy vết yêu cầu nhất quán | Cao / Cao |
| S5 | Nhóm phát triển (6 thành viên) | Thiết kế, xây dựng, kiểm thử, triển khai | Giao đúng hạn, phân công cân bằng, vận hành được | Yêu cầu rõ và ổn định; kiến trúc chốt trước khi viết code; công cụ CI/CD ổn định | Cao / Cao |
| S6 | Đơn vị thanh toán (mô phỏng) | Dịch vụ xử lý thanh toán Ví/Thẻ | Nhận yêu cầu thanh toán, trả về thành công/thất bại | Hợp đồng API rõ; xử lý an toàn khi client gửi lại (idempotency). Trong MVP đây là dịch vụ **mô phỏng** do nhóm tự xây | Thấp / Trung bình |

## 3. Phạm vi

### 3.1. In-scope (MVP – bắt buộc)

| Nhóm | Nội dung | Ưu tiên |
|---|---|---|
| Menu & sản phẩm | Xem danh sách menu, xem chi tiết sản phẩm, size, topping, giá phụ thu, trạng thái hết hàng | Must |
| Giỏ hàng | Thêm/sửa/xóa món, tính tổng tiền | Must |
| Xác thực | Đăng ký, đăng nhập, JWT, phân quyền customer/staff | Must |
| Đặt đơn | Tạo đơn trong transaction, kiểm tra và trừ tồn kho, tính giá phía server | Must |
| Thanh toán | Thanh toán Ví/Thẻ mô phỏng, idempotency khi gửi lại | Must |
| Theo dõi đơn | Xác nhận đơn, trạng thái đơn, lịch sử đơn | Must |
| Quản lý trạng thái đơn | Staff cập nhật trạng thái (có thể demo qua Swagger nếu không kịp UI) | Must (API) / Should (UI) |
| Dữ liệu | Migration và seed tái tạo được database | Must |
| Kỹ thuật | Next.js mobile-first, NestJS, PostgreSQL, Docker, CI/CD, health check, deploy HTTPS | Must |

### 3.2. Phạm vi mở rộng (làm nếu còn thời gian)

| Nội dung | Ưu tiên | Ghi chú |
|---|---|---|
| PWA: manifest, service worker, cài lên màn hình | Should | |
| Màn hình staff cập nhật trạng thái đơn | Should | Nếu bỏ, demo bằng Swagger |
| Lọc menu theo danh mục | Should | |
| Tìm kiếm sản phẩm theo tên | Could | |
| Promotion (mã giảm giá) và LoyaltyTransaction (tích điểm) | Could | Việc đầu tiên bị cắt nếu thiếu thời gian; vẫn có trong class diagram |

### 3.3. Out-of-scope (không thực hiện)

| Nội dung | Lý do |
|---|---|
| Cổng thanh toán thật (VNPay, MoMo, Stripe…) | Ngoài phạm vi học phần; dùng dịch vụ mô phỏng |
| Giao hàng, theo dõi shipper, bản đồ | Chỉ phục vụ nhận tại quầy |
| Nhiều chi nhánh, phân quyền quản lý đa cửa hàng | Giữ MVP gọn |
| Quản trị catalog qua giao diện (thêm/sửa/xóa sản phẩm, upload ảnh) | Dữ liệu menu nạp bằng seed/migration |
| Quản lý kho nâng cao (nhập kho, nguyên liệu, định lượng) | Chỉ có số lượng tồn theo sản phẩm |
| Hoàn tiền, hủy đơn sau thanh toán, đổi/trả | Không có trong luồng tối thiểu |
| Thông báo đẩy (push), SMS, email | Theo dõi đơn bằng làm mới/polling |
| Đa ngôn ngữ, đa tiền tệ | Chỉ tiếng Việt, VND |
| Ứng dụng native iOS/Android | Dùng web mobile-first/PWA |

## 4. Giả định

| Mã | Giả định |
|---|---|
| A-01 | Hệ thống phục vụ một cửa hàng; khách nhận đồ uống tại quầy, không có giao hàng. |
| A-02 | Tiền tệ là VND, lưu số nguyên (không có phần thập phân). |
| A-03 | Mỗi sản phẩm có ít nhất một size; topping áp dụng được cho từng sản phẩm theo danh sách cấu hình. |
| A-04 | Tồn kho được quản lý theo số lượng ly còn bán được của từng sản phẩm; topping chỉ có cờ còn/hết. |
| A-05 | Khách phải đăng nhập mới đặt đơn; xem menu không cần đăng nhập. |
| A-06 | Thanh toán là mô phỏng: kết quả thành công/thất bại do dịch vụ mô phỏng quyết định, không có tiền thật. |
| A-07 | Giá do server tính và là nguồn đúng; giá client gửi lên chỉ để hiển thị. |
| A-08 | Dữ liệu menu mẫu do nhóm tạo, không lấy từ hệ thống bên ngoài. |
| A-09 | Nhóm triển khai trên một nền tảng có gói miễn phí hoặc chi phí thấp (Render, Railway, Fly.io… do TV1 chốt). |

## 5. Ràng buộc

| Mã | Loại | Ràng buộc |
|---|---|---|
| C-01 | Công nghệ | Bắt buộc dùng Next.js (frontend), NestJS (backend), PostgreSQL (dữ liệu). Có thể bổ sung công nghệ khác nhưng không thay thế ba thành phần này. |
| C-02 | Quy trình | Năm task làm tuần tự; task sau chỉ được nghiệm thu khi task trước đã có tạo phẩm trên repository với lịch sử thay đổi rõ ràng. |
| C-03 | Quản lý mã nguồn | Mọi thay đổi tài liệu/sơ đồ/kiến trúc đi qua commit và pull request, ghi rõ lý do; không push trực tiếp vào `main`. |
| C-04 | Triển khai | Có URL production truy cập được qua HTTPS tại thời điểm chấm; database production không public trực tiếp. |
| C-05 | Bảo mật | Không để secret trong repository hoặc log CI. |
| C-06 | Chất lượng | PR không được merge nếu lint, test hoặc build thất bại. |
| C-07 | Tài liệu | Sơ đồ lưu cả file nguồn (`.puml`) và ảnh/SVG. |
| C-08 | Nguồn lực | Nhóm 6 người, thời gian trong một học kỳ, mỗi người có ít nhất một PR code trong mỗi Sprint. |

## 6. Rủi ro ban đầu

| Mã | Rủi ro | Khả năng | Tác động | Biện pháp giảm thiểu | Phụ trách |
|---|---|---|---|---|---|
| R-01 | Mã FR/NFR và mã sơ đồ không thống nhất giữa các thành viên, làm hỏng ma trận truy vết | Cao | Cao | Chốt quy ước mã ngay ngày đầu; TV2 hợp nhất SRS và chốt mã trước khi TV6 điền ma trận | TV2, TV6 |
| R-02 | Sơ đồ, SRS và code mâu thuẫn nhau (ví dụ class diagram khác entity thực tế) | Trung bình | Cao | Viết code sau khi chốt ADR và kiến trúc; mỗi PR đổi hành vi phải cập nhật tài liệu liên quan | Cả nhóm |
| R-03 | Nền tảng triển khai chốt muộn, deployment diagram không khớp thực tế | Trung bình | Cao | TV1 chốt nền tảng ở Sprint 0, trước khi vẽ deployment diagram | TV1 |
| R-04 | Gói miễn phí giới hạn (ngủ khi không dùng, hết hạn DB, giới hạn RAM) làm production không truy cập được lúc chấm | Trung bình | Cao | Kiểm tra production trước ngày chấm; có smoke test và rollback; cân nhắc VPS nhỏ nếu cần | TV1, TV2 |
| R-05 | Lỗi nghiệp vụ khi đặt đơn: tồn kho âm, đặt trùng, thanh toán hai lần | Trung bình | Cao | Transaction khi tạo đơn và trừ kho; ràng buộc `stock_quantity >= 0`; Idempotency-Key khi thanh toán; integration test | TV3, TV4 |
| R-06 | Frontend chờ backend nên trễ tiến độ | Trung bình | Trung bình | Công bố hợp đồng Swagger sớm; frontend mock theo hợp đồng | TV3, TV5 |
| R-07 | Một thành viên quá tải hoặc vắng, công việc phụ thuộc một người (CD, seed) | Trung bình | Trung bình | Đồng sở hữu CD (TV1/TV2); review chéo; cắt Could (Promotion/Loyalty) trước tiên | Cả nhóm |
| R-08 | Lộ secret (JWT secret, mật khẩu DB) trong repo hoặc log CI | Thấp | Cao | `.env.example` không chứa giá trị thật; dùng secret của CI; rà soát repo và log | TV1, TV2 |
| R-09 | Tải công việc dồn vào cuối Sprint 2 (E2E, CD, deploy, video) | Cao | Trung bình | Kéo auth, order, Swagger sang Sprint 1; diễn tập rollback trước ngày demo | Cả nhóm |

## 7. Thuật ngữ

| Thuật ngữ | Ý nghĩa |
|---|---|
| MVP | Phiên bản nhỏ nhất chạy được với tính năng cốt lõi |
| FR / NFR | Yêu cầu chức năng / phi chức năng |
| MoSCoW | Must, Should, Could, Won't |
| ADR | Architecture Decision Record |
| Idempotency-Key | Khóa để gửi lại yêu cầu thanh toán không tạo thanh toán thứ hai |
| Snapshot | Bản sao tên/giá tại thời điểm đặt, lưu trong đơn hàng |

## 8. Lịch sử thay đổi

| Phiên bản | Ngày | Tác giả | Thay đổi / Lý do |
|---|---|---|---|
| 0.1 | 2026-11-01 | Đỗ Hoàng Vinh | Bản nháp đầu tiên |
