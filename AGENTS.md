# MiniShop — hướng dẫn cho coding agent

## Phạm vi và mục tiêu

Áp dụng cho toàn bộ repository. Đọc file này trước khi thay đổi code.

Xây dựng website bán phụ kiện công nghệ nhỏ tên **MiniShop**, sử dụng **Next.js 15.5.15** và dữ liệu mẫu. Frontend Next.js và backend Express nằm trong hai thư mục độc lập; triển khai trên Render thành hai Web Service riêng.

Hoàn thành code, tích hợp API, production build và tài liệu. Không viết hoặc chạy test, smoke test, E2E hay kiểm thử thủ công. Người dùng tự deploy; agent không tạo dịch vụ hoặc triển khai lên tài khoản bên ngoài. Không dừng sau scaffold hoặc bản kế hoạch. Bảo toàn thay đổi có sẵn của người dùng. Tự quyết định các chi tiết thông thường; báo đúng những bước chưa chạy được cùng lý do.

## Cấu trúc bắt buộc

```text
frontend/              # Next.js App Router, TypeScript
backend/               # Express, TypeScript
docs/                  # Tài liệu dự án
```

Thư mục `docs/` nằm tại root, cùng cấp với `frontend/` và `backend/`.

Root có `README.md`, `AGENTS.md`, `.gitignore`, `docker-compose.yml` và `render.yaml`. Mỗi app có `package.json`, `package-lock.json`, `tsconfig.json`, `.env.example` và `Dockerfile` riêng.

Mỗi app hỗ trợ `dev`, `build`, `start`, `typecheck`; cài đặt, build và start độc lập từ thư mục của nó. Không import source của app còn lại và không phụ thuộc cài đặt workspace tại root. Không cần monorepo framework.

## Phiên bản và runtime

- Dùng chính xác `next: "15.5.15"`; không dùng `^`, `~`, `latest` hoặc canary cho Next.js. Phiên bản này được chọn cho lab tái hiện CVE (xem `docs/lab-cve-reproduction.md`), không phải bản an toàn để deploy public.
- Dùng React và React DOM `19.0.0` làm bộ phiên bản ban đầu; xác nhận peer dependencies và build thực tế trước khi chốt.
- Pin dependency trực tiếp bằng phiên bản cụ thể, tạo lockfile riêng cho mỗi app, dùng `npm ci` cho các lần cài sau.
- Không tự đổi phiên bản Next.js để xử lý lỗi build. Trước tiên kiểm tra cấu hình, API và dependency tương thích; nếu vẫn không chạy được, ghi rõ lỗi và phương án đề xuất.
- Chọn Node.js chạy được bộ dependency, ghi phiên bản thực tế đã kiểm tra và dùng thống nhất ở local, Docker, Render.

### Lab tái hiện CVE

Repo có thư mục `lab/` và chế độ `LOCAL_CVE_MODE=1` để tái hiện 5 CVE của Next.js phục vụ môn học. Được phép chạy các script trong `lab/` và hai lệnh `build:study`/`start:study` **chỉ trên máy local**. Không bật chế độ này trên Docker Compose dùng chung, Render hoặc host public. Quy định "không viết/chạy test" không áp dụng cho các script tái hiện CVE trong `lab/`, nhưng không mở rộng thành test suite hay E2E. Chi tiết và kết quả đã chạy: `docs/lab-cve-reproduction.md`.

## Kiến trúc

FE là ứng dụng Next.js có Node.js server, dùng App Router, Server Components và Server Actions cho các luồng phù hợp. Không dùng static export. Express cung cấp API nghiệp vụ độc lập.

Server Components lấy dữ liệu sản phẩm từ BE. Server Actions xử lý đăng nhập và đặt đơn bằng cách gọi BE. Client Components xử lý giỏ hàng, số lượng và tương tác trình duyệt. Tránh tạo nhiều lớp trung gian không cần thiết.

BE dùng **Express, TypeScript, zod, MongoDB và Mongoose**. MongoDB lưu sản phẩm, tài khoản và đơn hàng lâu dài.

## MongoDB và dữ liệu mẫu

BE dùng **MongoDB qua Mongoose** làm nơi lưu dữ liệu chính; FE chỉ truy cập dữ liệu qua API BE.

- `Product`: tên, slug, mô tả, ảnh, giá VND nguyên, tồn kho và timestamps.
- `User`: tên, email duy nhất, thông tin đăng nhập, role `CUSTOMER` hoặc `ADMIN`, địa chỉ và timestamps. API vẫn đọc được dữ liệu role viết thường cũ.
- `Order`: mã đơn duy nhất, userId nếu có, thông tin giao hàng, các dòng hàng gồm productId/tên/đơn giá/số lượng, tổng tiền, trạng thái và timestamps. Lưu bản chụp giá lúc đặt đơn.
- Nếu dùng phiên lưu phía server, lưu `Session` trong MongoDB với thời điểm hết hạn; không phụ thuộc Map trong bộ nhớ BE.

Tách kết nối DB, models và script seed. BE kết nối MongoDB trước khi nhận request, báo lỗi rõ khi thiếu `MONGODB_URI` hoặc không kết nối được; không tự chuyển sang dữ liệu trong bộ nhớ. Đóng kết nối khi dừng ứng dụng. Health check BE trả 200 khi DB sẵn sàng, 503 khi DB không sẵn sàng.

Có `npm run seed` tạo 6–8 sản phẩm và hai tài khoản mẫu bằng upsert theo khóa ổn định; chạy lại không nhân đôi dữ liệu và không xóa đơn hàng. Không tự seed hoặc reset mỗi lần start/deploy. Có `npm run db:reset` riêng, yêu cầu cờ xác nhận rõ ràng và chỉ dùng cho database mẫu; ghi rõ lệnh này xóa dữ liệu nào.

Sản phẩm, tài khoản và đơn hàng vẫn tồn tại sau khi BE restart/redeploy nếu giữ nguyên database. Chuẩn hóa `_id` thành `id` dạng chuỗi trong DTO; ID không đúng định dạng trả 400, ID đúng định dạng nhưng không tồn tại trả 404.

## Giao diện và chức năng

UI tiếng Việt, tên MiniShop, tông trắng/xanh/đen, giá VND, responsive desktop/mobile. Có loading, error, empty states. Dùng asset local hoặc placeholder tự tạo. Chỉ cần 6–8 sản phẩm phụ kiện công nghệ.

| Trang | Chức năng |
|---|---|
| `/` | Danh sách sản phẩm, tìm kiếm theo tên |
| `/products/[id]` | Chi tiết, giá, tồn kho mẫu, chọn số lượng, thêm giỏ |
| `/cart` | Sửa số lượng, xóa sản phẩm, tính tổng, lưu localStorage |
| `/checkout` | Form giao hàng mẫu, tạo đơn, hiển thị mã đơn và tóm tắt |
| `/login` | Đăng nhập bằng tài khoản customer/admin có sẵn |
| `/account` | Thông tin tài khoản, trạng thái phiên, đăng xuất |
| `/admin` | Báo cáo bán hàng đơn giản cho tài khoản admin |

Không cần thanh toán trực tuyến, email, OAuth, upload, đăng ký, đặt lại mật khẩu hoặc dashboard phức tạp.

## API hoạt động thực tế

| Method | Path | Hành vi |
|---|---|---|
| GET | `/api/health` | Trả trạng thái dịch vụ |
| GET | `/api/products` | Danh sách sản phẩm, tùy chọn `q` |
| GET | `/api/products/:id` | Chi tiết hoặc 404 |
| POST | `/api/auth/login` | Kiểm tra tài khoản có sẵn, trả thông tin phiên |
| POST | `/api/orders` | Kiểm tra dữ liệu, tính giá từ danh mục phía server, trả mã đơn và tóm tắt |

FE phải gọi API thật; không hardcode toàn bộ sản phẩm trong component. BE kiểm tra ID sản phẩm, số lượng nguyên dương, tồn kho và thông tin giao hàng. Giá và tổng tiền do BE tính từ dữ liệu sản phẩm. Trả lỗi theo một cấu trúc nhất quán.

Luồng đăng nhập qua Server Action của FE rồi gọi BE và lưu phiên bằng cookie cùng origin FE. Có đăng xuất. Người chưa đăng nhập được chuyển tới `/login` khi vào `/account` hoặc `/admin`; chỉ tài khoản admin được xem `/admin`. Kiểm tra phiên và vai trò tại những thao tác liên quan.

## Docker và Render

Compose chạy FE/BE bằng production build và service MongoDB local có named volume để giữ dữ liệu. BE dùng URI `mongodb://mongo:27017/minishop` trong Compose. Có lệnh khởi động, dừng, seed và reset dữ liệu mẫu; hướng dẫn rõ dừng thông thường giữ volume, còn xóa volume sẽ mất dữ liệu. FE gọi BE bằng tên service trong mạng Compose; browser dùng địa chỉ truy cập từ máy người dùng.

Cả hai app triển khai bằng **Render Web Service**, không chọn Static Site. Kiểm tra tài liệu Render hiện hành trước khi chốt `render.yaml`.

| Service | Root directory | Build | Start | Health |
|---|---|---|---|---|
| MiniShop FE | `frontend` | `npm ci && npm run build` | `npm start` | `/api/health` của FE |
| MiniShop BE | `backend` | `npm ci && npm run build` | `npm start` | `/api/health` của BE |

FE bind `0.0.0.0`, dùng `PORT` của Render qua `next start` hoặc script tương đương. BE bind `0.0.0.0`, dùng `process.env.PORT`. Có port mặc định khi chạy local.

Biến môi trường:

- FE `API_BASE_URL`: URL BE cho các lời gọi từ server.
- FE `NEXT_PUBLIC_API_BASE_URL`: chỉ thêm nếu browser gọi trực tiếp BE; ghi rõ giá trị được đưa vào lúc build.
- BE `CORS_ORIGINS`: origin FE và localhost tương ứng khi browser gọi trực tiếp.
- BE `MONGODB_URI`: chuỗi kết nối MongoDB, chỉ cấu hình cho BE; local dùng `mongodb://127.0.0.1:27017/minishop`, Compose dùng hostname `mongo`, Render dùng URI Atlas. Không đưa biến này vào FE hoặc biến `NEXT_PUBLIC_*`.
- BE `PORT`: cổng chạy dịch vụ.
- Biến cho phiên đăng nhập nếu implementation cần; mô tả trong `.env.example` và tài liệu.

Browser không dùng hostname nội bộ của Render. Không hứa gói miễn phí hoặc tính năng nền tảng khi chưa kiểm tra. Ghi rõ cold start, kết nối MongoDB Atlas và giới hạn của gói đã chọn. Khi deploy, dùng MongoDB Atlas cho DB; hai Web Service Render vẫn chỉ là FE và BE. Hướng dẫn tạo database, cấu hình kết nối Atlas theo tài liệu hiện hành và seed một lần. Nếu chưa có Atlas, hoàn thành cấu hình và báo bước cần người dùng thiết lập.

Chuẩn bị đầy đủ cấu hình và hướng dẫn để **người dùng tự deploy**. Agent không deploy, không tạo Web Service, không tạo cluster Atlas và không yêu cầu quyền truy cập tài khoản triển khai. Không tự đổi phiên bản Next.js; ghi rõ cấu hình hoặc thông tin người dùng cần bổ sung.

## Build và bàn giao

Không viết hoặc chạy unit test, integration test, E2E, smoke test, kiểm thử bằng browser hoặc kiểm thử thủ công. Không tạo test suite hoặc cài công cụ test. Giữ nguyên validation dữ liệu và xử lý lỗi trong code nghiệp vụ.

Chạy production build của cả hai app và sửa lỗi biên dịch nếu có. Có thể chạy typecheck để xử lý lỗi TypeScript phục vụ build. Build phải không phụ thuộc MongoDB hoặc BE đang chạy: các trang cần dữ liệu runtime không được bắt buộc fetch khi build. Không cần chạy ứng dụng, seed, Docker Compose hoặc kết nối Atlas để kiểm thử. Không yêu cầu tài khoản cloud để hoàn thành source và build.

Tạo:

- `README.md`: cài đặt, tài khoản mẫu, lệnh dev/build/start, Compose, reset và giới hạn dữ liệu.
- `docs/architecture.md`: cấu trúc, luồng FE–BE–MongoDB và các model dữ liệu.
- `docs/api.md`: request/response mẫu và mã lỗi của API.
- `docs/deployment.md`: hai service Render, MongoDB Atlas, biến môi trường, seed, health check, cold start và bước còn lại.
- `docs/handover.md`: chức năng đã viết, phiên bản đã dùng, kết quả build, biến cần điền và các bước người dùng tự chạy/deploy. Ghi rõ chưa kiểm thử và chưa deploy.

Không commit `node_modules`, `.env` thực tế, build cache hoặc dữ liệu phiên. Final nêu ngắn gọn chức năng đã viết, kết quả build, lệnh chạy, tài khoản mẫu và các bước người dùng tự deploy. Không khẳng định luồng nghiệp vụ đã được kiểm thử.
