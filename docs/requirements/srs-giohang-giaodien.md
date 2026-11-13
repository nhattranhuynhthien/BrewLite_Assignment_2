# ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS) - MODULE GIỎ HÀNG VÀ GIAO DIỆN

**Hệ thống:** BrewLite  
**Công nghệ:** Next.js, NestJS, PostgreSQL, Docker  
**Phiên bản:** 1.0  

---

> Đây là đặc tả thành phần với mã cục bộ `FR-CRT-*`, `FR-UI-*`, `NFR-CRT-*` và `NFR-UI-*`. Mã chuẩn dùng toàn dự án và phần được chấp nhận theo kiến trúc client-only được ghi tại [SRS tổng hợp](./srs.md); yêu cầu đồng bộ giỏ qua database/nhiều thiết bị chưa thuộc MVP.

## 1. Yêu cầu Chức năng của Giỏ hàng (Cart - FR)

Phần này đặc tả các chức năng quản lý giỏ hàng trực tuyến trên hệ thống BrewLite, cho phép khách hàng tương tác với các sản phẩm trước khi tiến hành thanh toán.

| Mã yêu cầu | Tên chức năng | Mức ưu tiên (MoSCoW) | Mô tả chi tiết | Tiêu chí chấp nhận (Acceptance Criteria) |
| :--- | :--- | :--- | :--- | :--- |
| **FR-CRT-01** | Thêm sản phẩm vào giỏ hàng | **Must Have** | Cho phép khách hàng thêm sản phẩm kèm tùy chọn (kích cỡ, lượng đường, đá, topping) và số lượng vào giỏ. | - Nút "Thêm vào giỏ" hoạt động khi chọn đủ thuộc tính bắt buộc.<br>- Cập nhật tức thì số lượng hiển thị trên icon giỏ hàng.<br>- Sản phẩm giống nhau về mọi tùy chọn được gộp chung số lượng. |
| **FR-CRT-02** | Xem danh sách giỏ hàng | **Must Have** | Hiển thị toàn bộ các món trong giỏ: hình ảnh, tên, tùy chọn, đơn giá, số lượng và tổng thành tiền tạm tính. | - Hiển thị đúng danh sách các món đã thêm.<br>- Tính chính xác tổng tiền = $\sum (\text{đơn giá sản phẩm} + \sum \text{topping}) \times \text{số lượng}$.<br>- Có thông báo rõ ràng nếu giỏ hàng trống. |
| **FR-CRT-03** | Cập nhật số lượng sản phẩm | **Must Have** | Cho phép người dùng tăng, giảm số lượng hoặc nhập trực tiếp số lượng của từng mục trong giỏ. | - Thay đổi số lượng tự động cập nhật tổng tiền tạm tính.<br>- Giảm số lượng về 0 sẽ yêu cầu xác nhận xóa mục.<br>- Chặn số lượng âm hoặc vượt quá tồn kho. |
| **FR-CRT-04** | Xóa sản phẩm khỏi giỏ hàng | **Must Have** | Cho phép người dùng xóa một mục riêng lẻ hoặc làm trống toàn bộ giỏ hàng (Clear Cart). | - Có hộp thoại xác nhận trước khi xóa.<br>- Làm mới giao diện và đưa giỏ hàng về trạng thái trống khi xóa hết. |
| **FR-CRT-05** | Lưu trữ trạng thái giỏ hàng | **Should Have** | Lưu trạng thái giỏ trên client (LocalStorage) cho cả khách vãng lai và người dùng đăng nhập, theo quyết định client-only của SRS tổng hợp. | - Đóng trình duyệt rồi mở lại vẫn giữ giỏ trên cùng thiết bị/trình duyệt.<br>- Không yêu cầu lưu database hoặc đồng bộ nhiều thiết bị trong MVP. |
| **FR-CRT-06** | Áp dụng mã khuyến mãi | **Could Have** | Cho phép người dùng nhập mã giảm giá tại trang giỏ hàng để giảm trừ tổng giá trị đơn hàng. | - Hệ thống kiểm tra tính hợp lệ của mã.<br>- Hiển thị số tiền được giảm và cập nhật lại tổng thanh toán. |

---

## 2. Yêu cầu Phi chức năng của Giỏ hàng (Cart - NFR)

Phần này quy định các tiêu chuẩn chất lượng kỹ thuật, hiệu năng và bảo mật riêng biệt cho module giỏ hàng.

| Mã yêu cầu | Tiêu chí / Hạng mục | Mức ưu tiên | Mô tả chi tiết & Chỉ số đo lường (Metrics) |
| :--- | :--- | :--- | :--- |
| **NFR-CRT-01** | Hiệu năng xử lý giỏ hàng | **Must Have** | Các thao tác thay đổi số lượng, thêm/xóa sản phẩm ở phía client phải phản hồi mượt mà với độ trễ giao diện dưới 100ms. |
| **NFR-CRT-02** | Tính toàn vẹn dữ liệu giỏ hàng | **Must Have** | Dữ liệu giỏ hàng client-side không bị âm thầm mất/lệch khi người dùng thao tác đồng thời nhiều tab trình duyệt. |
| **NFR-CRT-03** | Bảo mật khi đặt đơn từ giỏ | **Should Have** | Không có API giỏ hàng server-side trong MVP client-only; khi gửi giỏ để tạo đơn, API phải xác thực JWT và xác định chủ đơn từ danh tính server, không tin `userId` client gửi. |

---

## 3. Yêu cầu Dùng chung của Giao diện (UI/UX - FR & NFR)

Phần này bao gồm các yêu cầu về chức năng giao diện và yêu cầu phi chức năng áp dụng chung cho toàn bộ ứng dụng Next.js / PWA của BrewLite.

### 3.1. Yêu cầu Chức năng của Giao diện (UI - FR)

| Mã yêu cầu | Tên chức năng giao diện | Mức ưu tiên (MoSCoW) | Mô tả chi tiết | Tiêu chí chấp nhận (Acceptance Criteria) |
| :--- | :--- | :--- | :--- | :--- |
| **FR-UI-01** | Bố cục Mobile-First & Responsive | **Must Have** | Thiết kế giao diện ưu tiên thiết bị di động, đồng thời hiển thị tối ưu trên tablet và desktop. | - Hiển thị tốt trên màn hình từ 320px trở lên.<br>- Vùng chạm (touch target) tối thiểu 48x48px trên thiết bị di động. |
| **FR-UI-02** | Hỗ trợ PWA (Progressive Web App) | **Should Have** | Cấu hình file `manifest.json` và Service Worker để cài đặt web thành ứng dụng trên màn hình chính. | - Trình duyệt gợi ý "Thêm vào màn hình chính".<br>- Hỗ trợ cache ngoại tuyến cơ bản cho các trang tĩnh. |
| **FR-UI-03** | Hiển thị trạng thái tải (Loading States) | **Must Have** | Hiển thị hiệu ứng Skeleton screen hoặc Spinner khi hệ thống đang gọi API tải dữ liệu. | - Tránh hiện tượng màn hình trắng (white screen) khi chuyển trang hoặc chờ dữ liệu từ NestJS API. |
| **FR-UI-04** | Trạng thái trống và lỗi (Empty & Error States) | **Must Have** | Cung cấp thông báo trực quan, thân thiện khi không có dữ liệu hoặc khi xảy ra lỗi kết nối mạng. | - Hiển thị thông báo kèm hình ảnh minh họa và nút hướng dẫn hành động tiếp theo (ví dụ: nút thử lại). |
| **FR-UI-05** | Thanh điều hướng linh hoạt (Navigation) | **Must Have** | Cung cấp Bottom Navigation Bar trên mobile và Header Navigation trên desktop để di chuyển nhanh. | - Điều hướng mượt mà không làm mất trạng thái ứng dụng nhờ Next.js client-side routing. |

---

### 3.2. Yêu cầu Phi chức năng của Giao diện (UI - NFR)

| Mã yêu cầu | Tiêu chí / Hạng mục | Mức ưu tiên | Mô tả chi tiết & Chỉ số đo lường (Metrics) |
| :--- | :--- | :--- | :--- |
| **NFR-UI-01** | Hiệu năng giao diện (Performance) | **Must Have** | Trang web phát triển bằng Next.js phải đạt điểm Lighthouse (Performance) tối thiểu từ 80 trở lên. Thời gian tải trang ban đầu dưới 2 giây. |
| **NFR-UI-02** | Tính khả dụng & Trải nghiệm (Usability) | **Must Have** | Giao diện trực quan bằng tiếng Việt hoàn toàn, bố cục mạch lạc giúp người dùng thực hiện đặt hàng thành thạo trong vòng dưới 2 phút. |
| **NFR-UI-03** | Khả năng tương thích trình duyệt (Compatibility) | **Must Have** | Giao diện hiển thị chính xác và không lỗi layout trên các trình duyệt phổ biến hiện nay (Chrome, Safari, Firefox, Edge phiên bản mới nhất). |