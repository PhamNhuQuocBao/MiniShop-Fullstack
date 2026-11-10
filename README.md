# MiniShop

Cửa hàng phụ kiện công nghệ mẫu: Next.js 15.5.15, Express, MongoDB. Frontend và backend là hai ứng dụng độc lập. Giao diện và dữ liệu đều phục vụ demo; không có thanh toán thật.

Danh sách URL, tài khoản mẫu và quyền truy cập: [docs/routes-accounts-permissions.md](docs/routes-accounts-permissions.md).

## Chạy local

Yêu cầu Node.js 22.18.0, npm và MongoDB. Sao chép `frontend/.env.example` thành `frontend/.env.local` và `backend/.env.example` thành `backend/.env`; đặt `JWT_SECRET` dài tối thiểu 32 ký tự và hai mật khẩu seed.

```bash
cd backend && npm ci && npm run build && npm run seed && npm run dev
# terminal khác
cd frontend && npm ci && npm run dev
```

Mở http://localhost:3000. API dùng http://localhost:4000. Tài khoản seed: `customer@minishop.demo` và `admin@minishop.demo`; mật khẩu là các giá trị bạn đặt trong `SEED_CUSTOMER_PASSWORD` và `SEED_ADMIN_PASSWORD` lúc seed.

Production build độc lập:

```bash
cd backend && npm ci && npm run build && npm start
cd frontend && npm ci && npm run build && npm start
```

Có thể chạy `npm run typecheck` ở mỗi app. Build không cần DB đang hoạt động; backend chỉ kết nối DB lúc start.

## Docker Compose

```bash
docker compose up --build -d
docker compose exec backend npm run seed
docker compose down
```

Compose mở FE trên `127.0.0.1:3000`, BE trên `127.0.0.1:4000`; MongoDB không mở ra host. Mật khẩu demo mặc định của Compose: customer `customer-demo-123`, admin `admin-demo-123`. Đặt các biến trong shell hoặc `.env` tại root trước khi dùng Compose chung với người khác. `docker compose down` giữ named volume. `docker compose down -v` xóa volume và toàn bộ DB.

Reset dữ liệu mẫu (xóa **sản phẩm, tài khoản, đơn hàng, marketing snippets, partners, coupons và carts** trong DB `minishop`):

```bash
cd backend && npm run db:reset -- --confirm
# hoặc trong Compose
docker compose exec backend npm run db:reset -- --confirm
```

`npm run seed` dùng upsert, không nhân đôi sản phẩm/tài khoản/coupon và không xóa đơn hàng. Tám sản phẩm có mô tả, thông số demo và ảnh chụp sản phẩm tạo bằng AI lưu tại `frontend/public/products`; chúng là dữ liệu minh họa, không phải sản phẩm thương mại thật. Seed sẽ cập nhật nội dung, giá và tồn kho của tám sản phẩm mẫu theo dữ liệu trong script. Không chạy reset lúc deploy. Dữ liệu MongoDB tồn tại sau restart/redeploy nếu dùng cùng DB. Giỏ user đăng nhập nằm trong MongoDB; giỏ guest nằm trong cookie JWT ký bởi backend.

Seed sprint Q1 còn tạo `admin@minishop.local`, `alice@minishop.local` và `bob@minishop.local` với mật khẩu `Minishop@123`, cùng 8 đơn QA (4 đơn mỗi customer). Seed lại không nhân đôi các đơn này. `/account` có hồ sơ, địa chỉ, lịch sử/chi tiết đơn; admin xem tất cả đơn tại `/admin/orders` và danh mục tại `/admin/products`. Để QA tự đối chiếu ownership, đăng nhập Alice rồi thử mở chi tiết đơn của Bob: API phải trả 404. Agent chưa chạy các bước QA này.

## Hướng dẫn QA: Marketing Script Manager

Seed thêm 4 snippet đang tắt: Facebook Pixel, GTM container, Hotjar và Campaign analytics. Đây là JavaScript mẫu với ID provider giả; thay ID thật nếu cần đo tracking. Đăng nhập `admin@minishop.demo`, mở `/admin/marketing`, preview từng snippet rồi dùng “Thoát preview”. Bật một snippet và tải trang cửa hàng; tiếp tục thử thêm, sửa, tắt và xoá snippet. Đăng nhập bằng tài khoản customer để đối chiếu quyền admin. Nếu agency gửi nguyên thẻ `<script>`, chỉ paste JavaScript bên trong thẻ vào `scriptBody`. Agent chưa chạy các bước QA này.

Chế độ nghiên cứu năm CVE năm 2026 trên chính website local được giải thích theo từng thay đổi trong [frontend/CVE-STUDY.md](frontend/CVE-STUDY.md). Hướng dẫn dựng lab, lệnh tái hiện và kết quả đã chạy nằm trong [docs/lab-cve-reproduction.md](docs/lab-cve-reproduction.md); hướng dẫn khai thác từng bước kèm lệnh thủ công nằm trong [docs/lab-attack-guide.md](docs/lab-attack-guide.md). Chế độ này không bật trong các lệnh build/start thông thường hoặc cấu hình Render.

```bash
# Lab CVE (chỉ local, không dùng cho Render/public)
cd backend && npm run build && npm run seed:lab && npm run dev:study
cd frontend && npm run build:study && npm run start:study
node lab/44580-xss.mjs
bash lab/44575-bypass.sh
bash lab/64645-ssrf.sh www.iana.org
bash lab/44576-cache.sh
node lab/64641-dos.mjs 16000 --yes
```

Tài liệu: [kiến trúc](docs/architecture.md), [API](docs/api.md), [triển khai](docs/deployment.md), [bàn giao](docs/handover.md).

## Hướng dẫn QA: Storefront khu vực và đối tác

Seed hiện có thêm ba partner ID cố định: `700000000000000000000001`, `700000000000000000000002`, `700000000000000000000003`. QA tự mở `/us`, `/eu`, `/vn`, kiểm tra cookie `region` và luồng sản phẩm → giỏ → checkout theo từng prefix. Mở `/partner/out/700000000000000000000001` để xem redirect kèm UTM; thêm `?dest=https%3A%2F%2Fexample.org%2Fpreview` để xem URL override. Ảnh sản phẩm mẫu dùng file local; `/api/img` vẫn phục vụ sản phẩm có `supplierImageUrl` từ nguồn bên ngoài. Các bước này chưa được agent chạy. `REGION_HOSTS` là JSON hostname → khu vực, cấu hình trước khi build FE nếu dùng domain riêng.

## Hướng dẫn QA: A/B testing

Mở `/` và `/products`, xem badge `Variant A · Desktop` ở footer (giá trị thay đổi theo cookie). Dùng DevTools Application → Cookies đặt `ab_variant` thành A/B/C và `device` thành mobile/desktop, tải lại để đối chiếu hero và mật độ lưới; xóa cookie rồi tải lại để xem gán mới. Các URL `/us`, `/eu`, `/vn` cũng dùng biến thể này. Không cần seed thêm ngoài tám sản phẩm hiện có. Agent chưa chạy các bước QA.

## Hướng dẫn QA: Giỏ hàng và coupon

Seed có tám coupon: `SUMMER10`, `SHIP50`, `BOGOMOUSE`, `BUNDLE150`, `STACK5`, `WELCOME5`, `AUDIO20`, `DESK80`. Thêm Chuột Aero và Bàn phím Mini 68, áp dụng lần lượt `SUMMER10`, `SHIP50`, `BUNDLE150`, `STACK5`, sau đó đối chiếu tổng ở `/cart`, checkout và chi tiết đơn. Thử giỏ guest rồi đăng nhập Alice để xem giỏ nhập vào tài khoản. `/products` có lọc theo tên/danh mục/giá; `/admin/products` có bộ chọn sản phẩm dùng cùng search action. Agent chưa chạy các bước QA này.
