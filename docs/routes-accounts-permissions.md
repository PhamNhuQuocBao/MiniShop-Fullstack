# MiniShop — routes, tài khoản và phân quyền

Tài liệu này mô tả **code hiện tại** của hai ứng dụng độc lập: frontend Next.js tại `frontend/` và backend Express tại `backend/`. Trong Docker Compose local, giao diện ở `http://localhost:3000`, API ở `http://localhost:4000`. Trên môi trường khác, thay bằng URL của từng service.

## Vai trò và cách đăng nhập

| Đối tượng | Quyền chính |
|---|---|
| Khách chưa đăng nhập | Xem và tìm sản phẩm, dùng giỏ guest, áp coupon, đặt đơn mẫu, xem liên kết đối tác. Không xem trang tài khoản hoặc admin. |
| `CUSTOMER` | Mọi quyền của khách, thêm quyền xem/sửa hồ sơ, thêm địa chỉ và xem **chỉ đơn hàng của chính mình**. |
| `ADMIN` | Mọi quyền của `CUSTOMER`, thêm dashboard admin, xem tất cả đơn, xem danh mục sản phẩm và quản lý marketing snippets. |

`POST /api/auth/login` trả JWT; Server Action của frontend lưu token vào cookie `minishop_session` (`httpOnly`, thời hạn 7 ngày). Khi gọi API cần đăng nhập, frontend gửi token qua `Authorization: Bearer <token>`. Backend chuẩn hóa role cũ viết thường `admin`/`customer` thành `ADMIN`/`CUSTOMER` khi đọc. Giỏ guest dùng cookie ký `minishop_guest_cart`; khi đăng nhập, frontend gọi API gộp giỏ guest vào giỏ tài khoản.

### Tài khoản do seed tạo

| Email | Vai trò | Mật khẩu khi seed | Dữ liệu mẫu |
|---|---|---|---|
| `admin@minishop.demo` | `ADMIN` | Biến `SEED_ADMIN_PASSWORD`; Docker Compose local mặc định `admin-demo-123` | Quản trị mẫu |
| `customer@minishop.demo` | `CUSTOMER` | Biến `SEED_CUSTOMER_PASSWORD`; Docker Compose local mặc định `customer-demo-123` | Khách hàng mẫu |
| `admin@minishop.local` | `ADMIN` | `Minishop@123` | Tài khoản QA admin |
| `alice@minishop.local` | `CUSTOMER` | `Minishop@123` khi tạo lần đầu | 4 đơn QA và địa chỉ nhà |
| `bob@minishop.local` | `CUSTOMER` | `Minishop@123` khi tạo lần đầu | 4 đơn QA và địa chỉ văn phòng |

Hai mật khẩu `.demo` có thể khác mặc định nếu người chạy seed đặt biến môi trường khác. Seed cập nhật mật khẩu hai tài khoản `.demo` khi chạy lại; ba tài khoản `.local` dùng `setOnInsert`, nên seed lại **không** đổi mật khẩu nếu tài khoản đã tồn tại. Tài khoản chỉ có sau khi chạy `npm run seed` trên backend. Không dùng các mật khẩu mẫu này cho môi trường công khai.

## Routes giao diện frontend

Các route dưới đây là URL trên **frontend**, không phải endpoint Express.

| Route | Ai truy cập | Nội dung / hành vi |
|---|---|---|
| `/` | Công khai | Trang chủ, danh sách sản phẩm, tìm theo `?q=...`; hero thay đổi theo cookie A/B/C. |
| `/products` | Công khai | Danh mục sản phẩm; lọc theo tên, danh mục, giá qua Server Action gọi backend. |
| `/products/[id]` | Công khai | Chi tiết, mô tả, thông số, giá, tồn kho và thêm vào giỏ. |
| `/cart` | Khách hoặc đã đăng nhập | Sửa giỏ, áp/xóa coupon, xem tổng tiền. |
| `/checkout` | Khách hoặc đã đăng nhập | Gửi thông tin giao hàng và đặt đơn mẫu. |
| `/login` | Công khai | Đăng nhập; sau đăng nhập chuyển tới `next` hợp lệ hoặc `/account`. |
| `/account` | `CUSTOMER`, `ADMIN` | Tổng quan tài khoản và đăng xuất. |
| `/account/orders` | `CUSTOMER`, `ADMIN` | Chỉ đơn của tài khoản hiện tại. |
| `/account/orders/[id]` | `CUSTOMER`, `ADMIN` | Chi tiết đơn; backend kiểm tra `userId` sở hữu đơn. |
| `/account/profile` | `CUSTOMER`, `ADMIN` | Cập nhật tên, email, điện thoại. |
| `/account/addresses` | `CUSTOMER`, `ADMIN` | Xem và thêm địa chỉ. |
| `/admin` | `ADMIN` | Báo cáo số sản phẩm, số đơn và doanh thu mẫu từ backend. |
| `/admin/orders` | `ADMIN` | Danh sách tất cả đơn. |
| `/admin/orders/[id]` | `ADMIN` | Chi tiết một đơn bất kỳ. |
| `/admin/products` | `ADMIN` | Danh mục/tồn kho và bộ chọn sản phẩm. |
| `/admin/marketing` | `ADMIN` | Tạo, xem, sửa, xóa, bật/tắt và preview marketing snippets. |
| `/dashboard` | `ADMIN` qua middleware | **Fixture lab** với số liệu giả; không phải dashboard admin nghiệp vụ. |

Các route cửa hàng `/`, `/products`, `/products/[id]`, `/cart`, `/checkout` còn có bản theo khu vực: thêm prefix `/us`, `/eu` hoặc `/vn`, ví dụ `/vn/products`. Prefix đặt cookie `region`; nếu chưa có khu vực thì mặc định `us`. `REGION_HOSTS` có thể map hostname sang prefix bằng rewrite. Account và admin không có bản prefix khu vực.

`/account/*` dùng server layout kiểm tra phiên; chưa đăng nhập chuyển `/login`. `/admin/*` dùng server layout kiểm tra role; chưa đăng nhập chuyển `/login`, không phải admin chuyển `/`. Server Actions của account/marketing cũng kiểm tra phiên hoặc role trước khi gọi backend. `/dashboard` là ngoại lệ lab: quyền truy cập của route này được kiểm tra trong middleware.

## Route handlers của frontend

| Method | Route | Ai truy cập | Mục đích |
|---|---|---|---|
| `GET` | `/api/health` | Công khai | Health check frontend. |
| `GET` | `/api/img?src=<url>` | Công khai | Proxy ảnh remote, trả placeholder khi lỗi; ảnh seed hiện dùng file local. |
| `GET` | `/partner/out/[partnerId]` | Công khai | Lấy partner từ backend, thêm UTM rồi redirect. `?dest=` ghi đè URL đích để thử liên kết. |
| `GET` | `/api/admin/demo` | `ADMIN` qua middleware | **Fixture lab** trả marker và số liệu giả. |

Server Actions như đăng nhập, đặt đơn, tìm sản phẩm, cập nhật tài khoản và CRUD marketing **không có URL API cố định** để gọi trực tiếp. Chúng chạy trên frontend rồi gọi endpoint backend tương ứng.

## API backend Express

Trong bảng: **Công khai** không cần token; **Guest hoặc tài khoản** dùng giỏ guest nếu không có Bearer token, dùng giỏ MongoDB nếu đăng nhập; **Đăng nhập** chấp nhận cả `CUSTOMER` và `ADMIN`; **Admin** chỉ chấp nhận `ADMIN`.

| Method | Route | Quyền | Mục đích |
|---|---|---|---|
| `GET` | `/api/health` | Công khai | Trạng thái backend và kết nối MongoDB. |
| `GET` | `/api/products` | Công khai | Danh sách; có thể lọc tên bằng `?q=...`. |
| `GET` | `/api/products/:id` | Công khai | Chi tiết sản phẩm. |
| `POST` | `/api/products/search` | Công khai | Tìm theo mảng `filters` cho tên, danh mục và giá. |
| `POST` | `/api/auth/login` | Công khai | Xác thực email/mật khẩu, trả JWT và user. |
| `GET` | `/api/auth/me` | Đăng nhập | Lấy user của phiên hiện tại. |
| `POST` | `/api/orders` | Guest hoặc tài khoản | Tạo đơn từ giỏ và thông tin giao hàng; backend tính lại giá/coupon. |
| `GET` | `/api/cart` | Guest hoặc tài khoản | Xem giỏ. |
| `POST` | `/api/cart/items` | Guest hoặc tài khoản | Thêm sản phẩm. |
| `PATCH` | `/api/cart/items/:lineId` | Guest hoặc tài khoản | Đổi số lượng. |
| `DELETE` | `/api/cart/items/:lineId` | Guest hoặc tài khoản | Xóa dòng hàng. |
| `POST` | `/api/cart/coupons` | Guest hoặc tài khoản | Áp coupon. |
| `DELETE` | `/api/cart/coupons/:code` | Guest hoặc tài khoản | Gỡ coupon. |
| `POST` | `/api/cart/merge` | Đăng nhập | Gộp giỏ guest vào giỏ tài khoản sau đăng nhập. |
| `GET` | `/api/account/orders` | Đăng nhập | Chỉ đơn của user hiện tại. |
| `GET` | `/api/account/orders/:id` | Đăng nhập + sở hữu đơn | Chi tiết đơn; đơn không thuộc user trả 404. |
| `PATCH` | `/api/account/profile` | Đăng nhập | Sửa hồ sơ của chính mình. |
| `GET` | `/api/account/addresses` | Đăng nhập | Xem địa chỉ của chính mình. |
| `POST` | `/api/account/addresses` | Đăng nhập | Thêm địa chỉ cho chính mình. |
| `GET` | `/api/admin/summary` | Admin | Số sản phẩm, đơn và tổng doanh thu. |
| `GET` | `/api/admin/orders` | Admin | Tất cả đơn hàng. |
| `GET` | `/api/admin/orders/:id` | Admin | Chi tiết một đơn bất kỳ. |
| `GET` | `/api/marketing/snippets/enabled` | Công khai | Snippet đang bật để frontend render. |
| `GET` | `/api/marketing/snippets` | Admin | Danh sách toàn bộ snippet. |
| `GET` | `/api/marketing/snippets/:id` | Admin | Chi tiết, gồm snippet đang tắt để preview. |
| `POST` | `/api/marketing/snippets` | Admin | Tạo snippet. |
| `PATCH` | `/api/marketing/snippets/:id` | Admin | Sửa snippet. |
| `DELETE` | `/api/marketing/snippets/:id` | Admin | Xóa snippet. |
| `GET` | `/api/partners/:id` | Công khai | Lấy partner đang bật để route frontend redirect. |

Backend dùng `requireAuth`/`requireRole('ADMIN')` cho nhóm account, admin orders và marketing. Các endpoint giỏ/tạo đơn tự phân biệt guest với tài khoản; Bearer token không hợp lệ bị từ chối. API thường trả `401` khi thiếu/không hợp lệ phiên, `403` khi thiếu quyền và `404` khi không tìm thấy tài nguyên hoặc đơn không thuộc user. Riêng `/api/admin/summary` trả `403` cả khi chưa có phiên.

## Preview marketing

Admin bấm **Preview** tại `/admin/marketing`: Server Action kiểm tra role, đọc snippet qua endpoint admin, đặt cookie `preview_snippet` (`httpOnly`, 1 giờ) rồi chuyển về `/`. Khi cookie còn hiệu lực và user vẫn là admin, root layout chỉ render snippet được chọn, kể cả khi snippet đang tắt; banner **Thoát preview** xóa cookie và chuyển về `/admin/marketing`. Người không phải admin không thể bắt đầu preview qua Server Action; lúc đọc cookie, component cũng kiểm tra lại role.
