# ADR-005: Lựa chọn công nghệ và kiến trúc Frontend cho Next.js PWA, Quản lý State Giỏ hàng và Chiến lược Data Fetching

* **Trạng thái:** Đã phê duyệt (Accepted)

* **Ngày tạo:** 14/11/2026

* **Người thực hiện:** Nhóm phát triển BrewLite

## 1. Bối cảnh (Context)

Ứng dụng web BrewLite được xây dựng theo hướng mobile-first/PWA bằng Next.js nhằm phục vụ khách hàng đặt món trực tiếp tại cửa hàng hoặc từ xa. Trong quá trình phát sinh trải nghiệm người dùng (UX) và tối ưu hóa hiệu năng, nhóm đối mặt với ba bài toán kiến trúc trọng tâm ở phía client:

1. **PWA và Khả năng Offline:** Khách hàng hoặc nhân viên quầy đôi lúc gặp tình trạng kết nối mạng kém hoặc chập chờn tại quán cafe. Hệ thống cần khả năng caching asset cơ bản và hỗ trợ trải nghiệm liền mạch.

2. **Quản lý State Giỏ hàng (Cart State):** Giỏ hàng cần đồng bộ tốt giữa giao diện (UI) và lưu trữ cục bộ (`localStorage`) để người dùng không bị mất sản phẩm khi tải lại trang, đồng thời hỗ trợ cập nhật số lượng, thêm topping, chọn size một cách mượt mà.

3. **Chiến lược Data Fetching:** Dữ liệu danh mục sản phẩm (menu), chi tiết sản phẩm và lịch sử đơn hàng có tần suất thay đổi khác nhau. Cần chọn chiến lược phù hợp giữa SSR (Server-Side Rendering), SSG (Static Site Generation), hay CSR (Client-Side Rendering) kết hợp caching thông minh.

## 2. Quyết định (Decision)

Nhóm quyết định áp dụng các giải pháp kỹ thuật sau cho tầng Frontend của BrewLite:

* **Sử dụng Next.js App Router kết hợp PWA Plugin (`next-pwa`):**

  * Tận dụng kiến trúc Server Components (RSC) để tối ưu hóa thời gian tải trang đầu tiên (FCP/LCP) cho danh mục sản phẩm.

  * Cấu hình Service Worker thông qua `next-pwa` để cache các tài nguyên tĩnh (icons, fonts, shell UI) và xử lý trang fallback khi mất kết nối mạng.

* **Quản lý State Giỏ hàng bằng Zustand + `persist` middleware:**

  * Sử dụng **Zustand** làm thư viện quản lý state toàn cục gọn nhẹ thay vì Redux Toolkit (do tính chất giỏ hàng của BrewLite không quá phức tạp, tránh boilerplate code).

  * Kích hoạt middleware `persist` để tự động lưu trữ trạng thái giỏ hàng vào `localStorage`, đảm bảo dữ liệu không bị mất khi F5 hoặc đóng trình duyệt.

* **Chiến lược Data Fetching tối ưu:**

  * **Menu sản phẩm (`GET /products`):** Sử dụng kết hợp **ISR (Incremental Static Regeneration)** hoặc **SSR với caching** ngắn hạn cho trang danh mục chính để đảm bảo tốc độ phản hồi nhanh và dữ liệu giá/sản phẩm luôn cập nhật.

  * **Chi tiết sản phẩm (`GET /products/:id`):** Sử dụng Dynamic Rendering (SSR) hoặc Client-side Fetching với React Query / SWR tùy thuộc vào tương tác chọn size/topping trực tiếp.

  * **Giỏ hàng & Đơn hàng:** Thực hiện Client-side Fetching kết hợp mutation qua API của NestJS khi người dùng bấm xác nhận đặt đơn.

## 3. Hệ quả (Consequences)

### 3.1. Ưu điểm (Positive Consequences)

* **Trải nghiệm người dùng (UX) vượt trội:** Giao diện tải nhanh, phản hồi tức thì với giỏ hàng lưu trữ cục bộ, mang cảm giác mượt mà như native app trên thiết bị di động.

* **Hiệu năng và SEO tốt:** Next.js Server Components giúp giảm tải dung lượng JavaScript gửi về client, đồng thời hỗ trợ tốt việc SEO trang menu của quán.

* **Bảo trì dễ dàng:** Mã nguồn quản lý state với Zustand rất gọn gàng, dễ kiểm thử và dễ mở rộng các tính năng khuyến mãi/mã giảm giá sau này.

### 3.2. Hạn chế và Thách thức (Negative Consequences / Trade-offs)

* **Xử lý Hydration Mismatch:** Việc kết hợp Zustand `persist` với Next.js SSR có thể gây ra lỗi lệch trạng thái hydrate giữa server và client nếu không xử lý kỹ cờ hiệu `isHydrated` trước khi render giỏ hàng. Nhóm cần cẩn trọng trong các component hiển thị số lượng giỏ hàng ở header.

* **Cấu hình Service Worker:** PWA có thể gây khó khăn trong việc debug cache (browser caching) trong quá trình phát triển (development mode), yêu cầu nhóm phải nhớ xóa cache hoặc cấu hình bật/tắt PWA phù hợp ở môi trường dev.