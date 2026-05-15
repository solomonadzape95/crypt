#!/usr/bin/env node
// Recovery script for vaults that got marked "funded" but whose escrows are
// actually empty on-chain (the silent-fund bug we just patched).
//
// What it does:
//   1. Lists vaults whose status is NOT 'funding' but at least one escrow
//      contract has on-chain balance 0 (per TW's get-multiple-escrow-balance).
//   2. With `--reset`, flips them back to status='funding' and clears the
//      funded_at/fund_tx_hash for any empty escrow so the user can refund
//      from the dashboard.
//
// Run:
//   node scripts/recover-stuck-vaults.mjs         # dry-run, lists candidates
//   node scripts/recover-stuck-vaults.mjs --reset # actually update DB
//
// Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// TRUSTLESS_WORK_API_KEY in .env.local.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const env = loadEnv(path.join(__dirname, "..", ".env.local"));
const TW_KEY = env.TRUSTLESS_WORK_API_KEY;
const TW_BASE = env.TRUSTLESS_WORK_BASE_URL ?? "https://dev.api.trustlesswork.com";
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!TW_KEY || !SUPA_URL || !SUPA_KEY) {
  throw new Error("Missing env. Need TRUSTLESS_WORK_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
}

const RESET = process.argv.includes("--reset");
const supa = createClient(SUPA_URL, SUPA_KEY);

function loadEnv(p) {
  const out = {};
  if (!fs.existsSync(p)) return out;
  for (const line of fs.readFileSync(p, "utf-8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

async function balancesFor(contractIds) {
  if (contractIds.length === 0) return new Map();
  const q = contractIds
    .map((id) => `addresses[]=${encodeURIComponent(id)}`)
    .join("&");
  const r = await fetch(`${TW_BASE}/helper/get-multiple-escrow-balance?${q}`, {
    headers: { "x-api-key": TW_KEY },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`TW ${r.status}: ${await r.text()}`);
  const body = await r.json();
  const list = Array.isArray(body) ? body : body?.data ?? [];
  return new Map(list.map((row) => [row.address, Number(row.balance ?? 0)]));
}

async function main() {
  console.log(RESET ? "MODE: --reset (will update DB)" : "MODE: dry-run (pass --reset to update DB)");

  const { data: vaults, error } = await supa
    .from("vaults")
    .select(
      "id, status, guarantee_escrow_contract_id, subscription_escrow_contract_id, guarantee_funded_at, subscription_funded_at, guarantee_fund_tx_hash, subscription_fund_tx_hash, guarantee_usdc, subscription_fee_usdc, settle_error"
    )
    .neq("status", "disbursed")
    .neq("status", "expired");
  if (error) throw error;
  if (!vaults?.length) {
    console.log("no candidate vaults");
    return;
  }
  console.log(`found ${vaults.length} non-terminal vault(s)`);

  const contractIds = vaults.flatMap((v) =>
    [v.guarantee_escrow_contract_id, v.subscription_escrow_contract_id].filter(Boolean)
  );
  const balances = await balancesFor(contractIds);

  const stuck = [];
  for (const v of vaults) {
    const gBal = v.guarantee_escrow_contract_id
      ? balances.get(v.guarantee_escrow_contract_id) ?? 0
      : null;
    const sBal = v.subscription_escrow_contract_id
      ? balances.get(v.subscription_escrow_contract_id) ?? 0
      : null;
    const gMarkedFunded = !!v.guarantee_funded_at;
    const sMarkedFunded = !!v.subscription_funded_at;
    const gEmpty = gMarkedFunded && gBal === 0;
    const sEmpty = sMarkedFunded && sBal === 0;
    if (gEmpty || sEmpty || v.status === "under_threat" || v.settle_error) {
      stuck.push({ v, gBal, sBal, gEmpty, sEmpty });
    }
  }

  if (stuck.length === 0) {
    console.log("no stuck vaults to recover ✓");
    return;
  }

  console.log(`\n${stuck.length} stuck vault(s):\n`);
  for (const { v, gBal, sBal, gEmpty, sEmpty } of stuck) {
    console.log(`  vault ${v.id}  status=${v.status}`);
    console.log(`    guarantee:    ${v.guarantee_escrow_contract_id ?? "—"}  balance=${gBal}  marked=${!!v.guarantee_funded_at}  EMPTY=${gEmpty}`);
    console.log(`    subscription: ${v.subscription_escrow_contract_id ?? "—"}  balance=${sBal}  marked=${!!v.subscription_funded_at}  EMPTY=${sEmpty}`);
    if (v.settle_error) console.log(`    settle_error: ${v.settle_error.slice(0, 120)}`);
  }

  if (!RESET) {
    console.log("\n(re-run with --reset to flip these back to 'funding' so they can be refunded)");
    return;
  }

  for (const { v, gEmpty, sEmpty } of stuck) {
    const update = {
      status: "funding",
      settle_error: null,
      triggered_at: null,
      consecutive_failures: 0,
    };
    if (gEmpty) {
      update.guarantee_funded_at = null;
      update.guarantee_fund_tx_hash = null;
    }
    if (sEmpty) {
      update.subscription_funded_at = null;
      update.subscription_fund_tx_hash = null;
    }
    const { error: updErr } = await supa.from("vaults").update(update).eq("id", v.id);
    if (updErr) {
      console.error(`  ✗ ${v.id}: ${updErr.message}`);
    } else {
      console.log(`  ✓ ${v.id}: reset to 'funding'`);
    }
  }
}

main().catch((e) => {
  console.error(e?.stack ?? e?.message ?? String(e));
  process.exit(1);
});
