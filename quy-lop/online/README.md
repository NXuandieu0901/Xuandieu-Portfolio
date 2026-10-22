# Dasboard - quản lý thu chi quỹ — bản trực tuyến

Bản đang chạy tại https://quylop.supportnxd.io.vn. Trang công khai ở `/`; khu vực quản trị và sinh viên tại `/quan-tri`.

## Đăng nhập và quyền

Sử dụng đăng nhập ChatGPT do Sites dispatch quản lý; không triển khai OAuth/session riêng hoặc mật khẩu ứng dụng. Máy chủ chỉ tin các identity header do hosting cung cấp, kiểm tra thành viên và vai trò cho từng API, đồng thời bảo vệ các yêu cầu ghi bằng CSRF.

Chủ sở hữu website được cấp tài khoản quản trị. Quản trị viên gắn email thật vào hồ sơ sinh viên hoặc thêm thành viên mới. Lần đăng nhập đầu tiên khớp email sẽ liên kết với user ID ổn định của Sites. Mã sinh viên không phải mật khẩu; sinh viên chỉ xem được đóng góp và đề nghị cá nhân.

## Chức năng

Dashboard, báo cáo công khai đọc trực tiếp từ sổ quỹ, thu đã đối soát, đề nghị/duyệt/thanh toán chi, tạm ứng/giải ngân/quyết toán/hoàn ứng/chi bổ sung, thành viên và đợt thu, thiết lập ngân hàng/QR, nhật ký và CSV. Trang công khai không chứa tên/mã sinh viên, email, tham chiếu hay chứng từ nội bộ.

## Lưu trữ

Cloudflare D1 binding `DB` chứa bảng `fund_state`. Toàn bộ một thay đổi tài chính được kiểm tra rồi cập nhật với điều kiện revision, giúp ghi nguyên tử và tránh duyệt đồng thời vượt quỹ. Máy chủ từ chối sửa/xóa bút toán và sự kiện nhật ký cũ. Yêu cầu tài chính có khóa chống trùng; mã tham chiếu không được trùng. Kiểm tra số dư lịch sử không âm.

Đây là thiết kế một quỹ với snapshot có revision; document bị giới hạn 1.850.000 byte. Cần chuyển sang các bảng nghiệp vụ chuẩn hóa khi sổ quỹ lớn hơn, không tự cắt lịch sử để vượt giới hạn.

52 giao dịch và 62 thành viên nguồn đã được đưa vào D1 bằng dữ liệu khởi tạo được giữ trong runtime secrets. Không đưa snapshot đầy đủ, tên/mã sinh viên, file database hoặc giá trị secret lên GitHub. Không dùng localStorage làm sổ quỹ dùng chung. Google Sheets là nguồn nhập ban đầu, không tự đồng bộ hai chiều.

## Runtime secrets

Các khóa `OWNER_EMAIL`, `OWNER_NAME`, `CSRF_SECRET`, `INITIAL_STATE_PARTS`, `INITIAL_STATE_0...` được cấu hình riêng qua Sites, không lưu trong source. Initial state được nén gzip/base64, chia phần; chỉ dùng để khởi tạo bảng đang trống. Sau khi dữ liệu đã có, không ghi đè bằng dữ liệu khởi tạo. Không có mật khẩu hoặc tài khoản demo mặc định.

## Kiểm thử và build

```bash
npm ci
npm test
npm run build
```

13 kiểm thử bao gồm phân quyền/CSRF, khởi tạo một lần, dữ liệu bền vững khi tạo Worker mới, chống ghi trùng, thu chi, các trường hợp quyết toán, cập nhật đồng thời, giao diện quản trị thực sự gọi Worker, tên mới và liên kết quản trị.

Build tạo `dist/server/index.js` tự chứa toàn bộ UI và API, cùng manifest và migration SQL. Chỉ xuất bản archive từ commit đã push lên source Site và giữ nguyên project_id/audience hiện có. Không dùng Cloudflare Pages static để thay bản trực tuyến này vì sẽ mất API/quản trị.
