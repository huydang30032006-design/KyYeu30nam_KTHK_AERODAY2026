# Kỷ yếu 30 năm đào tạo ngành Kỹ thuật Hàng không · AERODAY 2026

Bản web dạng sách lật của Kỷ yếu Sinh viên – Cựu sinh viên 1996–2026, Khoa Kỹ thuật Giao thông, Trường Đại học Bách khoa – ĐHQG-HCM.

Đây là trang tĩnh (HTML/CSS/JS thuần), không cần cài đặt hay build.

## Tính năng

- Lật trang hai mặt như sách thật trên máy tính, một trang trên điện thoại (vuốt ngang để lật).
- Bấm vào tên người, mã lớp hay mục lục để nhảy đến đúng thẻ thông tin. Ô của người đó được đánh dấu trong vài giây.
- Mục lục kèm nút chọn nhanh 84 lớp.
- Tìm kiếm không cần gõ dấu: tên, mã sinh viên (1998HK-06), lớp, cơ quan, nội dung bài viết.
- Phóng to để đọc kỹ, chế độ toàn màn hình, nút tải bản PDF.
- Mỗi trang có địa chỉ riêng, ví dụ `.../#p=127`, có thể gửi cho người khác.
- Phím tắt: ← → lật trang, `/` tìm kiếm, `M` mục lục, `Z` phóng to, `F` toàn màn hình, `Esc` đóng.

## Cấu trúc

```
index.html            trang chính
assets/               style.css, app.js, logo, ảnh bìa
pages/                487 trang (001.webp …) và ảnh nhỏ (t001.webp …)
data/book.json        mục lục, danh sách 1.900 người, liên kết trong từng trang
data/text.json        chữ của từng trang để tìm kiếm
KyYeu_30nam_KTHK_AERODAY2026.pdf   bản PDF để tải
netlify.toml          cấu hình Netlify
```

## Chạy thử trên máy

Mở terminal trong thư mục này rồi chạy:

```
python -m http.server 8000
```

Sau đó vào http://localhost:8000. Mở trực tiếp file index.html bằng trình duyệt sẽ không tải được dữ liệu, nên cần chạy như trên.

## Đưa lên GitHub

1. Tạo repository mới trên GitHub. Nên chọn **Private** vì kỷ yếu có số điện thoại và email của mọi người.
2. Trong thư mục này:
   ```
   git init
   git add .
   git commit -m "Kỷ yếu 30 năm KTHK - AERODAY 2026"
   git branch -M main
   git remote add origin https://github.com/<tài-khoản>/<tên-repo>.git
   git push -u origin main
   ```
   Hoặc dùng GitHub Desktop, hoặc kéo thả file trên giao diện web (web chỉ cho tải tối đa 100 file mỗi lần, nên thư mục `pages/` cần tải nhiều đợt; dùng git sẽ nhanh hơn).

## Đưa lên Netlify

**Cách 1: nối với GitHub (tự cập nhật mỗi lần push)**
1. Vào app.netlify.com, chọn **Add new site → Import an existing project → GitHub**, chọn repo vừa tạo.
2. Build command để trống, Publish directory để `.`. Bấm **Deploy**.

**Cách 2: kéo thả**
1. Vào app.netlify.com/drop.
2. Kéo cả thư mục này (thư mục chứa `index.html`) vào trang.

Sau khi deploy, đổi tên miền con trong **Site configuration → Change site name**, ví dụ `kyyeu-kthk-30nam.netlify.app`.

## Riêng tư

Trang đã chặn Google và các công cụ tìm kiếm lập chỉ mục (`robots.txt`, thẻ `noindex`), nên chỉ người có đường link mới vào được. Tuy vậy ai có link vẫn xem được toàn bộ. Nếu muốn giới hạn người xem, có thể bật **Password protection** trong Netlify (gói trả phí) hoặc để repo GitHub ở chế độ Private.
