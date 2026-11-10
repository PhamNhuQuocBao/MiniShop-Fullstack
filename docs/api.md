# API

Base URL local: `http://localhost:4000`. JSON UTF-8. Lỗi có dạng `{"error":{"code":"VALIDATION_ERROR","message":"..."}}`.

| Method | Path | Kết quả |
|---|---|---|
| GET | `/api/health` | `{"status":"ok"}` (200), hoặc `unavailable` (503) |
| GET | `/api/products?q=chuột` | `{products: Product[]}` |
| GET | `/api/products/:id` | `{product: Product}`; ID sai 400, không có 404 |
| POST | `/api/products/search` | `{products: Product[]}` theo `{filters: FilterNode[]}` |
| GET | `/api/cart` | `{cart}`; Bearer user hoặc cookie guest |
| POST | `/api/cart/items` | `{cart,guestToken?}`; `{productId,quantity}` |
| PATCH | `/api/cart/items/:lineId` | `{cart,guestToken?}`; `{quantity}` |
| DELETE | `/api/cart/items/:lineId` | `{cart,guestToken?}` |
| POST | `/api/cart/coupons` | `{cart,guestToken?}`; `{code}` |
| DELETE | `/api/cart/coupons/:code` | `{cart,guestToken?}` |
| POST | `/api/cart/merge` | `{cart}`; nhập guest cart khi đã đăng nhập |
| POST | `/api/auth/login` | `{token,user}` hoặc 401 |
| GET | `/api/auth/me` | `{user}` với Bearer token, hoặc 401 |
| POST | `/api/orders` | `{order}` (201), lỗi input 400, sản phẩm thiếu 404, thiếu kho 409 |
| GET | `/api/admin/summary` | `{summary:{productCount,orderCount,revenue}}` với token admin, hoặc 403 |
| GET | `/api/marketing/snippets/enabled` | `{snippets: MarketingSnippet[]}` chỉ gồm snippet bật; public |
| GET | `/api/partners/:id` | `{partner:{id,name,trackingUrl,enabled}}`; public, chỉ partner đang bật |
| GET | `/api/marketing/snippets` | `{snippets: MarketingSnippet[]}`; admin |
| GET | `/api/marketing/snippets/:id` | `{snippet: MarketingSnippet}`; admin, ID sai 400, không có 404 |
| POST | `/api/marketing/snippets` | `{snippet: MarketingSnippet}` (201); admin |
| PATCH | `/api/marketing/snippets/:id` | `{snippet: MarketingSnippet}`; admin |
| DELETE | `/api/marketing/snippets/:id` | `{success:true}`; admin |
| GET | `/api/account/orders` | `{orders: Order[]}` của user hiện tại; auth |
| GET | `/api/account/orders/:id` | `{order: Order}`; auth và ownership, đơn khác user trả 404 |
| PATCH | `/api/account/profile` | `{user}`; cập nhật name/email/phone, auth |
| GET | `/api/account/addresses` | `{addresses: Address[]}`; auth |
| POST | `/api/account/addresses` | `{addresses: Address[]}` (201); auth |
| GET | `/api/admin/orders` | `{orders: Order[]}`; admin |
| GET | `/api/admin/orders/:id` | `{order: Order}`; admin |

Product DTO: `id`, `name`, `slug`, `description`, `image`, `supplierImageUrl`, `category`, `price` (VND nguyên), `stock`. User DTO: `id`, `name`, `email`, `role`.

Cart DTO: `lines` chứa `lineId`, `product`, `quantity`; thêm `appliedCoupons`, `subtotal`, `discounts` (`code`, `amount`) và `total`. Guest mutation trả `guestToken` để FE lưu trong cookie HttpOnly `minishop_guest_cart`; user đăng nhập dùng Bearer token và Cart MongoDB. Coupon lỗi điều kiện trả `COUPON_INVALID` 422; thiếu kho 409. Rule ví dụ: `{"op":"and","rules":[{"op":"minQuantity","productSlug":"chuot-aero","min":1},{"op":"category","category":"input","min":2}]}`. Node `coupon` dùng `{"op":"coupon","code":"SUMMER10"}` và cần coupon đó đã được áp dụng; `mutualExclusionGroup` dùng `{"op":"mutualExclusionGroup","group":"seasonal"}`. Tối đa 5 tầng; vòng tham chiếu không hợp lệ. Tám mã seed được mô tả trong README backend.

FilterNode ví dụ: `{"field":"name","operator":"contains","value":"Chuột"}`, `{"field":"category","operator":"eq","value":"input"}`, `{"field":"price","operator":"lte","value":500000}`. Mảng filter được nối AND.

MarketingSnippet DTO: `id` (MongoDB ObjectId dạng chuỗi), `name`, `provider` (`facebook`, `gtm`, `tiktok`, `hotjar`, `custom`), `scriptBody` (JavaScript thuần), `placement` (`beforeInteractive`, `afterInteractive`), `enabled`, `createdAt`, `updatedAt`. Ví dụ POST: `{"name":"Campaign mùa hè","provider":"custom","scriptBody":"console.log('campaign');","placement":"afterInteractive","enabled":false}`. Các route admin cần `Authorization: Bearer <token>`; thiếu token trả 401, thiếu role admin trả 403. Dữ liệu sai trả `VALIDATION_ERROR` 400; ID sai `INVALID_ID` 400; ID không có `NOT_FOUND` 404.

User DTO trả role `CUSTOMER` hoặc `ADMIN` và phone (có thể rỗng). Order DTO có thêm `userId`, `shippingStatus` (`pending`, `processing`, `shipped`, `delivered`, `cancelled`), `trackingNumber`, `createdAt`, `updatedAt`; đơn cũ không có trạng thái giao hàng được hiển thị là `pending`. Ví dụ PATCH profile: `{"name":"Nguyễn Alice","phone":"0901234567"}`. Ví dụ POST address: `{"label":"Nhà","name":"Nguyễn Alice","phone":"0901234567","address":"12 Nguyễn Trãi, Quận 1, TP.HCM"}`. Email trùng trả 409; ID sai 400; ID hợp lệ nhưng không có hoặc không thuộc user trả 404.

Ví dụ login: `{"email":"customer@minishop.demo","password":"<mật khẩu đã seed>"}`. Ví dụ order: `{"shipping":{"name":"Nguyễn An","phone":"0901234567","address":"12 Đường A, Hà Nội"}}` sau khi đã thêm sản phẩm vào cart. `items` vẫn được nhận cho client cũ khi cart trống. Response order gồm `id`, `code`, `shipping`, `items` (productId, name, unitPrice, quantity), `subtotal`, `discounts`, `appliedCoupons`, `total`, `status`. Client không gửi giá; backend đọc giá/tồn kho hiện tại, tính lại coupon và chụp giá khi lưu đơn. Header token nếu có: `Authorization: Bearer <token>`.

FE có fixture riêng `GET /api/admin/demo`: khi Middleware xác nhận cookie admin, trả `{"marker":"ADMIN_DEMO_ONLY","summary":{"products":8,"orders":12}}`. Thiếu phiên trả 401, customer trả 403. Đây không phải endpoint BE và không chứa dữ liệu MongoDB.
