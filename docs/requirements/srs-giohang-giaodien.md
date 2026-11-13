# SRS BrewLite – Nhóm Giỏ hàng và Giao diện

Bài tập lớn Công nghệ Phần mềm – Assignment 2, Task 1.2 · Phiên bản 1.1 · 14/11/2026 · Trường Đại học Sài Gòn, Khoa CNTT

## 1. Giới thiệu

### 1.1 Mục đích
Tài liệu này đặc tả yêu cầu phần mềm chi tiết cho hai nhóm chức năng cốt lõi của ứng dụng BrewLite: **Phân hệ Giỏ hàng (CART)** và **Phân hệ Giao diện người dùng (UI)**. Tài liệu phục vụ làm căn cứ kỹ thuật cho Task 1.2, định hướng thiết kế (Task 2–3), hiện thực mã nguồn (Task 4–5) và xây dựng bộ kiểm thử.

### 1.2 Phạm vi
BrewLite là ứng dụng đặt đồ uống theo mô hình mobile-first/PWA sử dụng công nghệ Next.js, NestJS, PostgreSQL và Docker. Luồng nghiệp vụ tối thiểu đi qua hệ thống: `Xem menu → Chọn tùy chọn → Giỏ hàng → Đặt đơn → Thanh toán → Theo dõi đơn`.

* **Trong phạm vi tài liệu này (In-scope):** Toàn bộ nghiệp vụ quản lý giỏ hàng (thêm, sửa, xóa, gộp dòng, tính tạm tính, đồng bộ giá, kiểm tra tồn nguyên liệu động theo công thức) và toàn bộ yêu cầu trải nghiệm giao diện người dùng (bố cục 5 màn hình chính, trạng thái tải/rỗng/lỗi, phản hồi tương tác, PWA).
* **Ngoài phạm vi tài liệu này (Out-of-scope):** Quản lý tài khoản người dùng, xử lý cổng thanh toán trực tuyến, thực thi trừ kho trong cơ sở dữ liệu và quản lý trạng thái đơn hàng tại quầy (thuộc các nhóm chức năng khác).

### 1.3 Thuật ngữ và Ký hiệu

| Thuật ngữ | Giải thích |
| --- | --- |
| Dòng giỏ hàng (`CartItem`) | Một mục sản phẩm trong giỏ được xác định duy nhất bởi sự kết hợp của `productId`, `sizeId`, tập hợp `toppingIds` và `note`. |
| Đơn giá dòng | Giá bán một ly = Giá gốc sản phẩm + Phụ thu Size + Tổng giá các Topping. |
| Tạm tính (Subtotal) | Tổng thành tiền của tất cả các dòng sản phẩm có trong giỏ hàng. |
| MoSCoW | Mức độ ưu tiên yêu cầu: **Must** (Bắt buộc MVP), **Should** (Nên có), **Could** (Mở rộng), **Won't** (Không làm). |
| FR / NFR | Yêu cầu chức năng / Yêu cầu phi chức năng. |

### 1.4 Tài liệu tham chiếu
* Đề bài Bài tập lớn Công nghệ Phần mềm – Assignment 2 (Ver 1.0).
* `docs/requirements/context-and-scope.md` (Task 1.1).
* `docs/traceability-matrix.md` (Task 8).

---

## 2. Mô tả tổng quan

### 2.1 Actor

| Actor | Vai trò đối với phân hệ Giỏ hàng và Giao diện |
| --- | --- |
| Khách hàng (Chưa đăng nhập) | Xem menu, tùy chọn sản phẩm, thêm/sửa/xóa và quản lý giỏ hàng trên trình duyệt; bắt buộc đăng nhập khi chuyển sang bước đặt đơn. |
| Khách hàng (Đã đăng nhập) | Thực hiện đầy đủ các thao tác giỏ hàng và chuyển tiếp thành công sang màn hình xác nhận đặt đơn. |
| NestJS Backend API | Cung cấp dữ liệu danh mục, công thức nguyên liệu, tồn kho thực tế, thực hiện validate giá và nguyên liệu qua API. |

### 2.2 Giả định và ràng buộc hệ thống
* **GS-01:** Giỏ hàng tạm thời lưu trữ ở client (`state` kết hợp `localStorage`) để khách vãng lai dễ dàng thao tác mà chưa cần tạo tài khoản. Backend chịu trách nhiệm kiểm tra lại toàn bộ trước khi tạo đơn.
* **GS-02:** Đơn vị tiền tệ chuẩn là Đồng Việt Nam (VND), sử dụng số nguyên, không dùng số thập phân.
* **RB-01:** Bắt buộc tuân thủ bộ công nghệ cốt lõi: Next.js (Frontend), NestJS (Backend), PostgreSQL (Database) và Docker (Triển khai).
* **RB-02:** Ngôn ngữ giao diện chuẩn của ứng dụng trong phạm vi MVP là tiếng Việt.

---

## 3. Use-case nhóm Giỏ hàng

| Mã Use-case | Tên Use-case | Actor chính | Yêu cầu liên quan |
| :--- | :--- | :--- | :--- |
| **UC-C1** | Thêm món vào giỏ hàng | Khách hàng | FR-CART-01, 02, 03 |
| **UC-C2** | Xem giỏ hàng và tính tạm tính | Khách hàng | FR-CART-04, 06, 07 |
| **UC-C3** | Cập nhật số lượng / Tùy chọn món | Khách hàng | FR-CART-03, 05, 08 |
| **UC-C4** | Xóa sản phẩm / Làm trống giỏ | Khách hàng | FR-CART-04, 11 |
| **UC-C5** | Kiểm tra và chuyển tiếp đặt đơn | Khách hàng | FR-CART-09, 10, 13, 15 |

### 3.1 Đặc tả chi tiết: UC-C1 – Thêm món vào giỏ hàng
* **Actor:** Khách hàng, hệ thống phụ NestJS API.
* **Trigger:** Khách hàng bấm nút "Thêm vào giỏ" tại màn hình chi tiết sản phẩm (`SCR-02`).
* **Tiền điều kiện:** Sản phẩm đang mở bán, dữ liệu size và topping đã được tải về đầy đủ.
* **Hậu điều kiện:** Sản phẩm được thêm vào giỏ hàng ở client, badge số lượng trên thanh điều hướng cập nhật tăng lên.

**Luồng sự kiện chính:**
1. Khách hàng lựa chọn Size (bắt buộc), danh sách Topping (tùy chọn), nhập ghi chú và số lượng muốn mua.
2. Giao diện tự động tính toán đơn giá dòng và hiển thị thành tiền tức thời dựa trên quy tắc.
3. Khách hàng bấm "Thêm vào giỏ hàng".
4. Hệ thống kiểm tra hợp lệ: đã chọn size, số lượng $\ge 1$, tổng số topping không vượt quá 5, số lượng ly không vượt quá mức tối đa cho phép theo tồn kho nguyên liệu .
5. Hệ thống tìm kiếm các dòng hiện có trong giỏ xem có trùng khớp hoàn toàn cấu hình (`productId`, `sizeId`, danh sách `toppingIds`, `note`) hay không.
6. Nếu trùng, hệ thống cộng dồn số lượng; nếu không trùng, tạo mới một `CartItem`.
7. Lưu trạng thái giỏ vào `localStorage`, hiển thị thông báo ngắn (Toast) xác nhận thành công.

---

## 4. Yêu cầu chức năng – Phân hệ Giỏ hàng (FR-CART)

| Mã | Tên yêu cầu | MoSCoW | Tiêu chí chấp nhận kiểm chứng được (Acceptance Criteria) |
| :--- | :--- | :---: | :--- |
| **FR-CART-01** | Thêm sản phẩm kèm tùy chọn vào giỏ | **Must** | Thêm Cà phê sữa (Size M, 2 topping, SL 2) → Giỏ hàng xuất hiện chính xác 1 dòng với các thông số đã chọn. |
| **FR-CART-02** | Ràng buộc dữ liệu đầu vào khi thêm | **Must** | Chưa chọn size mà bấm thêm → Chặn thao tác và hiển thị lỗi cảnh báo cạnh nhóm chọn size. |
| **FR-CART-03** | Gộp dòng sản phẩm trùng cấu hình | **Must** | Thêm 2 lần cùng một món y hệt nhau → Tự động gộp thành 1 dòng với số lượng cộng dồn; nếu khác ghi chú → Tách thành 2 dòng riêng. |
| **FR-CART-04** | Hiển thị chi tiết danh sách giỏ hàng | **Must** | Màn hình giỏ hàng hiển thị đầy đủ: ảnh thu nhỏ, tên món, biến thể size, danh sách topping, ghi chú, đơn giá và thành tiền từng dòng. |
| **FR-CART-05** | Tăng/giảm số lượng từng dòng | **Must** | Bấm nút `+`/`-` làm thay đổi số lượng lập tức và cập nhật tổng tiền; nút `+` bị vô hiệu hóa khi chạm giới hạn `MaxCups` . |
| **FR-CART-06** | Tính toán tổng tạm tính tự động | **Must** | Mọi thay đổi về số lượng hoặc dòng sản phẩm đều làm cập nhật chính xác tổng tạm tính theo công thức. |
| **FR-CART-07** | Lưu trữ bền vững phía Client | **Must** | Thêm sản phẩm vào giỏ → Tải lại trang (F5) hoặc đóng mở lại trình duyệt → Giỏ hàng vẫn được khôi phục nguyên vẹn. |
| **FR-CART-08** | Chỉnh sửa cấu hình món trong giỏ | **Must** | Cho phép mở lại bảng tùy chỉnh để đổi Size hoặc Topping của món đang nằm trong giỏ và tự động tính lại đơn giá. |
| **FR-CART-09** | Đồng bộ và xác thực giỏ hàng qua API | **Must** | Gọi `POST /cart/validate` khi mở giỏ hàng để đối chiếu giá mới nhất và kiểm tra tình trạng nguyên liệu từ backend. |
| **FR-CART-10** | Cảnh báo khi thay đổi giá từ Server | **Must** | Nếu giá sản phẩm ở database thay đổi, hệ thống hiển thị thông báo rõ ràng tại dòng giỏ tương ứng và cập nhật lại tổng tiền. |
| **FR-CART-11** | Xóa dòng hoặc làm trống giỏ hàng | **Must** | Bấm nút xóa hoặc giảm số lượng về 0 có hộp thoại xác nhận nhanh; nút "Xóa tất cả" làm sạch giỏ về trạng thái rỗng. |
| **FR-CART-12** | Giới hạn sức chứa giỏ hàng | **Should** | Giới hạn tối đa 30 dòng sản phẩm khác nhau trong một giỏ và tối đa 5 topping cho mỗi món. |
| **FR-CART-13** | Tự động làm sạch giỏ sau khi đặt đơn | **Must** | Ngay khi nhận phản hồi tạo đơn thành công từ `POST /orders`, giỏ hàng được làm rỗng hoàn toàn ở client. |
| **FR-CART-14** | Áp dụng mã giảm giá (Preview) | **Could** | Cho phép nhập mã khuyến mãi tại giỏ để xem trước số tiền được khấu trừ trước khi sang trang thanh toán. |
| **FR-CART-15** | Kiểm tra đăng nhập khi chuyển đặt đơn | **Must** | Nhấn "Tiến hành đặt đơn": nếu chưa đăng nhập → chuyển hướng sang trang Login kèm tham số redirect; nếu đã đăng nhập → chuyển sang `/checkout`. |

---


## 5. Yêu cầu giao diện người dùng (FR-UI)

Phạm vi giao diện bao gồm 5 màn hình chính: `SCR-01` (Menu), `SCR-02` (Chi tiết sản phẩm), `SCR-03` (Giỏ hàng), `SCR-04` (Xác nhận đặt đơn), `SCR-05` (Trạng thái rỗng / Lỗi / PWA).

| Mã | Tên yêu cầu giao diện | MoSCoW | Tiêu chí chấp nhận kiểm chứng được (Acceptance Criteria) |
| :--- | :--- | :---: | :--- |
| **FR-UI-01** | Bố cục Mobile-First chuẩn PWA | **Must** | Kiểm tra trên viewport từ `360px` đến `1440px`: hiển thị mượt mà, không bị tràn màn hình hay xuất hiện thanh cuộn ngang. |
| **FR-UI-02** | Hiển thị danh mục & thẻ sản phẩm | **Must** | Dữ liệu từ `GET /products` hiển thị đúng danh mục, hình ảnh, giá và trạng thái mờ "Hết hàng" nếu nguyên liệu không đủ. |
| **FR-UI-03** | Tùy chỉnh sản phẩm (Bottom Sheet / Modal) | **Must** | Giao diện chọn size dạng radio bắt buộc, topping dạng checkbox; giá tiền thay đổi động ngay khi người dùng chọn tùy chọn. |
| **FR-UI-04** | Thanh giỏ hàng nổi (Floating Cart Bar) | **Must** | Khi `totalItems > 0`, thanh tóm tắt số lượng và tổng tiền xuất hiện cố định ở đáy màn hình Menu. |
| **FR-UI-05** | Giao diện màn hình Giỏ hàng (`SCR-03`) | **Must** | Hiển thị rõ danh sách từng dòng sản phẩm kèm nút tăng giảm số lượng, nút xóa và bảng tổng kết thanh toán ở cuối màn hình. |
| **FR-UI-06** | Trạng thái rỗng thân thiện (Empty State) | **Must** | Khi giỏ hàng trống (`totalItems == 0`), hiển thị icon minh họa, thông báo "Giỏ hàng trống" và nút bấm điều hướng quay lại Menu. |
| **FR-UI-07** | Hiển thị trạng thái Loading (Skeleton UI) | **Must** | Khi gọi API tải menu hoặc đồng bộ giỏ, hiển thị khung Skeleton thay vì màn hình trắng trơn. |
| **FR-UI-08** | Xử lý lỗi & Nút Thử lại (Error Boundary) | **Must** | Mất kết nối mạng hoặc lỗi server: hiển thị thông báo lỗi thân thiện kèm nút "Thử lại", ứng dụng không bị crash. |
| **FR-UI-09** | Phản hồi tương tác tức thì (Toast Messages) | **Should** | Thông báo ngắn xuất hiện khi thêm món thành công hoặc đạt giới hạn số lượng và tự biến mất sau 3 giây. |
| **FR-UI-10** | Hỗ trợ PWA & Web App Manifest | **Should** | Cung cấp `manifest.json`, icon chuẩn và service worker để ứng dụng đạt chuẩn cài đặt lên màn hình chính (Add to Home Screen). |
| **FR-UI-11** | Kiểm tra dữ liệu biểu mẫu trực tiếp | **Must** | Các trường nhập liệu thông báo lỗi ngay bên dưới bằng tiếng Việt khi dữ liệu không hợp lệ. |
| **FR-UI-12** | Vô hiệu hóa nút khi đang xử lý (Loading State) | **Must** | Nút bấm gửi yêu cầu đặt đơn tự động chuyển sang trạng thái loading và bị vô hiệu hóa để chặn double-click. |
| **FR-UI-13** | Hỗ trợ khả năng truy cập cơ bản (A11y) | **Could** | Vùng chạm tối thiểu trên mobile đạt chuẩn `44x44px`, độ tương phản màu chữ đạt chuẩn WCAG AA ($\ge 4.5:1$). |
| **FR-UI-14** | Đa ngôn ngữ | **Won't** | Chỉ hỗ trợ tiếng Việt cho phiên bản MVP. |

---

## 6. Yêu cầu phi chức năng (NFR-CART & NFR-UI)

| Mã | Nhóm chất lượng | Mô tả yêu cầu chi tiết | MoSCoW | Tiêu chí chấp nhận kiểm chứng được (Acceptance Criteria) |
| :--- | :--- | :--- | :---: | :--- |
| **NFR-UI-01** | Hiệu năng tải trang (Lighthouse) | Tốc độ hiển thị nội dung đầu tiên trên thiết bị di động phải nhanh. | **Must** | Đo qua Google Lighthouse Mobile: **FCP $\le 1.8\text{s}$** và **LCP $\le 2.5\text{s}$**. |
| **NFR-UI-02** | Độ mượt giao diện (INP) | Các thao tác chạm/click trên giao diện giỏ hàng phải phản hồi tức thì. | **Must** | Thời gian phản hồi tương tác **INP $\le 200\text{ms}$**; cuộn danh sách mượt mà không giật khung hình. |
| **NFR-UI-03** | Khả năng tương thích trình duyệt | Hoạt động ổn định trên các trình duyệt hiện đại phổ biến. | **Must** | Kiểm thử thành công trên Chrome (v120+), Safari (iOS 16+) và Edge mới nhất. |
| **NFR-UI-04** | Tính khả dụng (Usability Test) | Người dùng mới dễ dàng hoàn thành luồng chọn món và đưa vào giỏ. | **Should** | Thử nghiệm với 3 người dùng: 100% hoàn thành việc thêm 2 món có topping vào giỏ trong $\le 60\text{ giây}$. |
| **NFR-UI-05** | Tính nhất quán thiết kế (Design Tokens) | Giao diện sử dụng thống nhất bộ biến màu sắc, font chữ và bo góc. | **Should** | Toàn bộ component xây dựng bằng Tailwind CSS config chung, không hardcode mã màu rời rạc. |
| **NFR-CART-01** | Hiệu năng API Kiểm tra giỏ | API đồng bộ và xác thực giỏ hàng phản hồi nhanh chóng. | **Must** | Với giỏ hàng 10 dòng, thời gian phản hồi của `POST /cart/validate` (p95) **$\le 300\text{ms}$** trên môi trường Docker. |
| **NFR-CART-02** | Độ tin cậy dữ liệu Client | Tránh lỗi hỏng dữ liệu giỏ hàng (`localStorage corruption`). | **Must** | Nếu `localStorage` bị sửa sai cú pháp JSON, ứng dụng tự động bắt lỗi và reset giỏ an toàn, không làm crash app. |
| **NFR-CART-03** | Bảo mật đầu vào (XSS Sanitization) | Ngăn chặn tấn công mã độc qua trường ghi chú sản phẩm. | **Must** | Nhập payload chứa thẻ script vào ô ghi chú → Giao diện tự escape HTML an toàn. |
| **NFR-CART-04** | Tối ưu dung lượng lưu trữ | Cấu trúc dữ liệu giỏ hàng gọn nhẹ để đọc/ghi bộ nhớ nhanh. | **Should** | Kích thước JSON giỏ hàng tối đa (30 dòng) **$\le 15\text{KB}$**, thời gian đọc/ghi `localStorage` < 5ms. |

---

## 8. Mô hình dữ liệu Giỏ hàng

* **`CartItem`**: `id` (UUID), `productId`, `sizeId`, `toppingIds[]` (đã sắp xếp), `quantity`, `note`, `unitPriceSnapshot`, `addedAt`.
* **`Cart`**: `items[]` (tối đa 30 phần tử), `subtotal`.
* **Mối quan hệ dữ liệu:** Giỏ hàng nằm hoàn toàn ở client (`localStorage`). Khi tạo đơn, các `CartItem` được chuyển đổi thành danh sách `OrderItem` phía backend để lưu vào cơ sở dữ liệu PostgreSQL.

---

## 9. Ma trận truy vết (Traceability Matrix – Trích mẫu)

| Mã yêu cầu | Use-case tương ứng | Sơ đồ thiết kế liên quan | API / Thành phần mã nguồn | Test Case kiểm thử |
| :--- | :--- | :--- | :--- | :--- |
| **FR-CART-01** | UC-C1 (Thêm món) | Activity-01, Class-01 | `useCartStore.addItem()` (Next.js) | `UNIT-CART-01` (Gộp dòng trùng) |
| **FR-CART-02** | UC-C1 (Kiểm tra dữ liệu) | (`MaxCups()`) | `calculateMaxCups()` (Shared) | `UNIT-CART-02` (Chặn quá tồn kho) |
| **FR-CART-09** | UC-C5 (Đồng bộ giỏ) | Sequence-Checkout | `POST /cart/validate` (NestJS) | `INT-CART-01` (Kiểm tra validate giá/kho) |
| **FR-UI-01** | SCR-01 (Menu Responsive) | Deployment-01 | `MenuPage` (Next.js PWA) | `UI-RESP-01` (Kiểm tra đa màn hình) |
| **FR-UI-07** | SCR-01, SCR-03 (Loading) | Activity-01 | `CartSkeleton` component | `UI-STATE-01` (Kiểm tra Skeleton) |

---

## 11. Các vấn đề mở và Rủi ro (Open Issues & Risks)

| Mã | Nội dung vấn đề / Rủi ro | Hướng giải quyết đề xuất |
| :--- | :--- | :--- |
| **OI-01** | Vị trí lưu trữ giỏ hàng (Client vs Server) (`GS-01`) | Sẽ được chốt chính thức thông qua **ADR-002** trong thư mục `docs/architecture/adr/` tại Task 3.1. |
| **OI-02** | Phạm vi tích hợp mã khuyến mãi (`FR-CART-14`) | Cần thống nhất với nhóm phụ trách Đặt đơn/Thanh toán trước khi bước vào Sprint 2. |
| **OI-03** | Xác thực định lượng công thức nguyên liệu (`Recipe`) | Cần họp thống nhất cấu trúc dữ liệu trả về từ API `GET /products/:id` với nhóm Kho. |
| **RK-01** | Biến động giá hoặc hết nguyên liệu giữa lúc chọn món và lúc bấm đặt đơn. | Đã được giảm thiểu triệt để thông qua cơ chế tự động validate qua API `POST /cart/validate` (`FR-CART-09`, `FR-CART-10`). |