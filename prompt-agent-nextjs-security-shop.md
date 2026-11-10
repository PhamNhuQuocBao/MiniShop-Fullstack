# Prompt giao cho coding agent — MiniShop Next.js 15.1.0

Bạn là coding agent full-stack. Hãy triển khai từ đầu đến cuối website bán phụ kiện công nghệ nhỏ tên **MiniShop** bằng **Next.js 15.1.0**. Thực sự viết code, tích hợp API, hoàn thành production build và bàn giao; không dừng ở bản kế hoạch hoặc scaffold.

## 1. Mục tiêu

- Website tiếng Việt gồm danh sách sản phẩm, chi tiết, giỏ hàng, đặt hàng mẫu, đăng nhập và trang quản trị đơn giản.
- Tách source FE và BE thành hai thư mục độc lập, build và deploy riêng.
- Triển khai cả FE Next.js và BE Express trên Render thành hai Web Service.
- Dùng dữ liệu và tài khoản mẫu, chỉ cần vài API thực sự hoạt động.
- Không viết hoặc chạy test, smoke test, E2E hay kiểm thử thủ công; không cài công cụ test.
- Chỉ bàn giao source, production build và hướng dẫn để người dùng tự deploy; agent không deploy hoặc tạo tài nguyên cloud.
- Không cần thanh toán trực tuyến, email, OAuth, upload, đăng ký, đặt lại mật khẩu hoặc database trả phí.
- Ưu tiên code gọn, luồng mua hàng chạy được, tài liệu đủ để người khác chạy lại.
- Tự quyết định các chi tiết thông thường; không hỏi lại tên shop, màu sắc hoặc cấu trúc đã quy định.

## 2. Phiên bản và stack

FE dùng Next.js App Router, TypeScript và CSS Modules hoặc Tailwind tương thích. Pin chính xác `next: "15.1.0"`; không dùng `^`, `~`, `latest` hoặc canary. Dùng React/React DOM `19.0.0` làm bộ ban đầu và xác nhận peer dependencies, build thực tế trước khi chốt.

BE dùng **Express, TypeScript, zod, MongoDB và Mongoose**. MongoDB lưu sản phẩm, tài khoản và đơn hàng lâu dài. Chọn Node.js chạy được bộ dependency; ghi phiên bản đã thử và dùng thống nhất trong local, Docker, Render.

Pin dependency trực tiếp bằng phiên bản cụ thể, tạo `package-lock.json` riêng từng app và dùng `npm ci` cho các lần cài sau. Không tự nâng hoặc đổi Next.js để xử lý lỗi build; kiểm tra nguyên nhân, sửa cấu hình và dependency tương thích trước. Nếu không giải quyết được, ghi rõ lỗi và phương án đề xuất.

## 3. Cấu trúc source

```text
minishop/
  AGENTS.md
  README.md
  .gitignore
  docker-compose.yml
  render.yaml
  frontend/
    package.json
    package-lock.json
    next.config.*
    tsconfig.json
    Dockerfile
    .env.example
    src/
      app/
      components/
      lib/
    public/
  backend/
    package.json
    package-lock.json
    tsconfig.json
    Dockerfile
    .env.example
    src/
      server.ts
      routes/
      services/
      config/
      models/
      scripts/
        seed.ts
        reset.ts
  docs/
    architecture.md
    api.md
    deployment.md
    handover.md
```

Mỗi app có `dev`, `build`, `start`, `typecheck`. Cài/build/start trực tiếp từ từng thư mục, không cần workspace install tại root. Không import source giữa hai app. Không thêm monorepo framework.

Đọc `AGENTS.md` hiện có và bảo toàn các thay đổi của người dùng. Giữ hai tài liệu này nhất quán trong quá trình triển khai.

## 4. Kiến trúc FE–BE

FE chạy bằng Next.js Node.js server, không static export. Dùng Server Components cho trang sản phẩm, Server Actions cho đăng nhập và checkout, Client Components cho giỏ hàng và tương tác trình duyệt.

Express cung cấp API nghiệp vụ; FE gọi BE thật. Không hardcode toàn bộ dữ liệu sản phẩm ở component và không sao chép nghiệp vụ BE sang FE.

Giỏ hàng lưu localStorage. Các thao tác phụ thuộc localStorage chỉ chạy ở phía browser; tránh lỗi hydration. BE truy vấn sản phẩm, tài khoản mẫu và đơn hàng từ MongoDB qua Mongoose. Trạng thái phiên lưu phía server, nếu có, cũng nằm trong MongoDB. Không dùng dữ liệu trong bộ nhớ để thay thế DB.

## MongoDB và dữ liệu mẫu

BE dùng **MongoDB qua Mongoose** làm nơi lưu dữ liệu chính; FE chỉ truy cập dữ liệu qua API BE.

- `Product`: tên, slug, mô tả, ảnh, giá VND nguyên, tồn kho và timestamps.
- `User`: tên, email duy nhất, thông tin đăng nhập, role `customer` hoặc `admin`, timestamps.
- `Order`: mã đơn duy nhất, userId nếu có, thông tin giao hàng, các dòng hàng gồm productId/tên/đơn giá/số lượng, tổng tiền, trạng thái và timestamps. Lưu bản chụp giá lúc đặt đơn.
- Nếu dùng phiên lưu phía server, lưu `Session` trong MongoDB với thời điểm hết hạn; không phụ thuộc Map trong bộ nhớ BE.

Tách kết nối DB, models và script seed. BE kết nối MongoDB trước khi nhận request, báo lỗi rõ khi thiếu `MONGODB_URI` hoặc không kết nối được; không tự chuyển sang dữ liệu trong bộ nhớ. Đóng kết nối khi dừng ứng dụng. Health check BE trả 200 khi DB sẵn sàng, 503 khi DB không sẵn sàng.

Có `npm run seed` tạo 6–8 sản phẩm và hai tài khoản mẫu bằng upsert theo khóa ổn định; chạy lại không nhân đôi dữ liệu và không xóa đơn hàng. Không tự seed hoặc reset mỗi lần start/deploy. Có `npm run db:reset` riêng, yêu cầu cờ xác nhận rõ ràng và chỉ dùng cho database mẫu; ghi rõ lệnh này xóa dữ liệu nào.

Sản phẩm, tài khoản và đơn hàng vẫn tồn tại sau khi BE restart/redeploy nếu giữ nguyên database. Chuẩn hóa `_id` thành `id` dạng chuỗi trong DTO; ID không đúng định dạng trả 400, ID đúng định dạng nhưng không tồn tại trả 404.

## 5. Giao diện

Tên MiniShop, ngôn ngữ tiếng Việt, tông trắng/xanh/đen, giá VND. Responsive desktop/mobile, typography rõ, có loading/error/empty states. Dùng asset local hoặc placeholder tự tạo để dễ chạy lại.

| Trang | Yêu cầu |
|---|---|
| `/` | 6–8 sản phẩm như chuột, bàn phím, tai nghe, USB hub; tìm theo tên |
| `/products/[id]` | Mô tả, giá, tồn kho mẫu, chọn số lượng, thêm giỏ; ID sai trả trang phù hợp |
| `/cart` | Sửa số lượng, xóa sản phẩm, tổng tiền, giữ giỏ sau refresh |
| `/checkout` | Form tên và thông tin giao hàng mẫu; tạo đơn, nhận mã đơn và tóm tắt |
| `/login` | Đăng nhập bằng customer/admin có sẵn; thông báo khi nhập sai |
| `/account` | Thông tin tài khoản, trạng thái phiên, đăng xuất |
| `/admin` | Báo cáo bán hàng mẫu, chỉ dành cho tài khoản admin |

Không mở rộng thành hệ thống quản trị sản phẩm đầy đủ. UI tập trung vào hành trình xem sản phẩm → thêm giỏ → đặt đơn → xem kết quả.

## 6. API thực tế

| Method | Endpoint | Hành vi |
|---|---|---|
| GET | `/api/health` | Trả trạng thái BE |
| GET | `/api/products` | Danh sách; tùy chọn tìm kiếm bằng `q` |
| GET | `/api/products/:id` | Chi tiết hoặc 404 |
| POST | `/api/auth/login` | Kiểm tra tài khoản mẫu, trả thông tin tài khoản và phiên |
| POST | `/api/orders` | Kiểm tra dữ liệu, tính tổng từ danh mục phía BE, trả mã đơn và tóm tắt |

Định nghĩa request/response bằng TypeScript và tài liệu ví dụ. Dùng zod kiểm tra dữ liệu đầu vào. BE tính giá, tổng tiền từ danh mục của mình, kiểm tra ID sản phẩm, số lượng nguyên dương và tồn kho. Lỗi có cấu trúc thống nhất để FE hiển thị được thông báo rõ ràng.

Đăng nhập đi qua Server Action cùng origin của FE, gọi BE rồi lưu phiên bằng cookie. Có thao tác đăng xuất. Chuyển người chưa đăng nhập tới `/login` khi truy cập `/account` hoặc `/admin`; customer không xem được `/admin`. Kiểm tra phiên và vai trò tại các thao tác cần thiết.

Checkout có trạng thái đang gửi, không gửi lặp khi bấm liên tục. Chỉ xóa giỏ sau khi BE xác nhận đơn thành công; giữ giỏ và thông báo rõ nếu thất bại.

## 7. Biến môi trường và lệnh chạy

Mỗi app có `.env.example` chứa giá trị mẫu, mô tả mục đích từng biến và cách thiết lập khi chạy local, Docker, Render.

- FE `API_BASE_URL`: URL BE gọi từ Next.js server.
- FE `NEXT_PUBLIC_API_BASE_URL`: chỉ dùng nếu browser gọi trực tiếp BE; ghi rõ biến này có giá trị tại thời điểm build.
- BE `CORS_ORIGINS`: origin FE và localhost tương ứng khi cần browser gọi trực tiếp.
- BE `MONGODB_URI`: chuỗi kết nối MongoDB, chỉ cấu hình cho BE; local dùng `mongodb://127.0.0.1:27017/minishop`, Compose dùng hostname `mongo`, Render dùng URI Atlas. Không đưa biến này vào FE hoặc biến `NEXT_PUBLIC_*`.
- BE `PORT`: cổng dịch vụ; FE cũng nhận `PORT` khi chạy trên Render.
- Những biến phiên đăng nhập thực tế cần dùng: khai báo và mô tả nhất quán với code.

Local mặc định FE cổng 3000, BE cổng 4000. Hai server bind `0.0.0.0` trong Docker và Render. Không để browser gọi hostname chỉ tồn tại trong Docker hoặc mạng nội bộ Render.

README có lệnh cụ thể để cài dependency, chạy dev từng app, typecheck, build/start production, chạy/dừng Compose, `npm run seed`, `npm run db:reset -- --confirm` và tác động của từng lệnh tới dữ liệu mẫu.

## 8. Docker và Render

Tạo Dockerfile riêng cho mỗi app và Compose chạy production build của cả hai, kèm service MongoDB local tên `mongo` với named volume. BE dùng `mongodb://mongo:27017/minishop` trong Compose. Chờ DB sẵn sàng trước khi BE phục vụ request. Dừng Compose thông thường giữ dữ liệu; tài liệu nêu rõ xóa volume sẽ mất dữ liệu. Cấu hình FE gọi BE qua tên service và cung cấp URL truy cập FE từ trình duyệt.

Cấu hình Render cho **hai Web Service**, không dùng Static Site:

| Service | Root directory | Build command | Start command | Health check |
|---|---|---|---|---|
| MiniShop FE | `frontend` | `npm ci && npm run build` | `npm start` | `/api/health` |
| MiniShop BE | `backend` | `npm ci && npm run build` | `npm start` | `/api/health` |

FE có route health riêng và start script nhận `PORT` bằng `next start` hoặc cách tương đương. BE dùng `process.env.PORT` với fallback local.

Kiểm tra tài liệu Render hiện hành trước khi chốt `render.yaml` và hướng dẫn triển khai. Mô tả URL BE cần điền cho FE, origin FE cần điền cho BE, thứ tự deploy và lúc nào cần build lại FE.

Không hứa gói miễn phí, mạng nội bộ hoặc giới hạn tài nguyên khi chưa kiểm tra. Nêu cold start, kết nối MongoDB Atlas và giới hạn gói sử dụng. Dùng MongoDB Atlas khi triển khai, không chạy MongoDB trong filesystem tạm của BE Render. Hướng dẫn tạo database và cấu hình kết nối theo tài liệu Atlas hiện hành. Seed một lần sau khi thiết lập DB; không chạy reset khi start/deploy. Khi thiếu tài khoản hoặc URI Atlas, hoàn tất cấu hình và báo bước cần người dùng thiết lập. Nếu nền tảng không nhận phiên bản đã chỉ định, ghi thông báo thực tế và bước còn lại; không tự đổi Next.js.

Chuẩn bị config và tài liệu đầy đủ để **người dùng tự deploy**. Không deploy, tạo Web Service, tạo cluster Atlas hoặc yêu cầu quyền truy cập tài khoản triển khai. Các bước thiết lập Atlas, nhập biến môi trường, seed và deploy phải được viết rõ trong tài liệu bàn giao.

## 9. Quy trình thực hiện

1. Đọc repository và `AGENTS.md`; xác định code có sẵn và việc cần bổ sung.
2. Chọn bộ dependency tương thích và lập danh sách công việc ngắn.
3. Implement BE: kết nối MongoDB, Mongoose models, script seed, API, validation và phản hồi lỗi.
4. Implement FE: trang cửa hàng, giỏ hàng, checkout, đăng nhập, tài khoản, admin.
5. Tích hợp lời gọi API, trạng thái loading/error/empty và luồng đăng xuất trong source.
6. Hoàn thiện Dockerfile, Compose, cấu hình Render và `.env.example`.
7. Chạy production build FE và BE; sửa lỗi biên dịch. Có thể chạy typecheck phục vụ build. Không viết hoặc chạy kiểm thử.
8. Hoàn tất README và hướng dẫn người dùng tự cấu hình MongoDB Atlas, seed, chạy ứng dụng và deploy hai service Render.
9. Bàn giao source và kết quả build; ghi rõ chưa kiểm thử và chưa deploy.

Build không được yêu cầu BE hoặc MongoDB đang hoạt động. Các trang cần dữ liệu runtime phải được cấu hình phù hợp để không bắt buộc fetch khi build. Không yêu cầu tài khoản cloud để hoàn thành source và build. Không cần start ứng dụng, chạy seed, Compose hoặc kết nối Atlas để kiểm thử.

Tự xử lý lỗi thông thường và tiếp tục đến khi hoàn thành source từ A–Z. Không mở rộng ngoài phạm vi.

## 10. Tiêu chí bàn giao

- FE và BE có source độc lập; Next.js giữ đúng 15.1.0.
- Production build của cả hai app đã chạy; ghi kết quả thực tế và lỗi còn lại nếu có.
- Source đầy đủ cho sản phẩm, tìm kiếm, giỏ hàng, checkout, login/logout, account và admin.
- BE dùng MongoDB qua Mongoose, tính tổng đơn từ dữ liệu sản phẩm và xử lý dữ liệu đầu vào.
- Có models, script seed không tạo trùng, script reset riêng và cấu hình DB theo môi trường.
- Có Dockerfile, Compose kèm MongoDB local, `render.yaml` và `.env.example`.
- Có `README.md`, `docs/architecture.md`, `docs/api.md`, `docs/deployment.md`, `docs/handover.md`.
- Hướng dẫn tự deploy nêu thứ tự thiết lập Atlas → cấu hình BE → seed → deploy FE và điền URL tương ứng.
- Không tạo hoặc chạy test; không deploy; không commit `node_modules`, `.env` thực tế, build cache hoặc dữ liệu phiên.

Trong `docs/handover.md`, ghi chức năng đã viết, bộ phiên bản, lệnh và kết quả build, biến cần điền, bước người dùng tự thực hiện. Ghi rõ chưa kiểm thử và chưa deploy; không báo luồng nghiệp vụ đã chạy thành công khi chưa thực hiện.

Kết quả cuối gồm: đã viết gì, cấu trúc chính, kết quả build, lệnh chạy, tài khoản mẫu và hướng dẫn tự deploy. Nêu phần còn thiếu cùng lý do nếu có.

**Bắt đầu viết code ngay từ repository trống hoặc repository được cung cấp; hoàn thành từ A–Z và bàn giao để tôi tự deploy.**
