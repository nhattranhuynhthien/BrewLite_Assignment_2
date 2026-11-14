# ADR-005: Kiến trúc Frontend Next.js PWA, state giỏ hàng và data fetching

- **Trạng thái:** Accepted
- **Ngày:** 2026-11-14
- **Người quyết định:** Nhóm BrewLite
- **Liên quan:** [SRS](../../requirements/srs.md) (FR-10–FR-19, NFR-04–NFR-06, NFR-09–NFR-11), [Kiến trúc hệ thống](../architecture.md), [ADR-001](001-monorepo.md), [ADR-002](002-jwt-security.md), [ADR-004](004-order-payment-consistency.md)

## Bối cảnh

BrewLite là ứng dụng web đặt đồ uống nhận tại quầy theo hướng mobile-first / PWA bằng Next.js. Frontend cần giải quyết ba bài toán:
1. Giao diện mobile-first (từ viewport 320 px, vùng chạm tối thiểu 48×48 CSS px) và hỗ trợ cài đặt PWA kèm cache tài nguyên tĩnh mà không làm lộ dữ liệu cá nhân.
2. Quản lý giỏ hàng hoàn toàn ở client (`LocalStorage`), phản hồi <100 ms, giữ lại sau khi đóng/mở trình duyệt hoặc đăng nhập, và đồng bộ giữa các tab.
3. Gọi REST API tới NestJS nhất quán, tự gắn JWT, quản lý `Idempotency-Key` khi thanh toán, polling trạng thái đơn mỗi 5 giây và hiển thị rõ trạng thái `loading` / `empty` / `error`.

## Các lựa chọn

### Quản lý state giỏ hàng
1. Lưu giỏ hàng trên database qua API backend.
2. Chỉ giữ giỏ hàng trong bộ nhớ (`React Context` / `useState`) không lưu bền vững.
3. **Client store (Zustand + `LocalStorage` có phiên bản) kết hợp đồng bộ sự kiện `storage` đa tab.**

### Data fetching và giao tiếp API
1. Gọi `fetch` rời rạc trực tiếp trong từng component.
2. **Next.js App Router kết hợp lớp API client tập trung (`lib/api`).**

## Quyết định

1. **Next.js App Router (Mobile-first) và PWA:**
   - Thiết kế mobile-first từ viewport `320 px`, vùng chạm chính tối thiểu `48×48 CSS px`, có bottom navigation trên mobile và header navigation trên desktop.
   - Cấu hình `manifest.webmanifest` và Service Worker chỉ cache app shell, font, icon và tài nguyên tĩnh công khai.
   - **Không cache** các API có xác thực hoặc dữ liệu cá nhân/thanh toán (`POST /orders`, `GET /orders`, `POST /payments`). Offline chỉ hiển thị giao diện tĩnh, không cho đặt đơn hay thanh toán ngoại tuyến.

2. **State giỏ hàng ở client (`Zustand` + `LocalStorage`):**
   - Lưu giỏ hàng tại `LocalStorage` (versioned key) để giữ lại khi tải lại trang, đóng/mở trình duyệt hoặc chuyển sang đăng nhập (FR-14).
   - Gộp dòng hàng có cùng `productId`, `sizeId` và tập `toppingIds`; cập nhật tổng tạm tính tức thì (<100 ms); chặn số lượng âm/vượt tồn; giảm về `0` hoặc xóa giỏ có xác nhận (FR-10–FR-13).
   - Lắng nghe sự kiện `storage` để đồng bộ giỏ hàng giữa nhiều tab trên cùng trình duyệt, tránh ghi đè mất dữ liệu âm thầm (NFR-06).
   - Giá ở giỏ hàng chỉ là tạm tính; khi đặt đơn, server luôn tính lại giá và kiểm tra tồn kho (FR-06, FR-26).

3. **Data fetching qua lớp `lib/api` tập trung:**
   - Mọi request tới backend đi qua `lib/api` với `NEXT_PUBLIC_API_URL` (không chứa secret).
   - Tự động gắn `Authorization: Bearer <token>`; khi nhận `401`, xóa phiên đăng nhập, chuyển về trang đăng nhập và giữ nguyên giỏ hàng `LocalStorage`.
   - Sinh `Idempotency-Key` (UUID v4) cho mỗi ý định thanh toán và giữ nguyên key khi retry do lỗi mạng/timeout (`202`). Nếu đơn chuyển sang `PAYMENT_FAILED` (`402`), khách tạo **đơn mới** kèm **key mới** từ giỏ hàng để thử lại.
   - Trang chi tiết đơn polling mỗi `5 giây` khi hiển thị ở foreground, không gửi chồng request và dừng khi đơn ở trạng thái cuối (`COMPLETED`, `PAYMENT_FAILED`, `CANCELLED`) hoặc khi rời trang (NFR-05).
   - Mọi màn hình dữ liệu đều có trạng thái `loading` (skeleton/spinner), `empty` và `error` (nút thử lại chỉ đọc lại dữ liệu, không gửi lặp thao tác ghi).

## Hệ quả

- (+) Giỏ hàng phản hồi nhanh (<100 ms), giữ được trước và sau đăng nhập mà không cần cart API/database.
- (+) Tập trung xử lý JWT, `Idempotency-Key`, lỗi HTTP và trạng thái UI tại một đầu mối `lib/api`.
- (+) Tách biệt cache tĩnh của PWA với dữ liệu cá nhân/thanh toán.
- (–) Các thành phần hiển thị số lượng giỏ hàng cần đợi client hydrate từ `LocalStorage` để tránh lệch SSR.
- (–) Giỏ hàng chỉ lưu trên trình duyệt của thiết bị hiện tại, không đồng bộ đa thiết bị.
