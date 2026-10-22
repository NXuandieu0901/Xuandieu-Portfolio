# Đồng Quỹ — Đặc tả chức năng và luồng nghiệp vụ

> Đây là đặc tả gốc trước khi triển khai Back end. Xem [TIEN-DO.md](TIEN-DO.md) và [README.md](README.md) để biết chức năng đã triển khai và hướng dẫn chạy hiện tại.

## 1. Phạm vi và trạng thái

Bản mẫu hiện tại dùng dữ liệu minh họa và localStorage. Chọn vai trò chỉ mô phỏng đăng nhập; không có máy chủ, tài khoản thật, kiểm tra quyền thật, tích hợp ngân hàng hoặc nhiều người dùng đồng bộ. Các Sequence Diagram dưới đây là thiết kế hệ thống triển khai thực tế. Luồng tạm ứng là đề xuất mới, chưa có chức năng trong bản mẫu.

## 2. Toàn bộ chức năng theo nhóm

| Nhóm | Chức năng | Vai trò | Trạng thái |
|---|---|---|---|
| Đăng nhập | Chọn tài khoản quản trị viên/sinh viên, đổi vai trò | Cả hai | Có mô phỏng |
| Xác thực | Đăng nhập thật, đăng xuất, hết phiên, liên kết mã sinh viên với tài khoản | Cả hai | Cần backend |
| Phân quyền | Bảo vệ API theo vai trò, kiểm tra thành viên thuộc quỹ | Hệ thống | Cần backend; hiện chỉ ẩn thao tác trên UI |
| Dashboard | Tổng thu, tổng chi, số dư theo kỳ | Cả hai | Có |
| Dashboard | Biểu đồ thu chi theo tháng, phân bổ chi theo danh mục | Cả hai | Có |
| Dashboard | Đếm thành viên đã đóng quỹ tháng 10 | Cả hai | Có |
| Giao dịch | Danh sách khoản thu/chi; nội dung, người nộp/nhận, ngày, số tiền, danh mục, trạng thái | Cả hai | Có |
| Giao dịch | Tìm theo nội dung/người nộp; lọc loại và kỳ; sắp xếp ngày mới nhất | Cả hai | Có |
| Thu | Tạo phiếu thu, chọn người nộp, số tiền, ngày, danh mục | Quản trị viên | Có, lưu cục bộ |
| Chi | Tạo phiếu chi, chọn người nhận, số tiền, ngày, danh mục | Quản trị viên | Có, lưu cục bộ |
| Đối soát | Bằng chứng chuyển khoản, mã tham chiếu ngân hàng, kiểm tra trùng, xác nhận thu | Quản trị viên | Đề xuất |
| Phê duyệt chi | Đề nghị chi, đính kèm hóa đơn, duyệt/từ chối, xác nhận thanh toán | Sinh viên đề nghị; quản trị viên duyệt | Đề xuất |
| Thành viên | Danh sách 40 sinh viên, mã, đã đóng, còn thiếu, trạng thái đợt tháng 10 | Cả hai | Có dữ liệu minh họa |
| Quản lý thành viên | Thêm/sửa/ngừng hoạt động, liên kết tài khoản, cấu hình định mức và kỳ thu | Quản trị viên | Đề xuất |
| Sinh viên | Nhập mã, xem tên, tổng đã đóng mọi kỳ, đã đóng tháng 10, còn thiếu, lịch sử đóng góp | Sinh viên | Đã bổ sung |
| Công khai quỹ | Xem tổng thu, chi tiêu chung, phân bổ chi, số dư | Sinh viên | Có |
| QR nhận quỹ | Nhập ngân hàng, số tài khoản, chủ tài khoản; tải ảnh QR | Quản trị viên | Đã bổ sung, lưu cục bộ |
| Chuyển khoản | Hiển thị QR, thông tin tài khoản và nội dung mã sinh viên + đợt thu | Sinh viên | Đã bổ sung; cần quản trị viên cấu hình QR thật |
| Tạm ứng | Tạo đề nghị, mục đích, dự toán, người nhận, hạn quyết toán | Sinh viên/quản trị viên | Đề xuất |
| Tạm ứng | Duyệt/từ chối, giải ngân, theo dõi chưa quyết toán/quá hạn | Quản trị viên | Đề xuất |
| Quyết toán | Nộp hóa đơn, chi thực tế, hoàn tiền dư hoặc chi bổ sung; đóng hồ sơ | Sinh viên nộp; quản trị viên duyệt | Đề xuất |
| Báo cáo | Xuất CSV theo kỳ, xem sổ giao dịch | Cả hai trong bản mẫu | Có |
| Nhật ký nghiệp vụ | Mã phiếu, thời gian, người thao tác, loại sự kiện, chứng từ liên quan | Quản trị viên; sinh viên xem phần công khai | Đề xuất |
| Kiểm toán | Lưu trước/sau, lý do hủy/điều chỉnh, phân trang, lọc người thao tác và xuất nhật ký | Quản trị viên | Đề xuất |
| Điều chỉnh | Phiếu đảo/điều chỉnh thay vì xóa giao dịch đã ghi sổ | Quản trị viên | Đề xuất |
| Vận hành | Sao lưu, khôi phục, khóa sổ kỳ, số dư đầu kỳ | Quản trị viên | Đề xuất |
| Thông báo | Số sinh viên chưa đóng | Cả hai | Có nhắc minh họa |
| Nhắc việc | Nhắc đóng quỹ và quyết toán quá hạn | Theo quyền | Đề xuất |
| Trải nghiệm | Giao diện tiếng Việt, đáp ứng điện thoại, định dạng VND | Cả hai | Có |

## 3. Quy tắc tài chính

- Các chỉ số thu/chi chỉ tính phiếu đã ghi sổ. Chuyển khoản, quét QR, gửi chứng từ hoặc duyệt đề nghị không tự tạo doanh thu/chi phí.
- Số dư đầu kỳ phải được cấu hình. Báo cáo một kỳ cần số dư đầu kỳ cộng biến động để thể hiện số dư cuối kỳ; hiệu thu–chi riêng trong kỳ chỉ là biến động kỳ.
- Khi có tạm ứng, phải tách **số dư tiền thực tế**, **tạm ứng chưa quyết toán**, và **chi phí đã quyết toán**. Không dùng công thức tổng thu trừ chi phí để thay cho tiền còn trong tài khoản.
- Giải ngân tạm ứng A: tiền giảm A, tạm ứng chưa quyết toán tăng A; chưa ghi chi phí.
- Quyết toán chi phí thực tế E: ghi chi phí E và tất toán tạm ứng A. Nếu E < A, thu hoàn A−E; nếu E > A, chi bổ sung E−A sau phê duyệt và xác nhận thanh toán. Chưa nhận tiền hoàn thì hồ sơ chưa được đóng.
- Thu hoàn ứng là thu hồi tạm ứng, không tính vào đóng góp sinh viên. Giải ngân tạm ứng không đồng thời tính là chi phí hoạt động. Tất cả biến động tiền vẫn xuất hiện trong sổ tiền.
- Ghi phiếu, biến động sổ tiền và nhật ký phải nguyên tử trong một transaction; khóa chống xử lý đồng thời và khóa chống gửi trùng được kiểm tra phía máy chủ.
- Phiếu đã ghi sổ được sửa bằng bút toán đảo/điều chỉnh có lý do, không xóa lịch sử.

## 4. Giao diện sinh viên

1. Đăng nhập, xác định quỹ và mã sinh viên gắn với tài khoản.
2. Khối tra cứu: mã sinh viên, tên, tổng đã đóng mọi kỳ, đã đóng/còn thiếu theo đợt, lịch sử đóng góp.
3. Khối chuyển khoản: QR thật, ngân hàng, chủ tài khoản, số tài khoản, nội dung chuyển khoản gồm mã sinh viên và mã đợt thu.
4. Dashboard chung: tổng thu, chi phí, tiền thực tế, tạm ứng chưa quyết toán; bộ lọc kỳ và biểu đồ.
5. Danh sách chi công khai: ngày, mục đích, danh mục, số tiền và trạng thái; không công khai dữ liệu ngân hàng hoặc chứng từ nhạy cảm của thành viên.
6. Tạm ứng cá nhân: đề nghị của tôi, trạng thái, hạn quyết toán, nút gửi chứng từ (đề xuất).

Bản mẫu cho phép tra cứu mọi mã minh họa. Bản thật phải xác thực tài khoản và kiểm tra mã được tra cứu thuộc người đang đăng nhập. Mã sinh viên không phải mật khẩu. Quyền xem báo cáo chung không cho phép xem thông tin đóng góp riêng của người khác.

## 5. Sequence Diagram

### 5.1 Đăng nhập

```mermaid
sequenceDiagram
    actor U as Người dùng
    participant UI as Web app
    participant Auth as Dịch vụ xác thực
    participant API as Máy chủ ứng dụng
    participant DB as Cơ sở dữ liệu
    U->>UI: Chọn đăng nhập
    UI->>Auth: Chuyển tới đăng nhập an toàn
    Auth->>Auth: Xác thực tài khoản
    alt Xác thực thất bại
        Auth-->>UI: Lỗi hoặc hủy đăng nhập
        UI-->>U: Hiển thị thông báo
    else Xác thực thành công
        Auth-->>UI: Thiết lập phiên an toàn
        UI->>API: Lấy hồ sơ và quyền trong quỹ
        API->>API: Xác minh phiên
        API->>DB: Tra thành viên, vai trò, mã sinh viên
        DB-->>API: Thông tin thành viên
        alt Chưa thuộc quỹ
            API-->>UI: Từ chối truy cập quỹ
        else Đã thuộc quỹ
            API-->>UI: Hồ sơ và quyền
            UI-->>U: Dashboard theo vai trò
        end
    end
    Note over API,DB: Mỗi API tiếp tục kiểm tra phiên và quyền
```

### 5.2 Thu quỹ và tra cứu đóng góp

```mermaid
sequenceDiagram
    actor SV as Sinh viên
    participant UI as Web app
    participant API as Máy chủ
    participant DB as Cơ sở dữ liệu
    participant Bank as Ngân hàng
    actor AD as Quản trị viên
    SV->>UI: Nhập mã sinh viên
    UI->>API: Tra cứu đóng góp theo mã và quỹ
    API->>API: Kiểm tra phiên và quyền sở hữu mã
    API->>DB: Lấy đóng góp cá nhân và báo cáo chung
    DB-->>API: Đã đóng, còn thiếu, thu chi và số dư
    API-->>UI: Dữ liệu được phép xem và tài khoản nhận quỹ
    UI-->>SV: Hiển thị kết quả, QR và nội dung chuyển khoản
    SV->>Bank: Quét QR, kiểm tra tài khoản và chuyển tiền
    Bank-->>SV: Kết quả giao dịch
    Note over SV,DB: QR không tự xác nhận đã đóng quỹ
    AD->>Bank: Kiểm tra tiền thực nhận
    Bank-->>AD: Sao kê và mã tham chiếu
    AD->>UI: Tạo phiếu thu cho sinh viên và đợt thu
    UI->>API: Gửi phiếu và khóa chống gửi trùng
    API->>API: Kiểm tra quyền, số tiền, mã tham chiếu
    alt Dữ liệu sai hoặc giao dịch đã ghi nhận
        API-->>UI: Báo lỗi hoặc trả phiếu đã có
    else Hợp lệ
        API->>DB: Ghi phiếu thu, sổ tiền và nhật ký nguyên tử
        DB-->>API: Mã phiếu
        API-->>UI: Đã ghi nhận
        SV->>UI: Tải lại kết quả tra cứu
        UI->>API: Lấy số liệu mới
        API-->>UI: Cập nhật khoản đóng và báo cáo chung
    end
```

### 5.3 Chi quỹ

```mermaid
sequenceDiagram
    actor N as Người đề nghị
    participant UI as Web app
    participant API as Máy chủ
    participant DB as Cơ sở dữ liệu
    actor AD as Quản trị viên
    participant Bank as Ngân hàng
    N->>UI: Nhập mục đích, số tiền, người nhận, chứng từ
    UI->>API: Gửi đề nghị chi
    API->>API: Xác thực và kiểm tra dữ liệu
    API->>DB: Lưu đề nghị chờ duyệt và nhật ký
    AD->>UI: Mở đề nghị
    UI->>API: Duyệt hoặc từ chối
    API->>DB: Khóa hồ sơ, kiểm tra tiền khả dụng và trạng thái
    alt Bị từ chối hoặc không đủ tiền
        API->>DB: Lưu lý do hoặc giữ chờ xử lý
        API-->>UI: Thông báo kết quả
    else Được duyệt và đủ tiền
        API->>DB: Đánh dấu đã duyệt, giữ tiền dự kiến chi
        AD->>Bank: Thanh toán cho người nhận
        Bank-->>AD: Kết quả thanh toán
        alt Thanh toán thất bại
            AD->>UI: Ghi nhận thất bại
            UI->>API: Cập nhật kết quả, không ghi chi
        else Thanh toán thành công
            AD->>UI: Xác nhận thanh toán và mã tham chiếu
            UI->>API: Ghi sổ phiếu chi
            API->>DB: Khóa chống trùng, ghi chi và nhật ký nguyên tử
            API-->>UI: Phiếu chi và báo cáo cập nhật
        end
    end
```

### 5.4 Tạm ứng và quyết toán

```mermaid
sequenceDiagram
    actor N as Người nhận tạm ứng
    participant UI as Web app
    participant API as Máy chủ
    participant DB as Cơ sở dữ liệu
    actor AD as Quản trị viên
    participant Bank as Ngân hàng
    N->>UI: Đề nghị số tiền A, mục đích, hạn quyết toán
    UI->>API: Gửi đề nghị tạm ứng
    API->>DB: Lưu hồ sơ chờ duyệt và nhật ký
    AD->>UI: Duyệt hoặc từ chối
    UI->>API: Gửi quyết định
    API->>DB: Kiểm tra quyền, trạng thái, tiền khả dụng
    alt Từ chối hoặc không đủ tiền
        API-->>UI: Thông báo lý do, chưa giải ngân
    else Được duyệt
        API->>DB: Đánh dấu đã duyệt, giữ tiền dự kiến giải ngân
        AD->>Bank: Chuyển tạm ứng A
        Bank-->>AD: Kết quả chuyển tiền
        AD->>UI: Xác nhận giải ngân thành công
        UI->>API: Gửi mã tham chiếu
        API->>DB: Tiền giảm A, tạm ứng tăng A, ghi nhật ký
        N->>UI: Nộp chứng từ và chi thực tế E
        UI->>API: Gửi hồ sơ quyết toán
        API->>DB: Lưu chờ duyệt quyết toán
        AD->>UI: Kiểm tra và duyệt hồ sơ
        UI->>API: Gửi quyết định quyết toán
        API->>API: Kiểm tra quyền, chứng từ, số tiền, trạng thái
        alt Chứng từ chưa đạt
            API-->>UI: Yêu cầu bổ sung, giữ dư tạm ứng
        else Hồ sơ hợp lệ
            alt E nhỏ hơn A
                API-->>UI: Yêu cầu hoàn ứng A trừ E
                N->>Bank: Hoàn tiền dư
                AD->>Bank: Đối soát tiền hoàn
                AD->>UI: Xác nhận đã thu hoàn
            else E lớn hơn A
                API->>DB: Kiểm tra và giữ tiền bổ sung E trừ A
                AD->>Bank: Thanh toán bổ sung sau phê duyệt
                AD->>UI: Xác nhận thanh toán thành công
            else E bằng A
                Note over API,DB: Không phát sinh chuyển tiền thêm
            end
            UI->>API: Hoàn tất quyết toán kèm bằng chứng cần thiết
            API->>DB: Ghi chi phí E, tất toán A và biến động tiền còn lại nguyên tử
            API->>DB: Đóng hồ sơ và ghi nhật ký trong cùng giao dịch
            API-->>UI: Quyết toán hoàn thành
        end
    end
    Note over API,DB: Nếu tiền hoàn hoặc bổ sung chưa xác nhận, giữ trạng thái chờ thanh toán
    Note over Bank,DB: Không ghi chi phí lần nữa cho khoản đã giải ngân
```

### 5.5 Danh sách nhật ký giao dịch

```mermaid
sequenceDiagram
    actor U as Người dùng
    participant UI as Web app
    participant API as Máy chủ
    participant DB as Cơ sở dữ liệu
    U->>UI: Mở nhật ký, chọn kỳ, loại, người thao tác
    UI->>API: Yêu cầu danh sách với bộ lọc và con trỏ trang
    API->>API: Xác thực, kiểm tra quyền và bộ lọc
    alt Không có quyền
        API-->>UI: Từ chối truy cập
    else Được phép
        API->>DB: Truy vấn phạm vi được phép, sắp thời gian và mã
        DB-->>API: Bản ghi và con trỏ trang tiếp
        API->>API: Ẩn trường nhạy cảm theo vai trò
        API-->>UI: Danh sách nhật ký
        UI-->>U: Thời gian, mã phiếu, loại, số tiền, trạng thái
        U->>UI: Mở một bản ghi
        UI->>API: Lấy chi tiết theo mã
        API->>API: Kiểm tra quyền trên bản ghi
        API->>DB: Lấy phiếu và các sự kiện liên quan
        DB-->>API: Chi tiết, chứng từ được phép xem, lịch sử
        API-->>UI: Chi tiết đã lọc quyền
        UI-->>U: Hiển thị lịch sử giao dịch
    end
```

## 6. Trạng thái đề xuất

- Thu: nháp → chờ đối soát → đã ghi sổ; hoặc từ chối/hủy trước ghi sổ.
- Chi: nháp → chờ duyệt → đã duyệt → chờ thanh toán → đã ghi sổ; có nhánh từ chối hoặc thanh toán thất bại.
- Tạm ứng: nháp → chờ duyệt → đã duyệt → đã giải ngân → chờ quyết toán → chờ hoàn ứng/chi bổ sung → đã quyết toán. Quá hạn là cờ cảnh báo, không tự chuyển thành chi phí.
- Nhật ký: bất biến; phân biệt lịch sử sự kiện với sổ giao dịch tiền. Một phiếu có thể có nhiều sự kiện nhật ký.

## 7. Thiết lập tài khoản nhận quỹ

Quản trị viên mở menu Thiết lập → Tài khoản ngân hàng và mã QR nhận quỹ. Có thể bỏ qua lúc bắt đầu và bổ sung sau. Nhập ngân hàng, chủ tài khoản, số tài khoản; ảnh QR có thể thêm cùng lúc hoặc tải lên sau. Khi sửa tài khoản, cần tải QR tương ứng để bảo đảm đúng nơi nhận tiền. Sinh viên chỉ xem thông tin đã lưu, không thấy mục Thiết lập. Khi chưa cấu hình, giao diện thông báo chờ cập nhật. Trạng thái: chưa thiết lập, có tài khoản nhưng chưa có QR, có tài khoản và QR. Bản mẫu lưu cục bộ; việc phân quyền máy chủ cần bổ sung trước khi triển khai thật.
