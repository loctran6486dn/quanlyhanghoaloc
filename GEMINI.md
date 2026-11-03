# Bộ Quy Chuẩn Thiết Kế & Trải Nghiệm Người Dùng (UI/UX Invariants)

Tài liệu này là kim chỉ nam bắt buộc cho mọi thao tác chỉnh sửa giao diện, bổ sung tính năng hoặc tạo mới màn hình trong ứng dụng Quản Lý Hàng Hóa.

---

## 1. Phong Cách Thiết Kế & Hệ Thống Màu Sắc (Bento Neo-Pop)

1. **Ngôn ngữ thẩm mỹ**: **Wordsy Neo-Pop / Bento Modern Native iOS**.
   - Thẻ giao diện dạng Bento Grid bo cong mềm mại (`border-radius: 14px - 20px`), viền thanh mảnh (`1.5px solid #e4e4e7` hoặc `#cbd5e1`), nền trắng `#ffffff` nổi bật trên nền ứng dụng xám nhẹ `#f8fafc`.
   - Typography: Font chữ chính `Plus Jakarta Sans`, font dự phòng hệ thống Apple `-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`.
   - Phân cấp cỡ chữ: Tiêu đề thẻ (font-weight: 800 - 900), nhãn trường (700), văn bản chi tiết (500 - 600).

2. **Bảng màu Bento Pastel có chủ đích chức năng**:
   - **Mint / Xanh lá** (`#f0fdf4`, viền `#bbf7d0`, chữ `#15803d`): Tồn kho, còn hàng, doanh thu, lợi nhuận, badge tích cực.
   - **Lilac / Tím hoa cà** (`#faf5ff`, viền `#ddd6fe`, chữ `#6d28d9`): Phân loại, thông tin sản phẩm, thẻ tag đặc trưng.
   - **Blue / Xanh dương** (`#eff6ff`, viền `#bae6fd`, chữ `#2563eb`): Hình ảnh sản phẩm, giá bán niêm yết, trạng thái active.
   - **Coral / Đỏ pastel** (`#fff8f8`, viền `#fecdd3`, chữ `#be123c`): Hết hàng, chi phí, hành động xóa nguy hiểm.
   - **Apricot / Cam pastel** (`#fffaf0`, viền `#fed7aa`, chữ `#c2410c`): Cảnh báo sắp hết hàng, công nợ, khách cọc.
   - **Slate / Xám trung tính** (`#f8fafc`, viền `#e2e8f0`, chữ `#334155`): Thông số kỹ thuật, ghi chú phụ, chip chưa chọn.

---

## 2. Quy Tắc Icon Hệ Thống (Strict Icon Standards)

1. **Tuyệt đối KHÔNG sử dụng emoji hệ điều hành**:
   - Tuyệt đối cấm dùng emoji dạng text (`👕`, `👟`, `🎨`, `📦`, `🔍`, `💡`, `❌`, `✅`,...) trong menu, nút bấm, tiêu đề modal hay nhãn phân loại.
   - Mọi biểu tượng bắt buộc sử dụng **Minimalist Inline SVG Stroke (Lucide / Feather style)** đồng nhất:
     ```html
     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
       ...
     </svg>
     ```
2. **Nút bấm tiện ích dạng Icon-Only (Không chứa text rườm rà)**:
   - Các nút tiện ích phụ (như **Sao chép thông tin**, **Lưu hình ảnh về máy**, **Đóng modal**, **Xóa hình**) bắt buộc thiết kế dạng hình vuông bo góc hoặc hình tròn icon-only (`width: 28px - 32px`, `height: 28px - 32px`, `padding: 0`, `display: inline-flex`, `align-items: center`, `justify-content: center`).
   - Phản hồi tương tác (feedback) trực tiếp bằng icon (ví dụ: chuyển sang icon dấu tích xanh `✓` trong 1.5 - 2 giây), không chèn thêm dòng text phụ làm vỡ bố cục trên mobile.

---

## 3. Quy Chuẩn Phân Loại Hàng Hóa & Popup Lựa Chọn

1. **Cấu trúc 4 cột phân loại chuẩn**:
   - Cột 1: **Mẫu hàng** (text input tự do)
   - Cột 2: **Màu sắc** (trigger mở bảng chọn màu)
   - Cột 3: **Size** (trigger mở bảng chọn size 2 cột)
   - Cột 4: **Số lượng** (`inputmode="numeric"`, tự động tính tổng tồn kho)
   - Khi tạo hàng mới, mặc định luôn hiển thị sẵn 1 hàng phân loại trống để tiện nhập liệu ngay.
2. **Chống phiền toái bàn phím ảo trên điện thoại**:
   - Các ô kích hoạt bảng chọn (Màu sắc, Size) phải đặt thuộc tính `readonly` và chủ động gọi `document.activeElement.blur()` để bàn phím ảo không tự động bật lên che khuất popup.
   - Bàn phím ảo chỉ được bật lên khi người dùng chủ động chạm vào ô "Tự gõ" bên trong popup.
3. **Popup Chọn Màu Sắc (`#modalVariantColorPicker`)**:
   - Nhóm 1: Màu sẵn có trong kho của chính sản phẩm đó.
   - Nhóm 2: Bảng màu phong phú (Cơ bản, Xanh, Đỏ/Vàng, Hồng/Tím) kèm chấm tròn màu minh họa sắc nét (`width: 14px; height: 14px; border-radius: 50%`).
   - Nhóm 3: Ô tự gõ màu khác nếu danh sách không có sẵn.
   - Khi click chọn màu trong bảng: Tự động điền tên màu vào ô tự gõ và áp dụng ngay vào dòng phân loại.
4. **Popup Chọn Size (`#modalVariantSizePicker`)**:
   - Bố cục 2 cột cân đối: Cột 1 là **Thời trang** (S, M, L, XL, 2XL, 3XL, Freesize), Cột 2 là **Giày dép** (35 - 44).
   - Icon phân nhóm Thời trang & Giày dép phải dùng SVG vector đồng bộ, không dùng emoji.

---

## 4. Quản Lý Hình Ảnh & Trình Xem Ảnh Lớn (Lightbox)

1. **Tối đa 5 hình ảnh / sản phẩm**:
   - Có badge hiển thị số lượng trực quan `(X/5)`.
   - Tự động nén ảnh phía Client qua HTML5 Canvas (tối đa 900x900px, JPEG chất lượng 0.8) để ảnh sắc nét, dung lượng siêu nhẹ (~40-60KB/ảnh), chống tràn quota Cloud Sync và tải tức thì.
   - Mỗi ô ảnh thumbnail có nút `&times;` đỏ góc trên để xóa từng ảnh.
2. **Trình Xem Ảnh Lớn (`#modalImageViewer`)**:
   - Nền tối mờ chuyên nghiệp (`backdrop-filter: blur(8px)`).
   - Có nút **Save (Icon-Only)** để tải/lưu ảnh về máy trên cả thanh điều khiển dưới chân và góc trên cạnh nút đóng.
   - Có mũi tên chuyển ảnh trước/sau (`◀`, `▶`), đếm số thứ tự `Ảnh X / N`, hỗ trợ phím tắt bàn phím (`ESC`, `ArrowLeft`, `ArrowRight`, `S` để lưu).

---

## 5. Trải Nghiệm Danh Sách Kho Hàng & Tương Tác Mở Rộng

1. **Bảo toàn số thứ tự sản phẩm**:
   - Mọi thẻ sản phẩm ngoài danh sách Kho Hàng luôn hiển thị huy hiệu số thứ tự tròn nguyên bản (`1`, `2`, `3`, `4`,...). Tuyệt đối không thay thế huy hiệu số bằng ảnh thumbnail.
2. **Tự động Cuộn Mượt (Auto Smooth-Scroll) lên Top khi mở chi tiết**:
   - Khi người dùng click vào một món hàng để mở rộng thông tin chi tiết, ứng dụng phải tự động cuộn thẻ sản phẩm đó lên sát đỉnh màn hình (cách thanh header cố định 8px).
   - Đảm bảo toàn bộ chi tiết bung ra (giá, lãi, phân loại, thư viện ảnh, mô tả, nút sửa/xóa) nằm trọn trong tầm mắt mà người dùng không cần dùng tay vuốt màn hình.
3. **Sắp xếp Thẻ Tag & Tên Hàng theo Tiếng Việt (Alpha B / A-Z)**:
   - Luôn sử dụng collation tiếng Việt chuẩn: `localeCompare(..., 'vi', { sensitivity: 'base' })`.
4. **Sự Kiện Click trong Modal Dialog**:
   - Khi gán sự kiện ủy quyền (delegation) cho các nút bên trong modal, luôn dùng cờ `{ capture: true }` trên `document` để không bị hàm `e.stopPropagation()` của modal backdrop/dialog chặn sự kiện.
