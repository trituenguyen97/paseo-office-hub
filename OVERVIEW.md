Office Hub đưa bốn thông tin của ngày làm việc lên sidebar của Paseo: trạng thái nhà vệ sinh, lịch họp hôm nay, mail chưa đọc và các ghi nhớ lấy từ Notepad++. Mỗi mục là một thẻ có thể mở rộng, bật tắt, đổi tên và đổi màu riêng. Khi cuộc họp bắt đầu, plugin hiện một popup giữa màn hình.

## Cách hoạt động

Lịch và mail được đọc từ Outlook cổ điển trên máy qua COM, mỗi lần mất vài giây và không gửi gì ra ngoài. Nếu Outlook cổ điển không dùng được, plugin dùng một agent Claude gọi connector Microsoft 365 để đọc cùng dữ liệu. Ghi nhớ lấy từ file phiên làm việc và file backup của Notepad++, cập nhật mỗi phút. Với mỗi ghi nhớ chưa xong, dòng mới gõ trong Notepad++ được nối xuống cuối nội dung. Ghi nhớ đã đánh dấu xong thì không đổi nữa.

## Thiết lập

Plugin chạy trên Windows. Mở cài đặt **Văn phòng** của plugin để chọn mục hiển thị. Mục nhà vệ sinh tắt sẵn. Với lịch và mail, cần Outlook cổ điển đã thêm tài khoản, hoặc connector Microsoft 365 đã được kết nối trong Claude. Hai nút **Kiểm tra** trong cài đặt báo thiếu gì và mở bước đăng nhập tương ứng.

## Tùy chọn

- Bật tắt từng mục, đặt tên và màu riêng cho từng mục.
- Bật tắt popup tới giờ họp, cũng bằng biểu tượng chuông trên thẻ lịch.
- Nhà vệ sinh: chỉ Men, chỉ Women hoặc cả hai.
- Nguồn lịch và mail: tự động, chỉ Outlook trên máy, hoặc chỉ connector.

## Dữ liệu và quyền

Plugin đọc Outlook, thư mục dữ liệu của Notepad++ và ghi các file riêng vào thư mục `.paseo` của người dùng. Trang trạng thái nhà vệ sinh được lấy bằng một yêu cầu GET tới `keystone-quest.pages.dev`, không kèm thông tin đăng nhập. Gợi ý tiêu đề và hạn chót gửi tối đa 4000 ký tự đầu của mỗi ghi nhớ mới hoặc vừa sửa tới provider Claude đã cấu hình. Khi đọc Outlook bằng connector, agent Claude thấy tiêu đề, người gửi và đoạn xem trước của mail cùng tiêu đề cuộc họp. Agent này chạy ở chế độ `bypassPermissions` và chỉ được dặn dùng hai công cụ tìm kiếm của connector.

## Giới hạn

Chỉ Windows. Popup họp chỉ hiện khi app Paseo đang mở. Mail chỉ gồm thư chưa đọc nhận trong ngày. Nút mở New Outlook dựa vào giao diện của nó nên có thể hỏng khi giao diện thay đổi. Đọc qua connector chậm và tốn token.
