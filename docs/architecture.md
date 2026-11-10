# Kiến trúc

`frontend/` là Next.js App Router trên Node.js. Trang danh sách và chi tiết lấy dữ liệu qua server fetch tới `API_BASE_URL`. Login, checkout và mutation giỏ gọi Server Actions; cookie HttpOnly cùng origin FE lưu JWT phiên và guest cart. `backend/` là Express API, kết nối MongoDB qua Mongoose trước khi nghe cổng. BE kiểm tra token, chữ ký, hạn dùng, vai trò và tính đơn giá/tổng tiền từ Product trong DB.

Các model: Product (name, slug, description, image key, category, price VND, stock), User (name, email unique, bcrypt password hash, role), Order (code unique, userId tùy chọn, shipping, dòng hàng chụp giá, subtotal, discounts, total, status), Cart (userId duy nhất, lines, appliedCoupons), Coupon (code, type, value, rules, stackable, maxUses, uses, expiresAt). Tất cả có timestamps. JWT không lưu phiên server; logout xóa cookie FE, token cũ tự hết hạn sau 7 ngày. Để thu hồi phiên trước hạn cần thêm cơ chế revoke.

MarketingSnippet lưu name, provider, JavaScript thuần, placement, enabled và timestamps trong MongoDB. Express cung cấp CRUD cho admin và endpoint public chỉ trả snippet đang bật. Root layout FE đọc danh sách tại runtime và render qua `next/script`. Preview dùng cookie HttpOnly một giờ; FE xác nhận admin và gọi API admin để lấy cả snippet đang tắt. Server Actions kiểm tra quyền, gửi Bearer token cho BE và làm mới root layout sau mutation.

Khu vực tài khoản có layout sidebar với Link tới đơn hàng, hồ sơ và địa chỉ. User có thêm role viết hoa, phone và mảng addresses; auth chấp nhận token/dữ liệu role viết thường cũ rồi chuẩn hóa trong DTO. Order có shippingStatus và trackingNumber. Account API chỉ truy vấn đơn theo userId từ phiên, còn admin orders API yêu cầu role ADMIN. Seed QA tạo 3 user mới và 8 đơn theo mã ổn định; không xóa tài khoản hoặc đơn cũ.

Storefront có route theo `/us`, `/eu`, `/vn` cho danh sách, chi tiết, giỏ và checkout; middleware ghi cookie `region` 30 ngày. `REGION_HOSTS` tạo rewrite theo Host header tại build. Product có `supplierImageUrl` tùy chọn; FE route `/api/img` stream ảnh remote hoặc trả SVG placeholder. Partner lưu name, trackingUrl, enabled trong MongoDB; FE route `/partner/out/[partnerId]` đọc BE public API rồi redirect kèm UTM, hỗ trợ `dest` override.

Middleware cũng gán cookie `ab_variant` A/B/C và `device` mobile/desktop cho khách mới, chuyển cookie vừa gán vào request để lần render đầu khớp badge. Helper server `getVariant()`/`getDevice()` đọc cookie cho trang chủ, PLP và footer. `/products` cùng các route khu vực hiển thị hero/card theo variant; PLP dùng device để thay mật độ lưới. Vì page dùng `cookies()` để chọn HTML, full-route cache chung không áp dụng; không có cache thủ công.

Giỏ đăng nhập lưu Cart trong MongoDB; giỏ guest được ký thành JWT 7 ngày bằng secret backend và FE đặt cookie cùng origin. CartProvider gọi Server Actions, Server Actions chuyển Bearer/cookie sang BE. Coupon engine ở `backend/src/services/coupon.ts` đánh giá rule lồng tối đa 5 tầng và coupon tham chiếu; checkout tính lại discount ở BE, giữ bản chụp trong Order và tăng lượt sử dụng. Product search nhận các FilterNode dạng phẳng, kết hợp AND; `/products` và admin picker dùng cùng Server Action.

Luồng: browser → Next.js FE → Express BE → MongoDB. Browser không gọi BE trực tiếp trong bản này. Admin FE kiểm tra người dùng và role qua `/api/auth/me`; BE cũng bảo vệ `/api/admin/summary` bằng role. Order cho phép khách không đăng nhập, thông tin giao hàng được kiểm tra ở BE. API trả lỗi dạng `{error:{code,message}}`.

Product image key được hiển thị bằng biểu tượng local thay vì ảnh từ dịch vụ ngoài. MongoDB là nơi lưu lâu dài; không có fallback bộ nhớ. Health BE 503 khi DB không sẵn sàng.

Fixture lab mới: `frontend/src/middleware.ts` bảo vệ `/dashboard` và `/api/admin/demo` bằng cách đọc cookie FE, xác thực token/role qua BE `/api/auth/me`. Dashboard và API demo chỉ chứa marker `ADMIN_DEMO_ONLY` cùng số liệu giả; chúng cố ý không kiểm tra quyền lần thứ hai trong handler để giữ đúng điều kiện nghiên cứu Middleware bypass. Route `/admin` cũ và API `/api/admin/summary` của BE vẫn kiểm tra quyền trong chính route. Bypass Middleware FE không cấp quyền đối với BE.
