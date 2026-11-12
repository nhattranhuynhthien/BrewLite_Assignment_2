# ĐẶC TẢ YÊU CẦU PHI CHỨC NĂNG – TRIỂN KHAI VÀ VẬN HÀNH

## Deployment & Operational Non-Functional Requirements

* **Mã công việc:** I-06 (D-07) – Thuộc Task 1.2 & Sprint 0
* **Người thực hiện:** TV1 (Tech Lead / DevOps)
* **Người duyệt (Reviewer):** TV2 (Backend – Auth & User)
* **Trạng thái:** Chờ Review

### 1. Mục tiêu và phạm vi

Tài liệu đặc tả yêu cầu triển khai và vận hành của **BrewLite**, căn cứ Assignment 2, phiên bản 1.0: Task 3.1–3.2, Task 4.1 và 4.4, Task 5.2–5.4. Đây là phần yêu cầu về khả năng triển khai trong SRS của Task 1.2; các nhóm yêu cầu khác được đặc tả riêng.

Các yêu cầu có mức **Must** vì phục vụ các tạo phẩm bắt buộc của đề. Nhóm chọn các cam kết kỹ thuật sau để cụ thể hóa việc nghiệm thu:

- GitHub Actions cho CI/CD; Docker Compose chạy Next.js, NestJS và PostgreSQL ở local.
- `GET /health` kiểm tra API và kết nối database; smoke test sau triển khai gọi `/health` và `/products`.
- Nền tảng production được xác định ở Task 3; deployment diagram phải phản ánh hạ tầng thực tế. Chỉ bắt buộc push image lên registry nếu nền tảng yêu cầu.

Các lựa chọn trên là cam kết của nhóm. Mã công việc, phân công và Sprint 0 là thông tin quản lý nội bộ. Mã `NFR-DEP-*` được giữ để truy vết trong tài liệu này; khi tích hợp vào SRS chung, nhóm phải ánh xạ sang mã `NFR-01`, `NFR-02`, … theo Task 1.2 và cập nhật các liên kết liên quan.

### 2. Yêu cầu và tiêu chí chấp nhận

| Mã NFR | Nhóm yêu cầu | Mô tả yêu cầu | MoSCoW | Tiêu chí chấp nhận |
| :--- | :--- | :--- | :---: | :--- |
| **NFR-DEP-01** | **Continuous Integration** | CI tự động kiểm tra mã nguồn khi mở hoặc cập nhật pull request vào `main`. | **Must** | 1. Pipeline thực hiện `Install → Lint → Unit Test → Build` cho `apps/web` và `apps/api`.<br>2. PR không được merge nếu lint, test hoặc build thất bại; các kiểm tra bắt buộc phải hoàn thành thành công trước khi merge.<br>3. Có link PR và ảnh hoặc log của một lần CI thành công, một lần CI phát hiện lỗi. |
| **NFR-DEP-02** | **Chạy local và tái tạo database** | Hệ thống chạy ở local bằng Docker Compose; database có thể khởi tạo lại bằng migration/seed. | **Must** | 1. Có `docker-compose.yml` tại thư mục gốc chạy ba service `web`, `api`, `db` và cấu hình build Docker cho các ứng dụng.<br>2. Từ bản clone mới, người dùng làm theo README để cấu hình môi trường, build/khởi chạy các service và chạy migration/seed trên database rỗng.<br>3. Sau các bước trên, trang menu truy cập được, API `/products` trả HTTP 200 cùng dữ liệu mẫu; PostgreSQL lưu dữ liệu bằng persistent volume. |
| **NFR-DEP-03** | **Health check** | Backend cung cấp health endpoint phục vụ kiểm tra sau triển khai. | **Must** | 1. `GET /health` trả HTTP 200 khi API hoạt động và kết nối được PostgreSQL.<br>2. Khi ngắt kết nối database trong môi trường kiểm thử, endpoint trả HTTP 503.<br>3. URL health check production được ghi trong README và được gọi trong pipeline sau triển khai. |
| **NFR-DEP-04** | **Logging** | Backend có log phục vụ theo dõi hoạt động và điều tra lỗi, không làm lộ secret. | **Must** | 1. Log có thời gian, mức độ và thông điệp; có hướng dẫn xem log trên môi trường triển khai.<br>2. Khi tạo một lỗi API trong môi trường kiểm thử, có log lỗi tương ứng để xác định nguyên nhân.<br>3. Log không chứa mật khẩu, JWT, secret kết nối hoặc dữ liệu nhạy cảm của thanh toán mô phỏng; kiểm tra cả luồng thành công và luồng lỗi. |
| **NFR-DEP-05** | **Cấu hình và secrets** | Cấu hình môi trường và secret được cấp từ bên ngoài mã nguồn; secret thật không xuất hiện trong repository hoặc log CI/CD. | **Must** | 1. Có `.env.example` liệt kê các biến cần thiết và giá trị mẫu hoặc placeholder, kèm hướng dẫn cấu hình trong README.<br>2. `.gitignore` loại trừ các file môi trường chứa secret thật; các file này không được theo dõi trong Git.<br>3. CI dùng cơ chế quản lý secrets để triển khai; production nhận cấu hình qua cơ chế cấu hình của nền tảng.<br>4. Rà soát mã nguồn, lịch sử Git và log CI/CD không phát hiện secret thật. |
| **NFR-DEP-06** | **Continuous Delivery/Deployment và rollback** | Pipeline triển khai từ push/tag, có quality gate, Docker image theo phiên bản, migration và kiểm tra sau triển khai. | **Must** | 1. Workflow xác định rõ push/tag kích hoạt triển khai; phiên bản triển khai phải vượt qua lint, test và build.<br>2. Tạo Docker image có tag theo commit SHA hoặc semantic version; push registry nếu nền tảng yêu cầu.<br>3. Triển khai bằng secret của CI. Migration có hướng dẫn thực hiện và xử lý thất bại; nếu migration thất bại, pipeline dừng và không tiếp tục kích hoạt phiên bản mới.<br>4. Sau triển khai, smoke test gọi `/health` và `/products`, kiểm tra HTTP 200; kết quả được lưu trong log pipeline.<br>5. Khi triển khai hoặc smoke test thất bại, pipeline báo lỗi và dừng. Có hướng dẫn rollback về phiên bản ổn định trước đó, nêu cách xử lý tương thích database nếu có migration; cho phép rollback thủ công. |
| **NFR-DEP-07** | **Môi trường production** | Có phiên bản production truy cập được và database không public trực tiếp. | **Must** | 1. Frontend truy cập được qua HTTPS; cung cấp URL API và health check hoạt động tại thời điểm nghiệm thu.<br>2. PostgreSQL production có persistent storage và không public trực tiếp ra Internet; API và tiến trình migration kết nối bằng cấu hình được cấp quyền.<br>3. Deployment diagram thể hiện đúng dịch vụ, kết nối, cổng, cấu hình, health check, log và ranh giới local/CI/production của nền tảng thực tế. |
| **NFR-DEP-08** | **Hướng dẫn vận hành và bàn giao** | Phiên bản bàn giao có thông tin phát hành và hướng dẫn đủ để người ngoài nhóm chạy và kiểm tra hệ thống. | **Must** | 1. Có release/tag phiên bản và release notes mô tả nội dung phát hành.<br>2. README hướng dẫn chạy local, test, build, deploy và rollback; có thể dẫn đến `docs/deployment.md` cho các bước chi tiết.<br>3. Người ngoài nhóm có thể clone repository, chạy hệ thống theo README và truy cập production từ các URL được cung cấp. |

### 3. Căn cứ và minh chứng dự kiến

Bảng dưới đây hỗ trợ đối chiếu với đề bài, không xác nhận các tạo phẩm đã hoàn thành. Khi triển khai, bổ sung đường dẫn code, mã test và link minh chứng thực tế vào `docs/traceability-matrix.md` theo mục 8.1 của đề, bao gồm các cột Mã yêu cầu, Use-case/User Story, Thiết kế/Sơ đồ, Code/API và Test.

| Mã NFR | Căn cứ Assignment 2 | Tạo phẩm liên quan | Kiểm tra / Minh chứng |
| :--- | :--- | :--- | :--- |
| **NFR-DEP-01** | Task 4.4 | Workflow CI, cấu hình chặn merge | Link PR, CI xanh/đỏ, kiểm tra PR lỗi bị chặn merge |
| **NFR-DEP-02** | Task 5.2, 5.4 | Dockerfile, `docker-compose.yml`, migration/seed, README | Chạy từ bản clone mới và database rỗng, truy cập menu và `/products` |
| **NFR-DEP-03** | Task 3.1, 5.2–5.4 | Health endpoint, workflow triển khai | HTTP 200/503 trong kiểm thử, health check production |
| **NFR-DEP-04** | Task 3.1–3.2 | Cấu hình logging, hướng dẫn xem log | Log hoạt động/lỗi và rà soát dữ liệu nhạy cảm |
| **NFR-DEP-05** | Task 3.1–3.2, 4.1, 5.3–5.4 | `.env.example`, `.gitignore`, cấu hình CI/production | Rà soát repository, lịch sử Git và log CI/CD |
| **NFR-DEP-06** | Task 5.3 | Workflow CD, Docker image, migration, `docs/deployment.md` | Log quality gate, build/deploy và smoke test; hướng dẫn rollback |
| **NFR-DEP-07** | Task 3.2, 5.4 | Deployment diagram, hạ tầng production | URL hoạt động, cấu hình persistent storage và bằng chứng DB không public trực tiếp |
| **NFR-DEP-08** | Task 5.4 | Release/tag, release notes, README, `docs/deployment.md` | Đối chiếu hướng dẫn với quá trình chạy thử và URL production |

Các nội dung bàn giao khác của Task 5.4 như video/demo, Sprint Review và Sprint Retrospective được quản lý trong checklist bàn giao chung của dự án.
