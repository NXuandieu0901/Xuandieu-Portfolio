# Tiến độ triển khai Đồng Quỹ

Kết quả `npm test`: **24 kiểm thử đạt, 0 thất bại, 0 bỏ qua**.

Các bước Back end được triển khai tuần tự và chạy kiểm thử tương ứng trước khi chuyển bước. Sau khi nối giao diện, kiểm thử tích hợp DOM gọi API thật kiểm tra lại các luồng của hai vai trò.

| Bước | Phần đã làm | Kiểm thử |
|---|---|---|
| 01 | Đăng nhập email/mật khẩu, hash scrypt, cookie HttpOnly/SameSite, CSRF, hết phiên, đăng xuất, chặn thử liên tục | `01-auth.test.js` |
| 02 | Thiết lập ngân hàng/QR ở quản trị, bổ sung sau, kiểm tra tệp, lưu bền, kiểm soát phiên bản cấu hình | `02-settings.test.js` |
| 03 | Thành viên và mã sinh viên, tạo tài khoản, ngừng hoạt động, đợt thu/định mức | `03-members.test.js` |
| 04 | Ghi thu đã đối soát, đúng người/đợt, mã tham chiếu, khóa chống trùng, lưu phiếu và nhật ký nguyên tử | `04-income.test.js` |
| 05 | Đề nghị chi, duyệt/từ chối/hủy, giữ tiền, xác nhận thanh toán, chống chi trùng | `05-expenses.test.js` |
| 06 | Đề nghị tạm ứng, duyệt/giải ngân, nộp/duyệt/trả hồ sơ quyết toán, hoàn ứng/chi bổ sung, tất toán | `06-advances.test.js` |
| 07 | Dashboard theo kỳ, số dư đầu/cuối kỳ, biểu đồ, tra cứu cá nhân, sổ giao dịch, CSV, nhật ký, đảo phiếu | `07-reports.test.js` |
| 08 | Nối giao diện quản trị/sinh viên với API; xác nhận thu, chi và quyết toán từ biểu mẫu | `08-interface.test.js` |
| 09 | Khởi động lại không mất dữ liệu/phiên, xử lý đồng thời không duyệt vượt quỹ, rollback quyết toán lỗi | `09-integrity.test.js` |
| 10 | Khóa/mở đợt thu, đặt lại mật khẩu và thu hồi phiên, thông báo trong ứng dụng, sao lưu nhất quán | `10-admin.test.js` |

## Phạm vi kiểm thử

- Thành công và lỗi xác thực/phân quyền; mã sinh viên không phải mật khẩu.
- Gửi lại yêu cầu không nhân đôi giao dịch; tham chiếu trùng bị chặn.
- Quyết toán nhỏ hơn/bằng/lớn hơn khoản ứng và quyết toán bằng không.
- Không tính hai lần chi phí, không tính tiền hoàn ứng thành đóng góp.
- Giữ tiền cho hồ sơ đã duyệt; kiểm tra hai yêu cầu duyệt đồng thời.
- Không được sửa/xóa trực tiếp giao dịch và nhật ký đã ghi.
- Sinh viên không đọc nhật ký quản trị hoặc tra đóng góp người khác; CSV loại trường riêng tư.
- Kiểm thử giao diện bằng DOM giả lập và HTTP API thật, chưa phải kiểm thử hình ảnh bằng trình duyệt đồ họa.

## Chưa thuộc bản triển khai này

Tích hợp ngân hàng tự động; đăng nhập qua nhà cung cấp danh tính bên ngoài; tải tệp hóa đơn riêng; email/SMS định kỳ; quản lý nhiều quỹ; khóa sổ toàn bộ kỳ kế toán; điều chỉnh hồ sơ tạm ứng đã quyết toán. Các chức năng này không được hiển thị như đã hoạt động.

Ứng dụng chạy Node.js/SQLite trên máy chủ cài đặt, chưa triển khai hosting. Không chứa tài khoản mặc định hoặc dữ liệu tài chính mẫu.

## Bổ sung nhập nguồn và công khai báo cáo

- Nhập Google Sheets: kiểm tra định danh, đối soát, ánh xạ hoàn ứng lịch sử thành giảm chi phí; không ghi đè dòng nguồn đã nhập hoặc ghi trùng.
- API công khai chỉ có trường đã cho phép; không xuất tên, mã sinh viên, email, tài khoản nguồn, mật khẩu hoặc chứng từ riêng tư.
- Cấp email đăng nhập và mật khẩu thật cho hồ sơ sinh viên đã nhập; giữ nguyên mã và đóng góp.
- Đã nhập 52 giao dịch, 62 thành viên, 50 người đóng; số dư đối soát 12.374.645đ. Dữ liệu thật lưu nội bộ, không kèm mã nguồn công khai.
- Trang công khai có thêm 2 kiểm thử DOM/đối soát, ngoài 24 kiểm thử backend.
