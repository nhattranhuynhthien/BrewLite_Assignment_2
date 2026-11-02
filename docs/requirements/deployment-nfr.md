# ĐẶC TẢ YÊU CẦU PHI CHỨC NĂNG – KHẢ NĂNG TRIỂN KHAI VÀ VẬN HÀNH
## (Deployment & Operational Non-Functional Requirements)

* **Mã công việc:** I-06 (D-07) – Thuộc Task 1.2 & Sprint 0
* **Người thực hiện:** TV1 (Tech Lead / DevOps)
* **Người duyệt (Reviewer):** TV2 (Backend – Auth & User)
* **Trạng thái:** Chờ Review

---

### 1. Tổng quan mục tiêu
Tài liệu này đặc tả các Yêu cầu Phi chức năng (Non-Functional Requirements - NFR) liên quan đến khả năng đóng gói, kiểm thử tự động, tích hợp/triển khai liên tục (CI/CD), giám sát sức khỏe hệ thống và an toàn vận hành cho hệ thống **BrewLite**. Các yêu cầu này được xây dựng bám sát đề bài Assignment 2 (Công nghệ phần mềm) và làm cơ sở thiết kế kiến trúc (Task 3) cũng như thiết lập pipeline CI/CD (Task 4 & Task 5).

---

### 2. Danh mục Yêu cầu Phi chức năng Khả năng Triển khai (Deployment NFRs)

| Mã NFR | Phân nhóm | Mô tả yêu cầu | Mức MoSCoW | Tiêu chí chấp nhận (Acceptance Criteria) |
| :--- | :--- | :--- | :---: | :--- |
| **NFR-DEP-01** | **Tự động hóa CI (Continuous Integration)** | Hệ thống phải tự động kích hoạt pipeline kiểm tra chất lượng mã nguồn trên GitHub Actions mỗi khi có Pull Request được mở hoặc cập nhật vào nhánh `main`. | **Must** | 1. Pipeline thực hiện tuần tự và độc lập 4 bước: `Install dependencies` $\rightarrow$ `Lint check` $\rightarrow$ `Unit Test` $\rightarrow$ `Build`.<br>2. Pipeline chạy cho cả hai ứng dụng `apps/web` và `apps/api`.<br>3. Bắt buộc có Branch Protection Rule: PR bị chặn merge nếu bất kỳ bước nào trong pipeline thất bại (đạt minh chứng 1 lần xanh, 1 lần đỏ theo yêu cầu Task 4.4). |
| **NFR-DEP-02** | **Container hóa (Containerization)** | Cả hai ứng dụng Frontend (`apps/web`) và Backend (`apps/api`) phải được đóng gói độc lập bằng Docker container với kích thước tối ưu (multi-stage build) và có thể khởi chạy đồng bộ môi trường cục bộ thông qua Docker Compose. | **Must** | 1. Tồn tại `Dockerfile` chuẩn cho `apps/web` và `apps/api`. Lệnh `docker build` thành công, không phát sinh lỗi dependency.<br>2. File `docker-compose.yml` tại thư mục gốc khởi chạy thành công đồng thời 3 service: `web`, `api`, và `db` (PostgreSQL với persistent volume) chỉ bằng 1 lệnh `docker compose up`.<br>3. Người dùng mới clone repo về có thể chạy hệ thống chỉ bằng việc sao chép file `.env.example` thành `.env` và chạy docker-compose. |
| **NFR-DEP-03** | **Kiểm tra Sức khỏe Hệ thống (Health Check)** | Backend NestJS phải cung cấp endpoint kiểm tra trạng thái khả dụng của hệ thống để phục vụ cho bộ cân bằng tải, giám sát container và script smoke test sau triển khai. | **Must** | 1. Endpoint `GET /health` trả về mã HTTP `200 OK` kèm payload JSON có cấu trúc (ví dụ: `status: "ok"`, `timestamp`, `services: { database: "up" }`) khi cả API và Database PostgreSQL hoạt động bình thường.<br>2. Endpoint trả về mã HTTP `503 Service Unavailable` nếu mất kết nối tới cơ sở dữ liệu.<br>3. Thời gian phản hồi của `GET /health` không vượt quá 300ms trong điều kiện mạng nội bộ. |
| **NFR-DEP-04** | **Ghi nhật ký có cấu trúc (Structured Logging)** | Hệ thống backend phải ghi nhận log hoạt động, xử lý lỗi và các sự kiện nghiệp vụ dưới dạng có cấu trúc; tuyệt đối không làm rò rỉ dữ liệu nhạy cảm. | **Must** | 1. Toàn bộ log của API phải được định dạng chuẩn (thời gian, log level: `INFO/WARN/ERROR`, context module, message).<br>2. Tuyệt đối không ghi mật khẩu người dùng, mã OTP, token JWT hoặc thông tin thẻ/ví thanh toán ra log console hoặc file log (đáp ứng tiêu chuẩn bảo mật).<br>3. Mọi lỗi không xử lý (uncaught exceptions, HTTP 500) phải được log đầy đủ stack trace để phục vụ điều tra sự cố. |
| **NFR-DEP-05** | **Quản lý Cấu hình và Bí mật (Config & Secrets Management)** | Toàn bộ thông số cấu hình và chuỗi kết nối nhạy cảm phải được quản lý tập trung qua biến môi trường (Environment Variables), nghiêm cấm hardcode vào mã nguồn. | **Must** | 1. Cung cấp file `.env.example` đầy đủ các biến cấu hình mẫu (DB, Port, JWT Secret demo, Payment Secret demo) với giá trị an toàn cho môi trường phát triển.<br>2. File `.gitignore` phải chặn tuyệt đối các file cấu hình thật (`.env`, `.env.local`, `.env.production`).<br>3. Môi trường CI/CD và Production phải lấy cấu hình thông qua GitHub Actions Secrets và biến môi trường của nền tảng Cloud (Render/Railway/VPS), không xuất hiện trong git commit history. |
| **NFR-DEP-06** | **Tự động hóa Triển khai (Continuous Deployment & Rollback)** | Pipeline CD phải tự động đóng gói Docker image, đẩy lên Container Registry và cập nhật lên môi trường Production an toàn khi có tag phiên bản hoặc push vào `main`. | **Must** | 1. Docker image được gắn nhãn (tag) rõ ràng theo commit SHA hoặc Semantic Versioning (ví dụ: `v1.0.0`).<br>2. Quá trình triển khai tự động thực thi database migration an toàn trước khi kích hoạt phiên bản code mới.<br>3. Pipeline tự động kích hoạt kịch bản **Smoke Test** (gọi `GET /health` và `GET /products`) ngay sau deploy; nếu thất bại thì dừng pipeline và cung cấp quy trình rollback về phiên bản ổn định trước đó. |
| **NFR-DEP-07** | **An toàn Môi trường Production** | Môi trường Production thực tế phải đảm bảo an toàn kết nối và cô lập dữ liệu theo quy định của đồ án. | **Must** | 1. URL của Frontend và API trên Production bắt buộc phải truy cập thông qua giao thức bảo mật **HTTPS** (có chứng chỉ SSL/TLS hợp lệ).<br>2. Cơ sở dữ liệu PostgreSQL Production được thiết lập trong mạng riêng (Private Network), tuyệt đối không mở cổng trực tiếp ra internet công cộng (chỉ cho phép API container kết nối nội bộ). |

---

### 3. Ma trận Ánh xạ (Traceability Mapping)
Các yêu cầu phi chức năng trên sẽ được ánh xạ trực tiếp vào các tạo phẩm kỹ thuật tiếp theo của nhóm:

| Mã NFR | Tạo phẩm Kiến trúc (Task 3) | Mã nguồn & Module (Task 4 & 5) | Test & Minh chứng |
| :--- | :--- | :--- | :--- |
| **NFR-DEP-01** | ADR 001 (Monorepo & CI/CD) | `.github/workflows/ci.yml` | Minh chứng CI Xanh & Đỏ (PR Issue I-18) |
| **NFR-DEP-02** | ADR 001, Deployment Diagram | `apps/web/Dockerfile`, `apps/api/Dockerfile`, `docker-compose.yml` | Lệnh `docker compose up` chạy thành công local |
| **NFR-DEP-03** | Mô tả C4/Phân lớp (D-13) | `apps/api/src/modules/health/` | Endpoint `GET /health` trả về 200/503 |
| **NFR-DEP-04** | Mô tả C4/Phân lớp (D-13) | Logger interceptor / NestJS Logger | Rà soát log không có secret / credential |
| **NFR-DEP-05** | ADR 002 (Bảo mật & Secrets) | `.env.example`, ConfigModule | Quét rà soát git history & GitHub Secrets |
| **NFR-DEP-06** | ADR 001, Deployment Diagram | `.github/workflows/cd.yml`, `docs/deployment.md` | Biên bản diễn tập rollback (Issue I-34) |
| **NFR-DEP-07** | Deployment Diagram (D-20) | Hạ tầng Cloud Production (Render/Railway/VPS) | URL HTTPS thực tế hoạt động lúc chấm bài |

---
*Tài liệu được khởi tạo và cam kết bởi TV1 (Tech Lead / DevOps) theo đúng quy định Assignment 2.*
