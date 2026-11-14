# ADR-009: Xác thực JWT và bảo mật ứng dụng

- **Trạng thái:** Proposed — chờ review của TV1/TV3
- **Ngày:** 2026-11-14
- **Người đề xuất:** TV2
- **Phạm vi:** Bổ sung các yêu cầu bảo mật triển khai cho ADR-007; không thay thế ADR-002 (modular monolith) hoặc ADR-007 (JWT).
- **Tài liệu liên quan:** [Kiến trúc hệ thống](../../architecture.md), [ADR-001](001-monorepo.md), [ADR-007](007-jwt-authentication.md), [ADR-008](008-logging-health-config.md), [deployment-render.puml](../../diagrams/deployment-render.puml), [deployment-render.svg](../../diagrams/deployment-render.svg), [SRS](../../requirements/srs.md) (FR-20–FR-24, NFR-07).

## Bối cảnh

BrewLite cần đăng ký và đăng nhập người dùng, bảo vệ API đặt hàng/thanh toán, giới hạn thao tác theo vai trò và chỉ cho khách hàng truy cập dữ liệu của chính họ. Backend NestJS phát hành JWT cho frontend Next.js; frontend gửi token trong header `Authorization`.

Hệ thống chạy trong monorepo và được đóng gói bằng Docker theo ADR-001. Trên production, Render kết thúc HTTPS tại ingress, cấp cấu hình qua Environment & Secrets, kết nối API tới PostgreSQL qua private network và thu thập log JSON đã che dữ liệu nhạy cảm. Vì vậy, khóa ký JWT, thông tin xác thực và ranh giới truy cập cần được bảo vệ nhất quán giữa local, CI và production.

ADR-007 đã chọn JWT HS256 và mật khẩu băm, nhưng việc sử dụng token, cấu hình secrets, kiểm soát quyền và xử lý log cần được cụ thể hóa cho deployment production.

## Các lựa chọn

1. Session phía server với kho lưu session.
2. JWT access token ký bằng secret do môi trường cung cấp.
3. OAuth/SSO qua nhà cung cấp bên ngoài.

## Quyết định

1. **Giữ JWT access token HS256 theo ADR-007.** Token gồm `sub` (ID người dùng) và `role` thuộc tập `CUSTOMER`/`STAFF`. API chỉ chấp nhận thuật toán HS256 đã cấu hình và xác minh chữ ký, thời hạn, `sub` và vai trò trước khi xử lý request. Không đưa mật khẩu, secret hoặc dữ liệu cá nhân không cần thiết vào payload.

2. **Xác thực và phân quyền ở backend.**
   - DTO đăng ký/đăng nhập phải được validate; mật khẩu chỉ lưu dưới dạng hash bằng bcrypt theo kiến trúc hiện tại, không lưu hoặc ghi log mật khẩu dạng rõ.
   - `JwtAuthGuard` từ chối token thiếu, sai chữ ký, sai định dạng hoặc hết hạn với HTTP 401. `RolesGuard` từ chối người dùng đã xác thực nhưng không đủ quyền với HTTP 403.
   - Quyền sở hữu đơn hàng được xác định từ `sub` của token ở service; không dùng `userId` do client gửi làm căn cứ phân quyền. Chỉ `STAFF` được phép thực hiện các thao tác dành cho nhân viên.

3. **Giới hạn vòng đời token.** Access token phải có thời hạn ngắn và cấu hình được qua `JWT_EXPIRES_IN`; môi trường production dùng khoảng 15–60 phút theo ADR-007. Giá trị `1d` trong `.env.example` chỉ là cấu hình mẫu local, không dùng làm cấu hình production. Refresh token không thuộc phạm vi MVP; người dùng đăng nhập lại khi access token hết hạn. Bổ sung refresh token hoặc cơ chế thu hồi token cần được đánh giá và cập nhật SRS/ADR riêng.

4. **Bảo vệ khóa ký và cấu hình.**
   - `JWT_SECRET` phải được cấp từ biến môi trường; production dùng Render Environment & Secrets, còn CI chỉ nhận secret khi workflow cần triển khai.
   - Secret production phải có độ ngẫu nhiên phù hợp và tối thiểu 32 ký tự. Ứng dụng phải dừng khởi động nếu secret bị thiếu hoặc không đạt độ dài tối thiểu; không dùng giá trị mặc định hay giá trị mẫu trong production.
   - Không đưa secret vào Git, Docker image, biến `NEXT_PUBLIC_*`, URL, response hoặc log. Xoay khóa sẽ làm các token đã ký bằng khóa cũ không còn hợp lệ.

5. **Bảo vệ đường truyền và hạ tầng.**
   - Browser gọi web/API production qua HTTPS tại Render ingress; JWT chỉ gửi trong header `Authorization: Bearer`, không gửi qua query string.
   - `CORS_ORIGIN` phải giới hạn theo origin production được phép; không dùng wildcard trong production.
   - PostgreSQL production chỉ truy cập qua private network, không mở trực tiếp ra Internet. Các dịch vụ chỉ nhận cấu hình cần thiết từ môi trường triển khai.
   - Cơ chế lưu token phía browser chưa được các tài liệu kiến trúc chốt. Trước khi phát hành production, nhóm phải chọn và review riêng cơ chế lưu phù hợp; không lưu token trong URL hoặc log. Nếu dùng cookie, cookie phải được cấu hình bảo mật và có biện pháp CSRF phù hợp.

6. **Che dữ liệu nhạy cảm trong log.** Theo ADR-008, log JSON chỉ ghi thông tin cần cho vận hành; phải redact `Authorization`, cookie, mật khẩu, JWT, secret và dữ liệu thanh toán nhạy cảm. Không ghi toàn bộ request body của luồng xác thực hoặc thanh toán.

## Hệ quả

- (+) Phân quyền được kiểm tra tập trung ở backend; danh tính và chủ sở hữu dữ liệu lấy từ token đã xác minh thay vì dữ liệu do client tự khai.
- (+) Secret production được tách khỏi source code và image; PostgreSQL không bị mở công khai; log giảm nguy cơ làm lộ thông tin xác thực.
- (+) JWT stateless phù hợp với API NestJS và cách triển khai web/API tách biệt trên Render.
- (–) Token bị đánh cắp vẫn dùng được đến khi hết hạn hoặc khóa bị xoay; MVP không có thu hồi từng token hay refresh token.
- (–) Secret rotation làm mất hiệu lực các token hiện hành và yêu cầu người dùng đăng nhập lại.
- (–) Frontend cần thống nhất cơ chế lưu token trước production; quyết định này phải xét rủi ro XSS và, nếu dùng cookie, cả CSRF.
- (–) Các test đăng ký, hash mật khẩu, token sai/hết hạn, quyền CUSTOMER/STAFF và quyền sở hữu cần được bổ sung vào test/CI theo NFR-07; ADR này không xác nhận các test hoặc pipeline đã tồn tại.

## Điều kiện nghiệm thu quyết định

ADR chỉ chuyển sang **Accepted** sau khi TV1/TV3 review các quyết định về TTL, lưu token phía browser và cấu hình production, đồng thời xác nhận chúng nhất quán với SRS và deployment diagram.
