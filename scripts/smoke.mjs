#!/usr/bin/env node
// Smoke test: hits every public + auth-gated route against a running dev
// server and asserts on HTTP status + a unique substring of the page body.
//
//   pnpm smoke              # against http://localhost:3000
//   BASE_URL=… pnpm smoke   # against a different origin

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const checks = [
  { path: "/",            must: "tilt",                expect: 200 },
  { path: "/login",       must: "sign in",             expect: 200 },
  { path: "/trust",       must: "how this stays safe", expect: 200 },
  { path: "/marketplace", expect: 307 },
  { path: "/vaults",      expect: 307 },
  { path: "/provider",    expect: 307 },
  { path: "/listing/00000000-0000-0000-0000-000000000000", expect: 307 },
  { path: "/vault/00000000-0000-0000-0000-000000000000",   expect: 307 },
];

let failed = 0;
for (const c of checks) {
  let res;
  try {
    res = await fetch(`${BASE}${c.path}`, { redirect: "manual" });
  } catch (e) {
    console.error(`FAIL ${c.path} → network error: ${e instanceof Error ? e.message : e}`);
    failed++;
    continue;
  }
  const statusOk = res.status === c.expect;
  let bodyOk = true;
  let bodyHint = "";
  if (statusOk && c.must) {
    const body = await res.text();
    bodyOk = body.toLowerCase().includes(c.must.toLowerCase());
    if (!bodyOk) bodyHint = ` · missing "${c.must}"`;
  }
  const tag = statusOk && bodyOk ? "PASS" : "FAIL";
  const expected = c.must ? ` · "${c.must}"` : "";
  console.log(`${tag} ${c.path} → ${res.status} (expected ${c.expect})${expected}${bodyHint}`);
  if (!statusOk || !bodyOk) failed++;
}

if (failed) {
  console.error(`\n${failed} smoke check(s) failed`);
  process.exit(1);
}
console.log("\nall smoke checks passed");
