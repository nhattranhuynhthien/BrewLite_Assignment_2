# ADR-002: Xác thực JWT và bảo mật ứng dụng

- **Trạng thái:** Accepted
- **Ngày:** 2026-11-14
- **Người quyết định:** Nhóm BrewLite
- **Liên quan:** [Kiến trúc hệ thống](../architecture.md), [SRS](../../requirements/srs.md) (FR-20–FR-24, NFR-07, NFR-17)

## Bối cảnh

BrewLite cần đăng ký, đăng nhập, bảo vệ API đặt hàng/thanh toán, giới hạn thao tác theo vai trò và chỉ cho khách hàng truy cập dữ liệu của chính họ. Backend NestJS phát hành JWT cho frontend Next.js; frontend gửi token trong header `Authorization`.

Hệ thống chạy trong monorepo và đóng gói bằng Docker ([ADR-001](001-monorepo.md)). Trên production, Render kết thúc HTTPS tại ingress, cấp cấu hình qua Environment & Secrets, kết nối API tới PostgreSQL qua private network và thu thập log JSON đã che dữ liệu nhạy cảm.

## Các lựa chọn

1. Session phía server với kho lưu session.
2. **JWT access token (HS256) ký bằng secret do môi trường cung cấp.**
3. OAuth/SSO qua nhà cung cấp bên ngoài.

## Quyết định

1. **Sử dụng JWT access token HS256.** Token gồm `sub` (ID người dùng) và `role` (`CUSTOMER` | `STAFF`). API chỉ chấp nhận thuật toán HS256 và xác minh chữ ký, thời hạn, `sub`, vai trò trước khi xử lý request. Không đưa mật khẩu, secret hoặc dữ liệu cá nhân nhạy cảm vào payload.

2. **Xác thực và phân quyền ở backend.**
   - DTO đăng ký/đăng nhập được validate (`class-validator`); mật khẩu băm bằng `bcrypt`, không lưu hoặc ghi log mật khẩu dạng rõ.
   - `JwtAuthGuard` từ chối token thiếu, sai chữ ký, sai định dạng hoặc hết hạn với HTTP `401`. `RolesGuard` từ chối người dùng không đủ quyền với HTTP `403`.
   - Quyền sở hữu đơn hàng được xác định từ `sub` của token ở tầng service; không tin `userId` do client gửi. Chỉ `STAFF` được phép cập nhật trạng thái đơn hàng.

3. **Giới hạn vòng đời token.** Access token có thời hạn ngắn, cấu hình qua `JWT_EXPIRES_IN` (production dùng 15–60 phút; `1d` trong `.env.example` chỉ dùng cho local). Refresh token không thuộc phạm vi MVP; người dùng đăng nhập lại khi token hết hạn.

4. **Bảo vệ khóa ký và cấu hình.**
   - `JWT_SECRET` được cấp từ biến môi trường; production dùng Render Environment & Secrets, CI chỉ nhận secret khi cần triển khai.
   - Secret tối thiểu 32 ký tự; ứng dụng dừng khởi động nếu thiếu hoặc không đạt độ dài tối thiểu.
   - Không đưa secret vào Git, Docker image, biến `NEXT_PUBLIC_*`, URL, response hoặc log.

5. **Bảo vệ đường truyền và lưu token phía trình duyệt.**
   - Browser gọi web/API qua HTTPS; JWT chỉ gửi trong header `Authorization: Bearer <token>`, không gửi qua query string.
   - `CORS_ORIGIN` giới hạn theo origin được phép; PostgreSQL production chỉ truy cập qua private network.
   - Phía trình duyệt ([ADR-005](005-Next.js-PWA-stateCart-dataFetching.md)), lớp `lib/api` tự động gắn header `Authorization` và khi gặp `401` thì xóa phiên đăng nhập, chuyển về trang đăng nhập nhưng giữ nguyên giỏ hàng `LocalStorage`.

6. **Che dữ liệu nhạy cảm trong log.** Log JSON chỉ ghi thông tin vận hành; redact `Authorization`, `cookie`, mật khẩu, JWT, secret và dữ liệu thanh toán nhạy cảm.

## Hệ quả

- (+) Phân quyền được kiểm tra tập trung ở backend; danh tính và chủ sở hữu đơn lấy từ token đã xác minh.
- (+) Secret tách khỏi mã nguồn và image; PostgreSQL không mở công khai; log không làm lộ thông tin xác thực.
- (+) JWT stateless phù hợp với kiến trúc tách web/API trên Render.
- (–) Token bị đánh cắp vẫn có hiệu lực đến khi hết hạn hoặc xoay khóa; MVP không thu hồi từng token.
- (–) Xoay khóa `JWT_SECRET` làm mất hiệu lực các token hiện hành và yêu cầu người dùng đăng nhập lại.
