# Ma trận truy vết yêu cầu — BrewLite

- **Công việc:** D-21 — khởi tạo khung và quy ước mã; TV6 phụ trách, TV5 review.
- **Trạng thái:** Khung khởi tạo, chờ review.
- **Ngày:** 2026-11-14.
- **Baseline:** `main@18c082e`.
- **Nguồn:** Mẫu 5 cột tại mục 8.1 của đề Assignment 2; [SRS](requirements/srs.md); [chiến lược kiểm thử ADR-006](architecture/adr/006-testing-strategy.md).

## 1. Phạm vi và cách sử dụng

Ma trận nối yêu cầu với use-case/user story, thiết kế, mã nguồn/API và kiểm thử. D-21 tạo cấu trúc để nhóm cập nhật trong quá trình triển khai; hoàn thiện các liên kết và minh chứng thuộc S2-37.

Các dòng được khởi tạo theo 39 FR và 20 NFR trong bảng yêu cầu của SRS. Phần quy ước đầu SRS hiện chỉ ghi đến NFR-14, nhưng bảng chi tiết có NFR-15–NFR-20; giữ đủ các mã đã được định nghĩa trong bảng, không tự đánh số lại.

- `TBD`: chưa điền hoặc chưa xác minh liên kết, không có nghĩa là yêu cầu đã hoàn thành.
- `N/A — lý do`: không áp dụng và phải ghi lý do cụ thể. Không dùng N/A để thay cho công việc chưa làm.
- FR-09 là Won't trong MVP theo SRS, được giữ để truy vết quyết định phạm vi. Các yêu cầu Could vẫn được giữ; nếu không triển khai, cập nhật quyết định phạm vi đã được nhóm thống nhất.
- Một yêu cầu có một dòng; nhiều tạo phẩm trong cùng ô phân cách bằng dấu chấm phẩy. Một tạo phẩm hoặc test có thể xuất hiện ở nhiều dòng nếu thực sự đáp ứng các yêu cầu đó.
- Khi điền, dùng liên kết tới file/mục cụ thể. Code/API phải trỏ tới mã thực hiện; tên endpoint trong thiết kế chưa phải minh chứng triển khai. Test phải có mã và liên kết tới test case/file test; kết quả chạy ghi kèm link báo cáo/CI khi có.
- Với NFR áp dụng toàn hệ thống, mô tả phạm vi đó trong cột Use-case/User Story; không tạo use-case giả chỉ để lấp ô.
- Cập nhật ma trận cùng PR thay đổi yêu cầu, thiết kế, code hoặc test; giữ nguyên mã đã cấp, không tái sử dụng mã đã bỏ.

Tại baseline này, `apps/web`, `apps/api` và `tests` chỉ có `.gitkeep`. Khung không khẳng định đã có code, test hoặc kết quả kiểm thử.

## 2. Quy ước mã

| Đối tượng | Quy ước |
|---|---|
| Yêu cầu chức năng | `FR-NN`, giữ nguyên mã và ý nghĩa tại SRS. |
| Yêu cầu phi chức năng | `NFR-NN`, giữ nguyên mã tại bảng NFR của SRS. |
| Use-case | `UC-NN`, dùng UC-01–UC-06 đã định nghĩa tại mục 5 của SRS; không lấy mã ví dụ trong đề thay cho mã dự án. |
| User story | `US-NN`; chỉ điền khi story đã có trong backlog và kèm liên kết. Không suy ra mã US từ mã UC/FR. |
| Thiết kế/Sơ đồ | Dùng tên file nguồn và tên sơ đồ/mục tương ứng, ví dụ `sequence-checkout.puml`; ADR dùng `ADR-NNN` theo file quyết định hiện hành. Không tự tạo mã sơ đồ khác với tài liệu nguồn. |
| Code/API | Ghi đường dẫn file và hàm/module liên quan; nếu có API, ghi thêm `METHOD /path` cùng liên kết mã xử lý. UI, migration, job và CI dùng đường dẫn tạo phẩm tương ứng, không bắt buộc phải có endpoint. |
| Unit test | `UNIT-TNN`, gồm logic backend và unit/component web theo ADR-006. |
| Integration test | `INT-TNN`, gồm các ca API/module/database theo ADR-006. |
| End-to-end test | `E2E-TNN`, cho luồng qua trình duyệt, web, API và database. |
| Kiểm thử bổ sung | `PERF-TNN` cho đo hiệu năng; `MAN-TNN` cho ca kiểm tra thủ công khi phù hợp với NFR. Không thay thế ba mức kiểm thử đã chọn. |

`NN` là số thứ tự tối thiểu hai chữ số trong từng nhóm; `NNN` là số ADR tối thiểu ba chữ số. Mã test duy nhất trong từng nhóm, được cấp khi tạo test case; ghi mã FR/NFR liên quan trong tên hoặc mô tả test theo ADR-006. Các mẫu mã trên là quy ước, chưa phải test đã tồn tại. Các mã `API-T01`, `INT-T03` và các ánh xạ FR trong đề chỉ là ví dụ minh họa.

## 3. Khung ma trận

Giữ đúng năm cột của mẫu đề. Các ô TBD sẽ được thay bằng liên kết đã xác minh khi nhóm cập nhật truy vết.

| Mã yêu cầu | Use-case/User Story | Thiết kế/Sơ đồ | Code/API | Test |
|---|---|---|---|---|
| FR-01 | TBD | TBD | TBD | TBD |
| FR-02 | TBD | TBD | TBD | TBD |
| FR-03 | TBD | TBD | TBD | TBD |
| FR-04 | TBD | TBD | TBD | TBD |
| FR-05 | TBD | TBD | TBD | TBD |
| FR-06 | TBD | TBD | TBD | TBD |
| FR-07 | TBD | TBD | TBD | TBD |
| FR-08 | TBD | TBD | TBD | TBD |
| FR-09 | N/A — Won't trong MVP theo SRS | N/A — ngoài MVP | N/A — ngoài MVP | N/A — ngoài MVP |
| FR-10 | TBD | TBD | TBD | TBD |
| FR-11 | TBD | TBD | TBD | TBD |
| FR-12 | TBD | TBD | TBD | TBD |
| FR-13 | TBD | TBD | TBD | TBD |
| FR-14 | TBD | TBD | TBD | TBD |
| FR-15 | TBD | TBD | TBD | TBD |
| FR-16 | TBD | TBD | TBD | TBD |
| FR-17 | TBD | TBD | TBD | TBD |
| FR-18 | TBD | TBD | TBD | TBD |
| FR-19 | TBD | TBD | TBD | TBD |
| FR-20 | TBD | TBD | TBD | TBD |
| FR-21 | TBD | TBD | TBD | TBD |
| FR-22 | TBD | TBD | TBD | TBD |
| FR-23 | TBD | TBD | TBD | TBD |
| FR-24 | TBD | TBD | TBD | TBD |
| FR-25 | TBD | TBD | TBD | TBD |
| FR-26 | TBD | TBD | TBD | TBD |
| FR-27 | TBD | TBD | TBD | TBD |
| FR-28 | TBD | TBD | TBD | TBD |
| FR-29 | TBD | TBD | TBD | TBD |
| FR-30 | TBD | TBD | TBD | TBD |
| FR-31 | TBD | TBD | TBD | TBD |
| FR-32 | TBD | TBD | TBD | TBD |
| FR-33 | TBD | TBD | TBD | TBD |
| FR-34 | TBD | TBD | TBD | TBD |
| FR-35 | TBD | TBD | TBD | TBD |
| FR-36 | TBD | TBD | TBD | TBD |
| FR-37 | TBD | TBD | TBD | TBD |
| FR-38 | TBD | TBD | TBD | TBD |
| FR-39 | TBD | TBD | TBD | TBD |
| NFR-01 | TBD | TBD | TBD | TBD |
| NFR-02 | TBD | TBD | TBD | TBD |
| NFR-03 | TBD | TBD | TBD | TBD |
| NFR-04 | TBD | TBD | TBD | TBD |
| NFR-05 | TBD | TBD | TBD | TBD |
| NFR-06 | TBD | TBD | TBD | TBD |
| NFR-07 | TBD | TBD | TBD | TBD |
| NFR-08 | TBD | TBD | TBD | TBD |
| NFR-09 | TBD | TBD | TBD | TBD |
| NFR-10 | TBD | TBD | TBD | TBD |
| NFR-11 | TBD | TBD | TBD | TBD |
| NFR-12 | TBD | TBD | TBD | TBD |
| NFR-13 | TBD | TBD | TBD | TBD |
| NFR-14 | TBD | TBD | TBD | TBD |
| NFR-15 | TBD | TBD | TBD | TBD |
| NFR-16 | TBD | TBD | TBD | TBD |
| NFR-17 | TBD | TBD | TBD | TBD |
| NFR-18 | TBD | TBD | TBD | TBD |
| NFR-19 | TBD | TBD | TBD | TBD |
| NFR-20 | TBD | TBD | TBD | TBD |
