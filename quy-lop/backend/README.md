# Đồng Quỹ

Ứng dụng quản lý quỹ chung tiếng Việt, có hai vai trò: quản trị viên và sinh viên. Đã chuyển từ prototype lưu trên trình duyệt sang ba tầng:

- Front end: HTML/CSS/JavaScript, giữ thiết kế ban đầu, gọi API cùng nguồn.
- Back end: Node.js 24, HTTP API, xác thực phiên và kiểm tra quyền trên máy chủ.
- Database: SQLite, dữ liệu tại `data/dongquy.sqlite`, có transaction nguyên tử và nhật ký bất biến.

## Chạy ứng dụng

Yêu cầu Node.js **24 trở lên**. Trong thư mục đã giải nén:

```bash
npm run create-user -- admin@example.com "Quản trị viên" admin
npm start
```

Lệnh tạo tài khoản hỏi mật khẩu qua stdin; ký tự nhập được ẩn trong terminal. Không có tài khoản/mật khẩu mặc định. Mật khẩu tối thiểu 10 ký tự.

Mở **http://127.0.0.1:8080** trên chính máy chạy ứng dụng. Đăng nhập bằng tài khoản vừa tạo. Không mở `dist/index.html` trực tiếp vì giao diện cần API.

Máy chủ mặc định chỉ lắng nghe loopback. Có thể cấu hình `HOST`, `PORT`. Khi triển khai qua HTTPS đặt `NODE_ENV=production` để cookie có thuộc tính Secure; reverse proxy cần giữ nguyên Host và dùng HTTPS bên ngoài. Bản này là ứng dụng Node.js/SQLite, chưa được triển khai lên dịch vụ hosting.

## Quy trình sử dụng

1. Trong **Thiết lập**, thêm ngân hàng, chủ tài khoản, số tài khoản và ảnh QR. Có thể bỏ qua và bổ sung sau. QR tùy chọn, PNG/JPEG/WebP tối đa 1 MB; đổi tài khoản mà không tải QR mới sẽ gỡ QR cũ.
2. Tạo **đợt thu**: tên, mã, định mức mỗi sinh viên và hạn đóng. Có thể khóa/mở nhận đóng góp vào đợt với lý do; đây là khóa đợt thu, chưa phải khóa sổ kế toán toàn bộ tháng.
3. Trong **Thành viên**, tạo tài khoản sinh viên, chỉnh tên, đặt lại mật khẩu, ngừng/kích hoạt tài khoản và xem đóng góp. Mã sinh viên giữ nguyên để bảo toàn tham chiếu; quản trị viên có thể cập nhật email đăng nhập và đặt lại mật khẩu.
4. Trong **Khoản thu**, ghi khoản tiền đã đối soát thực nhận, chọn người nộp và đợt thu; mã tham chiếu ngân hàng/biên nhận là bắt buộc.
5. Trong **Khoản chi**, tạo đề nghị kèm chứng từ/giải trình dạng văn bản. Quản trị viên duyệt rồi xác nhận thanh toán thực tế. Chưa xác nhận thì chưa ghi chi.
6. Trong **Tạm ứng**, người dùng tạo đề nghị; quản trị viên duyệt và xác nhận giải ngân. Người nhận nộp chi thực tế và hồ sơ quyết toán; quản trị viên duyệt, đối soát hoàn tiền dư/chi bổ sung và hoàn tất.
7. **Tổng quan/Báo cáo**: xem thu, chi phí, số dư cuối kỳ, tạm ứng chưa quyết toán, tiền đang giữ và tiền khả dụng; lọc tháng, tìm giao dịch, phân trang, xem chi tiết, xuất CSV. Quản trị viên có thể đảo phiếu thu/chi có lý do; phiếu gốc được giữ nguyên.
8. **Nhật ký** dành cho quản trị viên: xem người thao tác, thời gian, đối tượng và dữ liệu hành động. Nút thông báo nhắc đóng quỹ và hồ sơ quá hạn trong ứng dụng; không gửi email/SMS tự động.

## Giao diện sinh viên

- Chỉ tra cứu mã sinh viên gắn với tài khoản đang đăng nhập; không dùng mã sinh viên thay mật khẩu.
- Xem tổng đã đóng, số đã đóng/còn thiếu của đợt mới nhất, lịch sử cá nhân, QR và thông tin tài khoản nhận quỹ.
- Xem thống kê và sổ giao dịch chung. Danh tính của người đóng góp khác, tham chiếu ngân hàng, chứng từ và nhật ký quản trị được giới hạn phía máy chủ.
- Gửi đề nghị chi/tạm ứng, xem hồ sơ của mình và nộp quyết toán; không được tự duyệt hoặc ghi sổ.

## Quy tắc ghi sổ

- Số dư cuối kỳ = số dư đầu kỳ + tiền vào − tiền ra trong kỳ.
- Tạm ứng làm giảm tiền thực tế nhưng chưa tạo chi phí. Khi quyết toán mới ghi nhận chi phí thực tế; hoàn ứng không được tính thành đóng góp mới.
- Khoản đã duyệt giữ tiền để tránh duyệt đồng thời vượt quỹ. Không cho ghi sổ làm số dư lịch sử âm.
- Khóa chống gửi trùng và mã tham chiếu duy nhất ngăn ghi nhận lặp. Ghi phiếu, cập nhật trạng thái, sổ tiền và nhật ký cùng một SQLite transaction.
- Phiếu đã ghi sổ không sửa/xóa trực tiếp; dùng phiếu đảo cho thu/chi trực tiếp. Hồ sơ tạm ứng đã quyết toán chưa có luồng điều chỉnh sau quyết toán.
- Chưa tích hợp ngân hàng: quét QR không tự xác nhận đã đóng. Quản trị viên phải đối soát.
- Chứng từ chi/quyết toán hiện là nội dung hoặc tham chiếu dạng văn bản; tải tệp hóa đơn riêng chưa được triển khai. Ảnh QR được lưu bền trong cấu hình database.
- Mỗi cài đặt hiện quản lý một quỹ, một loại tiền VND; không có chia sẻ dữ liệu giữa nhiều máy chủ độc lập.

## Kiểm thử

```bash
npm ci
npm test
```

Kiểm thử dùng database tạm, không sửa dữ liệu vận hành. Bộ kiểm thử gồm API qua HTTP thật, kiểm tra SQLite, và tích hợp DOM bằng jsdom với API thật. Chưa kiểm thử hiển thị bằng trình duyệt đồ họa.

Để chạy theo từng bước:

```bash
node --test --test-isolation=none tests/01-auth.test.js
node --test --test-isolation=none tests/02-settings.test.js
node --test --test-isolation=none tests/03-members.test.js
node --test --test-isolation=none tests/04-income.test.js
node --test --test-isolation=none tests/05-expenses.test.js
node --test --test-isolation=none tests/06-advances.test.js
node --test --test-isolation=none tests/07-reports.test.js
node --test --test-isolation=none tests/08-interface.test.js
node --test --test-isolation=none tests/09-integrity.test.js
node --test --test-isolation=none tests/10-admin.test.js
```

## Sao lưu và khôi phục

```bash
npm run backup
# Hoặc chỉ định một tệp mới:
node scripts/backup.js backups/quy-truoc-doi-soat.sqlite
```

Lệnh dùng SQLite Online Backup để sao lưu nhất quán khi máy chủ đang chạy và không ghi đè bản đã có. Bản sao chứa thông tin tài khoản và tài chính; lưu tại nơi được quản lý quyền truy cập.

Khi cần khôi phục: dừng máy chủ; giữ bản sao database hiện tại; thay database cùng các tệp WAL/SHM bằng bản sao nhất quán khi không còn tiến trình sử dụng database; khởi động lại và đối soát. Không chép đè tệp database khi máy chủ còn chạy.

Xem `TIEN-DO.md` để đối chiếu tính năng và bằng chứng kiểm thử. `THIET-KE.md` là đặc tả và Sequence Diagram ban đầu; các nhãn trạng thái trong đặc tả gốc được thay thế bởi tiến độ triển khai hiện tại.
