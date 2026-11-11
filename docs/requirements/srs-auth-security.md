# SRS rút gọn – Xác thực và bảo mật

| Mục                | Nội dung                                                                                                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Task               | 1.2 – Yêu cầu chức năng và phi chức
năng                                                                                                     |
| Phiên bản          | 0.1 (bản nháp để review)                                                                                                                     |
| Phụ trách          | TV2 – Backend Auth & User                                                                                                                    |
| Phạm vi            | Tài khoản người dùng, đăng nhập, JWT, phân quyền và bảo vệ dữ liệu xác thực                                                                  |
| Tài liệu liên quan | [Bối cảnh và phạm vi](./context-and-scope.md), [SRS Menu và sản phẩm](./srs-menu-product.md), [Class diagram](../diagrams/class-domain.puml) |

> **Mã yêu cầu tạm thời:** FR-20–FR-29 theo dải đề xuất cho nhóm xác thực. NFR-05–NFR-11 tiếp nối dải NFR-01–NFR-04 trong SRS menu hiện tại. Cần rà soát và chốt lại mã khi hợp nhất SRS chung.

## 1. Phạm vi và giả định

- Khách có thể xem menu không cần đăng nhập; cần đăng nhập để tạo đơn hàng và xem dữ liệu cá nhân.
- Vai trò MVP gồm `CUSTOMER` và `STAFF`, theo class diagram.
- Khách tự đăng ký tài khoản với vai trò `CUSTOMER`. Đăng ký công khai không được tự chọn hoặc tự nâng vai trò lên `STAFF`.
- API dùng access token dạng Bearer JWT. Cơ chế refresh token, quên/đặt lại mật khẩu và xác minh email chưa thuộc phạm vi bản SRS này; nhóm cần bổ sung nếu quyết định đưa vào MVP.
- Endpoint dưới đây là hợp đồng đề xuất để thống nhất với các nhóm frontend, order và CI trước khi triển khai.

## 2. Yêu cầu chức năng(FR)

| Mã    | Yêu cầu                                                                                                                                                                    | MoSCoW | API / Thành phần                 | Nguồn      |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------- | ---------- |
| FR-20 | Khách đăng ký bằng email, mật khẩu và họ tên; số điện thoại là tùy chọn. Email phải hợp lệ và chưa được tài khoản khác sử dụng.                                            | Must   | `POST /auth/register`            | S1         |
| FR-21 | Người dùng đăng nhập bằng email và mật khẩu; thông tin hợp lệ thì nhận access token JWT và thông tin hồ sơ cơ bản.                                                         | Must   | `POST /auth/login`               | S1, S2     |
| FR-22 | Hệ thống kiểm tra đầu vào đăng ký: email đúng định dạng, họ tên không rỗng sau khi trim, mật khẩu dài ít nhất 8 ký tự.                                                     | Must   | DTO validation                   | S1, S5     |
| FR-23 | Hệ thống cấp JWT có `sub` là ID người dùng, có role, thời hạn hết hạn; token phải được ký và kiểm tra bằng cấu hình bí mật của môi trường.                                 | Must   | JWT service                      | S1, S5     |
| FR-24 | Người dùng truy cập endpoint yêu cầu đăng nhập phải gửi JWT hợp lệ; API cung cấp endpoint xem hồ sơ của tài khoản hiện tại.                                                | Must   | JWT guard; `GET /auth/me`        | S1         |
| FR-25 | Hệ thống kiểm tra quyền theo role; chỉ `STAFF` được gọi các endpoint dành riêng cho nhân viên.                                                                             | Must   | Role guard / decorator           | S2, S3     |
| FR-26 | Hệ thống chỉ cho đăng ký công khai với role `CUSTOMER`; role `STAFF` chỉ được gán bởi quy trình quản trị được nhóm thống nhất, không lấy role từ payload đăng ký.          | Must   | Auth service / user provisioning | S1, S2, S5 |
| FR-27 | Phản hồi đăng ký và hồ sơ không bao giờ trả `passwordHash` hoặc mật khẩu; lỗi xác thực không tiết lộ mật khẩu, hash hoặc thông tin bí mật khác.                            | Must   | Auth API                         | S1, S5     |
| FR-28 | Đăng nhập sai email hoặc mật khẩu trả lỗi xác thực chung, không phân biệt tài khoản không tồn tại với mật khẩu sai.                                                        | Must   | `POST /auth/login`               | S1, S5     |
| FR-29 | Các endpoint công khai của hệ thống (ví dụ menu và đăng nhập/đăng ký) và endpoint được bảo vệ có hợp đồng xác thực rõ ràng để frontend biết endpoint nào cần Bearer token. | Should | Swagger/OpenAPI                  | S1, S5     |

### 2.1 Hợp đồng request/response đề xuất

**`POST /auth/register`**

Request:

```json
{
  "email": "customer@example.com",
  "password": "example-password",
  "fullName": "Nguyen Van A",
  "phone": "0900000000"
}
```

Thành công: HTTP `201`, trả thông tin hồ sơ công khai (không có `passwordHash`). Bản MVP không tự đăng nhập sau đăng ký; người dùng gọi `/auth/login` để nhận token.

**`POST /auth/login`**

Request:

```json
{
  "email": "customer@example.com",
  "password": "example-password"
}
```

Thành công: HTTP `200`, trả `accessToken`, `tokenType: "Bearer"`, thời điểm/thời lượng hết hạn và hồ sơ công khai.

**`GET /auth/me`**

Yêu cầu header `Authorization: Bearer <accessToken>`. Thành công: HTTP `200` và hồ sơ của chủ thể trong token.

Response mẫu cho hồ sơ công khai:

```json
{
  "id": "uuid",
  "email": "customer@example.com",
  "fullName": "Nguyen Van A",
  "phone": "0900000000",
  "role": "CUSTOMER"
}
```

## 3. Yêu cầu phi chức năng(NFR)

| Mã     | Nhóm                       | Yêu cầu                                                                                                                                                                                                                                  | MoSCoW |
| ------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| NFR-05 | Bảo mật thông tin xác thực | Mật khẩu lưu trong database phải được băm bằng thuật toán chuyên dụng cho mật khẩu (Argon2id hoặc bcrypt với work factor được cấu hình an toàn); không lưu hoặc ghi log mật khẩu dạng rõ.                                                | Must   |
| NFR-06 | Bảo mật token              | JWT phải được ký bằng thuật toán cho phép, xác minh chữ ký và thời hạn ở mỗi request được bảo vệ; thời hạn access token không vượt quá 24 giờ. Secret lấy từ biến môi trường/secret manager, không hard-code hoặc commit vào repository. | Must   |
| NFR-07 | Phân quyền                 | Mặc định từ chối truy cập endpoint được bảo vệ nếu token thiếu, sai chữ ký, hết hạn hoặc role không đủ; kiểm tra role phải thực hiện ở backend, không dựa vào giao diện frontend.                                                        | Must   |
| NFR-08 | Bảo vệ dữ liệu             | Mọi response, lỗi và log không chứa mật khẩu, hash mật khẩu, JWT đầy đủ hoặc secret. Thông tin hồ sơ chỉ trả các trường cần thiết.                                                                                                       | Must   |
| NFR-09 | Kiểm tra đầu vào           | Request Auth phải được validate ở server; dữ liệu không hợp lệ trả HTTP `400` với lỗi có cấu trúc, không ghi dữ liệu không hợp lệ vào database.                                                                                          | Must   |
| NFR-10 | Truyền thông an toàn       | Môi trường production chỉ phục vụ API qua HTTPS. CORS chỉ cho phép origin frontend đã cấu hình theo môi trường.                                                                                                                          | Must   |
| NFR-11 | Chống thử mật khẩu lặp lại | Endpoint đăng nhập cần có giới hạn tốc độ có thể cấu hình và kiểm thử được; ngưỡng cụ thể được nhóm chốt trước khi triển khai để tránh khóa nhầm người dùng.                                                                             | Should |

## 4. Tiêu chí chấp nhận

### FR-20 – Đăng ký

- **AC-20.1** Given email hợp lệ chưa tồn tại và dữ liệu bắt buộc hợp lệ, When gọi `POST /auth/register`, Then trả HTTP `201` và hồ sơ có `id`, `email`, `fullName`, `role`.
- **AC-20.2** Given email đã được đăng ký, When gửi đăng ký lần nữa, Then không tạo tài khoản trùng và trả lỗi phù hợp theo hợp đồng API.
- **AC-20.3** Khi email sai định dạng, họ tên rỗng hoặc mật khẩu ngắn hơn 8 ký tự, Then trả HTTP `400` và không tạo bản ghi.

### FR-21, FR-23 – Đăng nhập và JWT

- **AC-21.1** Given cặp email/mật khẩu đúng, When gọi `POST /auth/login`, Then trả HTTP `200` với JWT hợp lệ, kiểu Bearer, thời hạn và hồ sơ công khai.
- **AC-21.2** Given mật khẩu sai hoặc email không tồn tại, When gọi đăng nhập, Then trả cùng loại HTTP/status và thông điệp chung; không tiết lộ trường hợp nào xảy ra.
- **AC-23.1** Given JWT hợp lệ, When API xác minh token, Then token có chủ thể, role và thời hạn; token hết hạn hoặc chữ ký không hợp lệ bị từ chối.

### FR-24 – Endpoint được bảo vệ và hồ sơ hiện tại

- **AC-24.1** Given không gửi token hoặc gửi token sai/hết hạn, When gọi `GET /auth/me` hoặc endpoint cần đăng nhập, Then trả HTTP `401`.
- **AC-24.2** Given token hợp lệ, When gọi `GET /auth/me`, Then trả đúng hồ sơ tương ứng với `sub` trong token.

### FR-25, FR-26 – Phân quyền và cấp role

- **AC-25.1** Given tài khoản `CUSTOMER`, When gọi endpoint chỉ dành cho `STAFF`, Then trả HTTP `403`.
- **AC-25.2** Given tài khoản `STAFF` có token hợp lệ, When gọi endpoint dành cho nhân viên, Then request được phép qua bước kiểm tra quyền.
- **AC-26.1** Given request đăng ký có thêm trường `role: "STAFF"`, When xử lý đăng ký, Then API không tạo tài khoản với role `STAFF`; role mặc định là `CUSTOMER` hoặc request bị từ chối theo chính sách validate.

### FR-27, FR-28 – Không rò rỉ thông tin

- **AC-27.1** Không response đăng ký, đăng nhập, hồ sơ hoặc lỗi Auth nào có trường `password`, `passwordHash`, secret hoặc access token ngoài response đăng nhập thành công.
- **AC-28.1** Email không tồn tại và mật khẩu sai trả cùng thông điệp lỗi công khai; log server không ghi mật khẩu hoặc JWT đầy đủ.

### NFR-05 đến NFR-10 – Kiểm tra bảo mật

- **AC-N05.1** Giá trị lưu cho tài khoản thử nghiệm không bằng mật khẩu gốc và có thể được xác minh bằng thư viện băm mật khẩu đã chọn.
- **AC-N06.1** JWT hết hạn, sai chữ ký hoặc sai thuật toán bị từ chối; không có secret xác thực trong source code hoặc file được commit.
- **AC-N07.1** Test xác nhận endpoint public truy cập không cần token, endpoint authenticated cần token, và endpoint staff cần role `STAFF`.
- **AC-N08.1** Test kiểm tra response/log của các luồng đăng ký, đăng nhập và lỗi không chứa mật khẩu rõ hoặc hash.
- **AC-N09.1** Payload thiếu trường hoặc sai định dạng bị từ chối trước khi ghi database.
- **AC-N10.1** Cấu hình deploy production dùng HTTPS và origin CORS lấy từ cấu hình môi trường, không dùng wildcard trong production.

## 5. Ngoài phạm vi và điểm cần chốt

- Quên/đặt lại mật khẩu, xác minh email, refresh token, thu hồi token trước thời hạn và đăng nhập mạng xã hội chưa nằm trong yêu cầu MVP này.
- Nhóm cần thống nhất: email có chuẩn hóa chữ hoa/thường không; độ dài tối đa email/họ tên; cơ chế tạo tài khoản `STAFF`; ngưỡng rate limit; thời hạn JWT chính thức; và đăng ký có tự đăng nhập hay không.
- Các lựa chọn thuật toán, thư viện, mã lỗi chi tiết và quy ước migration phải khớp với ADR, schema chung và Swagger/OpenAPI trước khi triển khai.
