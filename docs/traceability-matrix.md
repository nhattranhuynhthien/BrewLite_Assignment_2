# Ma trận truy vết yêu cầu BrewLite

- **Phiên bản:** Khung khởi tạo — 2026-11-14
- **Nguồn yêu cầu chuẩn:** [SRS tổng quát](requirements/srs.md), phiên bản 1.0
- **Quyết định kiểm thử:** [ADR-006](architecture/adr/006-testing-strategy.md)

Ma trận này nối từng yêu cầu chuẩn với thiết kế, mã nguồn, kiểm thử và bằng chứng nghiệm thu. SRS là nguồn chuẩn của nội dung và mức ưu tiên; ma trận không tạo yêu cầu mới. Checkout hiện tại chưa có triển khai web/test theo SRS, vì vậy các liên kết mã nguồn, kiểm thử và bằng chứng để trống cho đến khi có hiện vật kiểm chứng.

## Quy ước mã và cập nhật

1. Dùng nguyên mã `FR-01`–`FR-39` và `NFR-01`–`NFR-20` trong SRS. Không đổi nghĩa, tái sử dụng mã hoặc lấp mã FR để trống cho một yêu cầu khác. `FR-09` được giữ là **Won't trong MVP**.
2. Tiêu chí nghiệm thu dùng mã `AC-<số FR>.<số thứ tự>` khi SRS đã định nghĩa; ví dụ `AC-17.1`. Không tạo mã AC trùng. Nếu NFR chưa có mã AC riêng, trỏ trực tiếp đến phần tiêu chí đo/nghiệm thu của NFR trong SRS.
3. Mã kiểm thử theo ADR-006: `TC-UNIT-<NHÓM>-nnn`, `TC-UI-<NHÓM>-nnn`, `TC-API-<NHÓM>-nnn`, `TC-E2E-<NHÓM>-nnn`, `TC-CONTRACT-<NHÓM>-nnn`, `TC-NFR-<NHÓM>-nnn`. Mã đã cấp không tái sử dụng; đổi tên/move test thì cập nhật ma trận cùng PR.
4. Cột **Thiết kế** ghi ADR/mục thiết kế; **Mã nguồn** ghi đường dẫn tương đối trong repo và symbol chính khi có; **Kiểm thử** ghi mã test và đường dẫn test; **Bằng chứng** ghi PR/commit, CI run hoặc báo cáo đo kiểm có thể mở lại.
5. Một yêu cầu có thể liên kết nhiều test/tệp. Dùng dấu `;` để ghi nhiều liên kết. Không ghi “đạt” chỉ vì code/test tồn tại: phải có kết quả chạy thành công cho đúng commit.
6. Cập nhật các dòng liên quan trong cùng PR khi thay đổi yêu cầu, thiết kế, mã nguồn hoặc test. Reviewer kiểm tra liên kết hai chiều: requirement có test phù hợp và test quan trọng trỏ lại requirement.

### Trạng thái truy vết

| Trạng thái | Ý nghĩa |
|---|---|
| Chưa truy vết | Chưa có đủ liên kết tới thiết kế, mã nguồn và cách xác minh. |
| Đã truy vết | Đã ghi các liên kết cần thiết; chưa có bằng chứng nghiệm thu thành công. |
| Đã triển khai | Có mã nguồn cho yêu cầu; chưa có bằng chứng xác minh đạt. |
| Đã xác minh | Tiêu chí nghiệm thu đạt trên commit được ghi tại Bằng chứng. |
| Không đạt | Đã chạy kiểm tra nhưng tiêu chí chưa đạt; ghi rõ lỗi/báo cáo. |
| Won't | Yêu cầu được quyết định ngoài phạm vi; hiện chỉ áp dụng cho FR-09 trong MVP. |

## Ma trận yêu cầu chức năng

| Mã | Ưu tiên | Thiết kế | Mã nguồn | Kiểm thử / tiêu chí | Bằng chứng | Trạng thái |
|---|---|---|---|---|---|---|
| FR-01 | Must | — | — | — | — | Chưa truy vết |
| FR-02 | Should | — | — | — | — | Chưa truy vết |
| FR-03 | Could | — | — | — | — | Chưa truy vết |
| FR-04 | Must | — | — | — | — | Chưa truy vết |
| FR-05 | Must | — | — | — | — | Chưa truy vết |
| FR-06 | Must | ADR-004 | — | — | — | Chưa truy vết |
| FR-07 | Must | ADR-004 | — | — | — | Chưa truy vết |
| FR-08 | Must | ADR-003 | — | — | — | Chưa truy vết |
| FR-09 | Won't | SRS §3.1 | — | Không kiểm thử tính năng trong MVP | — | Won't |
| FR-10 | Must | ADR-005 | — | AC-10.1 | — | Chưa truy vết |
| FR-11 | Must | ADR-005 | — | AC-11.1 | — | Chưa truy vết |
| FR-12 | Must | ADR-005 | — | AC-12.1 | — | Chưa truy vết |
| FR-13 | Must | ADR-005 | — | AC-13.1 | — | Chưa truy vết |
| FR-14 | Should | ADR-005 | — | AC-14.1 | — | Chưa truy vết |
| FR-15 | Could | ADR-005 | — | AC-15.1 | — | Chưa truy vết |
| FR-16 | Must | ADR-005 | — | AC-16.1 | — | Chưa truy vết |
| FR-17 | Should | ADR-005 | — | AC-17.1 | — | Chưa truy vết |
| FR-18 | Must | ADR-005 | — | AC-18.1 | — | Chưa truy vết |
| FR-19 | Must | ADR-005 | — | AC-19.1 | — | Chưa truy vết |
| FR-20 | Must | ADR-002 | — | — | — | Chưa truy vết |
| FR-21 | Must | ADR-002 | — | — | — | Chưa truy vết |
| FR-22 | Must | ADR-002, ADR-004 | — | — | — | Chưa truy vết |
| FR-23 | Must | ADR-002 | — | — | — | Chưa truy vết |
| FR-24 | Must | ADR-002 | — | — | — | Chưa truy vết |
| FR-25 | Must | ADR-004 | — | — | — | Chưa truy vết |
| FR-26 | Must | ADR-004 | — | — | — | Chưa truy vết |
| FR-27 | Must | ADR-004 | — | — | — | Chưa truy vết |
| FR-28 | Must | ADR-004 | — | — | — | Chưa truy vết |
| FR-29 | Must | ADR-004 | — | — | — | Chưa truy vết |
| FR-30 | Must | ADR-004 | — | — | — | Chưa truy vết |
| FR-31 | Should | ADR-004 | — | — | — | Chưa truy vết |
| FR-32 | Should | ADR-004 | — | — | — | Chưa truy vết |
| FR-33 | Must | ADR-005 | — | — | — | Chưa truy vết |
| FR-34 | Could | ADR-004 | — | — | — | Chưa truy vết |
| FR-35 | Must | — | — | — | — | Chưa truy vết |
| FR-36 | Must | — | — | — | — | Chưa truy vết |
| FR-37 | Must | — | — | — | — | Chưa truy vết |
| FR-38 | Must | — | — | — | — | Chưa truy vết |
| FR-39 | Must | — | — | — | — | Chưa truy vết |

## Ma trận yêu cầu phi chức năng

| Mã | Ưu tiên | Thiết kế | Mã nguồn | Kiểm thử / tiêu chí | Bằng chứng | Trạng thái |
|---|---|---|---|---|---|---|
| NFR-01 | Should | — | — | — | — | Chưa truy vết |
| NFR-02 | Should | ADR-004 | — | — | — | Chưa truy vết |
| NFR-03 | Should | — | — | — | — | Chưa truy vết |
| NFR-04 | Must | ADR-005 | — | — | — | Chưa truy vết |
| NFR-05 | Should | — | — | — | — | Chưa truy vết |
| NFR-06 | Must | ADR-004, ADR-005 | — | — | — | Chưa truy vết |
| NFR-07 | Must | ADR-002 | — | — | — | Chưa truy vết |
| NFR-08 | Must | ADR-004 | — | — | — | Chưa truy vết |
| NFR-09 | Must | ADR-005 | — | — | — | Chưa truy vết |
| NFR-10 | Must | ADR-005 | — | — | — | Chưa truy vết |
| NFR-11 | Must | ADR-005 | — | — | — | Chưa truy vết |
| NFR-12 | Must | — | — | — | — | Chưa truy vết |
| NFR-13 | Must | ADR-006 | — | — | — | Chưa truy vết |
| NFR-14 | Must | ADR-006 | — | — | — | Chưa truy vết |
| NFR-15 | Must | ADR-001 | — | — | — | Chưa truy vết |
| NFR-16 | Must | — | — | — | — | Chưa truy vết |
| NFR-17 | Must | ADR-002 | — | — | — | Chưa truy vết |
| NFR-18 | Must | ADR-001 | — | — | — | Chưa truy vết |
| NFR-19 | Must | ADR-001 | — | — | — | Chưa truy vết |
| NFR-20 | Must | ADR-006 | — | — | — | Chưa truy vết |
