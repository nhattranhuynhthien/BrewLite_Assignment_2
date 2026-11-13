# Tài liệu SRS: Giỏ hàng và Giao diện (Shopping Cart & UI) – BrewLite

Tài liệu này đặc tả chi tiết các yêu cầu chức năng (FR), yêu cầu phi chức năng (NFR), mức ưu tiên MoSCoW và tiêu chí chấp nhận kiểm chứng đối với phân hệ **Giỏ hàng** và **Giao diện (UI/UX - Mobile-first/PWA)** của dự án **BrewLite**, tuân thủ các ràng buộc và quy chuẩn mã đã định nghĩa trong `A2-brewlite.md` và `srs.md`.

---

## 1. Yêu cầu chức năng: Phân hệ Giỏ hàng (`FR-10` đến `FR-19`)

| Mã yêu cầu | Tên chức năng | Mức ưu tiên | Mô tả chi tiết nghiệp vụ | Tiêu chí chấp nhận kiểm chứng (Verifiable Acceptance Criteria) |
| :--- | :--- | :--- | :--- | :--- |
| **FR-10** | Thêm sản phẩm vào giỏ hàng | **Must** | Khách hàng có thể thêm sản phẩm từ màn hình chi tiết hoặc danh mục vào giỏ hàng client-side. | - Khi bấm "Thêm vào giỏ", sản phẩm được thêm vào danh sách giỏ hàng kèm số lượng mặc định là 1.<br>- Giao diện cập nhật ngay số lượng hiển thị trên biểu tượng giỏ hàng (badge). |
| **FR-11** | Chọn size và topping cho dòng hàng | **Must** | Cho phép khách hàng chọn size cụ thể và danh sách topping khả dụng cho từng dòng sản phẩm khi thêm vào giỏ. | - Hệ thống hiển thị đúng các tùy chọn size và topping cấu hình sẵn của sản phẩm.<br>- Cho phép chọn 1 size (bắt buộc nếu có) và nhiều/0 topping.<br>- Mỗi tổ hợp (Sản phẩm + Size + Topping) được lưu thành một dòng hàng (cart item) riêng biệt hoặc gom nhóm số lượng chính xác. |
| **FR-12** | Chỉnh sửa số lượng hoặc lựa chọn | **Must** | Khách hàng có thể tăng/giảm số lượng hoặc thay đổi cấu hình size/topping của dòng hàng trong giỏ. | - Cho phép tăng/giảm số lượng bằng nút bấm hoặc nhập trực tiếp (số lượng nguyên dương $\ge 1$).<br>- Cho phép thay đổi size/topping; hệ thống cập nhật lại dòng hàng tương ứng mà không làm mất các sản phẩm khác trong giỏ. |
| **FR-13** | Xóa sản phẩm hoặc làm trống giỏ | **Must** | Khách hàng có thể xóa từng dòng sản phẩm khỏi giỏ hoặc xóa toàn bộ giỏ hàng. | - Có nút xóa riêng cho từng dòng hàng; hiển thị popup xác nhận khi xóa toàn bộ giỏ hàng.<br>- Sau khi xóa, tổng tiền và danh sách giỏ hàng được cập nhật tức thì trên giao diện. |
| **FR-14** | Hiển thị tổng tiền tạm tính | **Must** | Giao diện hiển thị tổng tiền tạm tính của giỏ hàng dựa trên giá tại menu hiện tại; làm rõ rằng đây là giá tham khảo và server sẽ tính chính xác lại lúc đặt đơn. | - Tổng tiền tạm tính hiển thị định dạng chuẩn VND (số nguyên).<br>- Có chú thích rõ: *"Giá tạm tính, giá chính xác sẽ được xác nhận khi đặt đơn"*. |
| **FR-15** | Duy trì giỏ hàng khi chuyển sang đăng nhập | **Should** | Giỏ hàng được lưu trữ ở client (localStorage/sessionStorage) và được bảo toàn nguyên vẹn khi khách hàng bị chuyển hướng sang màn hình đăng nhập rồi quay lại đặt đơn. | - Khi khách chưa đăng nhập, thêm món vào giỏ $\rightarrow$ bấm thanh toán $\rightarrow$ hệ thống yêu cầu đăng nhập.<br>- Sau khi đăng nhập thành công, toàn bộ sản phẩm trong giỏ hàng vẫn được giữ nguyên vẹn để tiếp tục luồng đặt đơn. |

---

## 2. Yêu cầu chức năng: Giao diện và Trải nghiệm Người dùng (`FR-01`, `FR-04`, `FR-05`, `FR-38`, v.v. liên quan tới UI)

| Mã yêu cầu | Tên chức năng | Mức ưu tiên | Mô tả chi tiết nghiệp vụ | Tiêu chí chấp nhận kiểm chứng (Verifiable Acceptance Criteria) |
| :--- | :--- | :--- | :--- | :--- |
| **FR-UI-01** *(Mở rộng từ FR-01, 04, 05)* | Giao diện Menu & Chi tiết sản phẩm Mobile-first | **Must** | Thiết kế giao diện theo hướng mobile-first/PWA, hiển thị danh mục, danh sách sản phẩm, ảnh, giá, size, topping trực quan, mượt mà trên thiết bị di động. | - Layout co giãn tốt trên màn hình mobile (viewport từ 320px trở lên) và responsive trên desktop.<br>- Hình ảnh sản phẩm tải tối ưu (lazy loading); hiển thị rõ trạng thái còn/hết hàng. |
| **FR-UI-02** *(Mở rộng từ FR-38)* | Phản hồi trạng thái xử lý & Ngăn chặn Double-click | **Must** | Giao diện hiển thị trạng thái đang xử lý (loading spinner/skeleton), vô hiệu hóa (disable) các nút bấm tác vụ khi đang gọi API để tránh gửi yêu cầu trùng lặp. | - Khi người dùng bấm "Đặt hàng" hoặc "Thanh toán", nút bấm chuyển sang trạng thái loading và bị vô hiệu hóa.<br>- Không cho phép gửi nhiều request đồng thời khi người dùng bấm liên tục (debounce/throttle cơ chế UI). |
| **FR-UI-03** *(Mở rộng từ NFR-05)* | Xử lý lỗi UI, Empty State & Loading State | **Should** | Các màn hình dữ liệu (Menu, Giỏ hàng, Lịch sử đơn) phải có trạng thái chờ (loading), trạng thái trống (empty state) và thông báo lỗi rõ ràng. | - Hiển thị skeleton/spinner khi đang tải dữ liệu.<br>- Khi giỏ hàng trống hoặc không tìm thấy sản phẩm, hiển thị giao diện empty state thân thiện kèm nút hành động (ví dụ: "Khám phá menu").<br>- Khi API lỗi, hiển thị thông báo lỗi (toast/banner) nêu rõ nguyên nhân cơ bản thay vì sập màn hình (crash). |

---

## 3. Yêu cầu Phi chức năng liên quan trực tiếp (`NFR-02`, `NFR-03`, `NFR-05`, `NFR-06`)

| Mã chuẩn NFR | Nhóm | Tiêu chuẩn kỹ thuật và Tiêu chí nghiệm chứng | Mức ưu tiên |
| :--- | :--- | :--- | :--- |
| **NFR-02** | Toàn vẹn dữ liệu | Giá trị tiền tệ là số nguyên VND; mọi tính toán giá tiền cuối cùng trong giỏ hàng và đơn hàng **bắt buộc phải do Server xử lý và tính toán lại**, tuyệt đối không tin tưởng dữ liệu giá tiền gửi từ Client. | **Must** |
| **NFR-03** | Bảo mật & An toàn | Không lưu trữ thông tin nhạy cảm (mật khẩu dạng plain text, JWT token, secret key) trên LocalStorage dưới dạng không mã hóa nếu không cần thiết; dữ liệu truyền tải qua HTTPS. | **Must** |
| **NFR-05** | Trải nghiệm UI (UX) | Mọi thao tác tương tác bất đồng bộ phải cung cấp phản hồi trực quan (loading, success/error toast), khóa nút khi submit, và giữ nguyên trạng thái giỏ hàng khi cần xác thực. | **Should** |
| **NFR-06** | Hợp đồng API (OpenAPI) | Các API endpoint phục vụ giỏ hàng, sản phẩm, và đặt đơn phải được thiết kế đồng bộ, tài liệu hóa rõ ràng bằng Swagger/OpenAPI khớp với hành vi thực tế của backend NestJS. | **Must** |