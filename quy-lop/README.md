# Minh bạch Quỹ lớp D26TXCN05-K

## Cấu trúc

- `public/`: trang công khai chỉ đọc và report.json đã loại thông tin cá nhân.
- `backend/`: ứng dụng quản trị Node.js 24/SQLite, có đăng nhập, thu chi, tạm ứng, quyết toán, nhập nguồn và xuất báo cáo công khai.
- `public-tests/`: kiểm thử giao diện/số liệu công bố.

CNAME và trang portfolio ở gốc repository được giữ nguyên. Nhánh này chưa cấu hình hay thay đổi DNS Cloudflare.

## Số liệu ban đầu

Dữ liệu Google Sheets đã được nhập vào database nội bộ: 52 giao dịch, 62 thành viên, 50 người đã đóng; tổng thu 15.000.000đ, chi ra 3.000.000đ, hoàn ứng 374.645đ, chi thực tế 2.625.355đ, số dư 12.374.645đ. Giao dịch cuối ngày 21/10/2026.

Report công khai không bao gồm tên/mã sinh viên, email, thông tin đăng nhập, tài khoản nguồn hay chứng từ riêng tư. File nguồn và database nội bộ không được đưa lên repository công khai.

Các thành viên nhập từ nguồn chưa được cấp thông tin đăng nhập thật. Địa chỉ nội bộ `@pending.invalid` chỉ dùng để liên kết hồ sơ; không phải email liên hệ. Không có mật khẩu mặc định. Trước khi cấp tài khoản cần cấu hình email và mật khẩu qua công cụ quản trị.

Nguồn không có hạn đóng nên importer để trống; định mức 300.000đ được xác nhận từ 50 khoản đóng cùng mức, không suy diễn số dư đầu kỳ hoặc các hồ sơ tạm ứng không có trong nguồn.

## Triển khai Cloudflare Pages từ GitHub

Trong Cloudflare → Workers & Pages → Create → Pages → Connect GitHub:

- Repository: `NXuandieu0901/Xuandieu-Portfolio`.
- Production branch: `quy-lop-transparency`.
- Framework: None.
- Root directory: để trống.
- Build command: để trống (hoặc `exit 0` nếu giao diện yêu cầu).
- Build output directory: `quy-lop/public`.
- Sau khi triển khai thành công, thêm Custom domain `quylop.supportnxd.io.vn` trong project Pages để Cloudflare tạo/kiểm tra DNS và TLS. Không đổi CNAME `supportnxd.io.vn` của portfolio.

Bản được xuất bản qua Sites có CNAME/xác thực riêng được ghi trong file hướng dẫn tên miền khi có kết quả hosting. Chỉ chọn một đích hosting cho tên miền phụ; không tạo hai CNAME cùng tên. Nếu chuyển sang Pages, dùng đích `.pages.dev` thực tế của project, không đoán tên project.

## Cập nhật số liệu công khai

Trang hiện là snapshot đã đối soát, **không tự đồng bộ tức thời với Google Sheets**. Quy trình cập nhật:

1. Đối soát nguồn. Importer chặn dòng cũ bị sửa hoặc thiếu thay vì ghi đè sổ kế toán.
2. Từ backend nội bộ, chạy `node scripts/export-public.js /đường/dẫn/quy-lop/public/report.json`.
3. Kiểm tra tổng thu/chi/số dư, loại dữ liệu cá nhân và chạy kiểm thử.
4. Commit bản công bố mới, triển khai lại đúng thư mục `public/`.

Không đưa file nguồn đầy đủ vào repository hoặc thư mục public. Không cấu hình website khách đọc Sheet riêng tư bằng API key/secret trong JavaScript.

## Chạy và kiểm thử backend

```bash
cd quy-lop/backend
npm ci
npm test
npm run create-user -- admin@example.com "Quản trị viên" admin
npm start
```

Importer: `node scripts/import-sheet.js /đường/dẫn/snapshot-riêng-tư.json`. Schema snapshot được minh họa bằng dữ liệu giả trong `tests/11-sheet-import.test.js`. Database thật chỉ tồn tại trong môi trường nội bộ, không có trong GitHub.

API `GET /api/public-report` chỉ xuất các trường được phép công khai; mọi API quản trị vẫn yêu cầu xác thực/phân quyền. Backend Node.js/SQLite không thể chạy trên GitHub Pages hoặc Cloudflare Pages static; cần máy chủ Node riêng hoặc chuyển backend sang Workers/D1 nếu muốn vận hành quản trị trực tuyến trên Cloudflare.
