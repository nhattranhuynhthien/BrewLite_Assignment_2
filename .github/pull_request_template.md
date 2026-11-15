## Mô tả thay đổi
- **Issue ID (Excel / GitHub):** `[I-XX]`
- **Thành viên thực hiện:** `TVX`
- **Reviewer chéo:** `TVY` (theo vòng `TV1 -> TV2 -> TV3 -> TV4 -> TV1`, `TV5 <-> TV6`)

### Tóm tắt
- 

---

## Phạm vi File & Truy vết
- **Code / Docs liên quan:**
- **FR / NFR đáp ứng:**

---

## Checklist Kiểm tra Trước Merge
- [ ] Code bám đúng phạm vi Issue, không sửa ngoài allowlist
- [ ] `npm --prefix apps/api run lint && npm --prefix apps/api run typecheck && npm --prefix apps/api test` đạt
- [ ] `npm --prefix apps/web run lint && npm --prefix apps/web run typecheck && npm --prefix apps/web test` đạt
- [ ] Đã chạy kiểm thử tích hợp / E2E liên quan (nếu có thay đổi API/DB/luồng người dùng)
- [ ] Không commit file `.env`, secret, token, password thật hoặc build artifacts (`dist`, `.next`, `node_modules`)
- [ ] Đã cập nhật `docs/api-contract.yaml` / `docs/traceability-matrix.md` nếu thay đổi contract hoặc FR
