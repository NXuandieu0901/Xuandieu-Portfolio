# Kích hoạt quylop.supportnxd.io.vn

Trang công khai đã xuất bản: https://quy-lop-d26txcn05-k.perkylark16.chatgpt.site . Tên miền https://quylop.supportnxd.io.vn đã hoạt động; xác minh DNS và chứng chỉ HTTPS đều active ngày 22/10/2026.

Trong Cloudflare → DNS của zone supportnxd.io.vn, thêm:

| Loại | Name | Target / Content | Proxy |
|---|---|---|---|
| CNAME | quylop | custom-domains.chatgpt.site. | DNS only (đám mây xám) |
| TXT | _openai-site-verification.quylop | openai-site-verification=HwRlfDoDLE73gskyMRC4k-GwC9SMg-vcUmTCQA5rf7I | Không áp dụng |
| TXT | _cf-custom-hostname.quylop | feeb5d5d-d56d-45f8-b6a1-97276e293f16 | Không áp dụng |

TTL: Auto. Không thay bản ghi của tên miền gốc. Nếu quylop đã có A/AAAA/CNAME, cần kiểm tra bản ghi hiện tại trước khi thay.

Đây là cấu hình cho hosting đã xuất bản qua Sites. Nếu chuyển sang Cloudflare Pages, dùng Custom domain của project Pages và đích .pages.dev thực tế do Cloudflare cấp, không trộn hai bộ cấu hình.

Các bản ghi trên đã được xác minh. Giữ cấu hình DNS để duy trì tên miền và chứng chỉ.
