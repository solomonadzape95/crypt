#!/usr/bin/env node
// End-to-end payout test on Stellar testnet.
//
// What this proves:
//   1. We can deploy a Trustless Work single-release escrow
//   2. The funder (provider/subscriber test key) can fund it with USDC
//   3. The on-chain balance reads back via /helper/get-multiple-escrow-balance
//   4. Dispute → resolve-dispute distributes the funds to the receiver
//   5. The receiver's USDC balance actually increases
//
// Uses an EPHEMERAL test USDC asset issued by a fresh keypair so we don't need
// to scrape testnet USDC from Circle's faucet. The TW asset config is passed
// per-call (no module-level env override needed).
//
// Run:
//   node scripts/e2e-payout.mjs
//
// Reads from .env.local: TRUSTLESS_WORK_API_KEY, STELLAR_PLATFORM_*,
// STELLAR_RESOLVER_*.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Asset,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  Horizon,
  BASE_FEE,
} from "@stellar/stellar-sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── env loading ────────────────────────────────────────────────────────────
const env = loadEnv(path.join(__dirname, "..", ".env.local"));
const TW_KEY = env.TRUSTLESS_WORK_API_KEY;
const TW_BASE = env.TRUSTLESS_WORK_BASE_URL ?? "https://dev.api.trustlesswork.com";
const PLATFORM_SECRET = env.STELLAR_PLATFORM_SECRET;
const PLATFORM_PUBLIC = env.STELLAR_PLATFORM_PUBLIC;
const RESOLVER_SECRET = env.STELLAR_RESOLVER_SECRET;
const RESOLVER_PUBLIC = env.STELLAR_RESOLVER_PUBLIC;
if (!TW_KEY || !PLATFORM_SECRET || !RESOLVER_SECRET) {
  throw new Error("Missing TW or Stellar keys in .env.local");
}

const HORIZON = "https://horizon-testnet.stellar.org";
const NETWORK = Networks.TESTNET;
const horizon = new Horizon.Server(HORIZON);

// ── helpers ────────────────────────────────────────────────────────────────
function loadEnv(p) {
  const out = {};
  if (!fs.existsSync(p)) return out;
  for (const line of fs.readFileSync(p, "utf-8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

function step(label) {
  console.log(`\n▶ ${label}`);
}
function ok(msg) {
  console.log(`  ✓ ${msg}`);
}
function fail(msg, err) {
  console.error(`  ✗ ${msg}`);
  if (err) {
    console.error("    " + (err.stack ?? err.message ?? String(err)));
    if (err.response?.data) console.error("    data:", JSON.stringify(err.response.data));
  }
  process.exit(1);
}

async function tw(method, pathname, bodyOrQuery, { isQuery } = {}) {
  let url = `${TW_BASE}${pathname}`;
  let init = {
    method,
    headers: { "x-api-key": TW_KEY, "Content-Type": "application/json" },
    cache: "no-store",
  };
  if (method === "GET" && bodyOrQuery) {
    const qs = Object.entries(bodyOrQuery)
      .flatMap(([k, v]) =>
        Array.isArray(v)
          ? v.map((x) => `${k}[]=${encodeURIComponent(x)}`)
          : [`${k}=${encodeURIComponent(v)}`]
      )
      .join("&");
    url = `${url}?${qs}`;
  } else if (method !== "GET") {
    init.body = JSON.stringify(bodyOrQuery);
  }
  const res = await fetch(url, init);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`TW ${method} ${pathname} → ${res.status}: ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function pickXDR(r) {
  return r.unsignedTransaction ?? r.unsignedXdr ?? r.xdr;
}

async function loadAccount(pub) {
  return await horizon.loadAccount(pub);
}

async function friendbot(pub) {
  const r = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(pub)}`);
  if (!r.ok) {
    const t = await r.text();
    if (!t.includes("createAccountAlreadyExist")) {
      throw new Error(`friendbot ${r.status}: ${t}`);
    }
  }
}

async function getBalance(pub, asset) {
  const acc = await loadAccount(pub);
  for (const b of acc.balances) {
    if (asset.isNative() && b.asset_type === "native") return Number(b.balance);
    if (
      !asset.isNative() &&
      b.asset_code === asset.code &&
      b.asset_issuer === asset.issuer
    ) {
      return Number(b.balance);
    }
  }
  return null; // no trustline
}

async function submitTx(builder, ...signers) {
  const tx = builder.setNetworkPassphrase(NETWORK).build();
  for (const s of signers) tx.sign(s);
  const r = await horizon.submitTransaction(tx);
  return r.hash;
}

async function setTrustline(kp, asset) {
  const acc = await loadAccount(kp.publicKey());
  const tx = new TransactionBuilder(acc, { fee: BASE_FEE, networkPassphrase: NETWORK })
    .addOperation(Operation.changeTrust({ asset }))
    .setTimeout(60);
  return await submitTx(tx, kp);
}

async function payUsdc(srcKp, destPub, amount, asset) {
  const acc = await loadAccount(srcKp.publicKey());
  const tx = new TransactionBuilder(acc, { fee: BASE_FEE, networkPassphrase: NETWORK })
    .addOperation(
      Operation.payment({
        destination: destPub,
        asset,
        amount: amount.toFixed(7),
      })
    )
    .setTimeout(60);
  return await submitTx(tx, srcKp);
}

async function signAndSubmit(unsignedXDR, signerKp, label) {
  const tx = TransactionBuilder.fromXDR(unsignedXDR, NETWORK);
  tx.sign(signerKp);
  const signedXdr = tx.toXDR();
  const localHash = TransactionBuilder.fromXDR(signedXdr, NETWORK).hash().toString("hex");
  try {
    const r = await tw("POST", "/helper/send-transaction", { signedXdr });
    if (r.status === "SUCCESS" || r.status === "success" || r.hash) {
      return {
        hash:
          r.hash ?? r.txHash ?? r.transactionHash ?? r.signedXdrHash ??
          r.escrow?.txHash ?? localHash,
        via: "tw",
      };
    }
    throw new Error(`TW send-transaction non-success: ${JSON.stringify(r)}`);
  } catch (e) {
    console.log(`  ! TW send-transaction issue for ${label}: ${e.message}`);
    console.log("    falling back to direct Horizon submit…");
    try {
      const tx2 = TransactionBuilder.fromXDR(signedXdr, NETWORK);
      const r = await horizon.submitTransaction(tx2);
      return { hash: r.hash, via: "horizon" };
    } catch (e2) {
      throw new Error(`both TW and Horizon failed for ${label}: ${e2.message}`);
    }
  }
}

// ── main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("E2E payout test — Stellar testnet");
  console.log(`Platform: ${PLATFORM_PUBLIC}`);
  console.log(`Resolver: ${RESOLVER_PUBLIC}`);
  console.log(`TW: ${TW_BASE}`);

  const platformKp = Keypair.fromSecret(PLATFORM_SECRET);
  const resolverKp = Keypair.fromSecret(RESOLVER_SECRET);

  step("Generate test keypairs (issuer, provider, subscriber)");
  const issuerKp = Keypair.random();
  const providerKp = Keypair.random();
  const subscriberKp = Keypair.random();
  ok(`issuer:     ${issuerKp.publicKey()}`);
  ok(`provider:   ${providerKp.publicKey()}`);
  ok(`subscriber: ${subscriberKp.publicKey()}`);

  step("Friendbot-fund the three test accounts with XLM");
  await Promise.all([
    friendbot(issuerKp.publicKey()),
    friendbot(providerKp.publicKey()),
    friendbot(subscriberKp.publicKey()),
  ]);
  ok("all three funded with XLM");

  const TEST_USDC = new Asset("USDC", issuerKp.publicKey());
  ok(`test USDC asset: USDC:${issuerKp.publicKey()}`);

  step("Add USDC trustlines (provider, subscriber, platform, resolver) and mint to provider+subscriber");
  // Trustlines: provider + subscriber must hold USDC; platform + resolver hold
  // it too because TW may make them temporary receivers during deploy/resolve.
  await setTrustline(providerKp, TEST_USDC);
  ok("provider trustline set");
  await setTrustline(subscriberKp, TEST_USDC);
  ok("subscriber trustline set");
  // Platform trustline already exists for the canonical Circle issuer but not
  // this test one. Add it.
  try {
    await setTrustline(platformKp, TEST_USDC);
    ok("platform trustline set");
  } catch (e) {
    console.log(`  ! platform trustline failed (probably already set): ${e.message}`);
  }
  try {
    await setTrustline(resolverKp, TEST_USDC);
    ok("resolver trustline set");
  } catch (e) {
    console.log(`  ! resolver trustline failed: ${e.message}`);
  }
  await payUsdc(issuerKp, providerKp.publicKey(), 100, TEST_USDC);
  await payUsdc(issuerKp, subscriberKp.publicKey(), 100, TEST_USDC);
  ok("minted 100 USDC each to provider+subscriber");

  // ── DEPLOY GUARANTEE ESCROW ────────────────────────────────────────────
  const guaranteeNet = 2;
  const subscriptionNet = 5;
  // TW takes 0.3% at release → pad fund amount so receiver gets ≈ net.
  const grossGuarantee = Math.ceil((guaranteeNet / 0.997) * 1e4) / 1e4;
  const grossSubscription = Math.ceil((subscriptionNet / 0.997) * 1e4) / 1e4;
  ok(`amounts: guarantee net=${guaranteeNet} gross=${grossGuarantee} | subscription net=${subscriptionNet} gross=${grossSubscription}`);

  const engagementId = `e2e-${Date.now()}`;

  const trustline = { symbol: TEST_USDC.code, address: TEST_USDC.issuer };
  const roles = {
    approver: platformKp.publicKey(),
    serviceProvider: platformKp.publicKey(),
    releaseSigner: platformKp.publicKey(),
    disputeResolver: resolverKp.publicKey(),
    receiver: platformKp.publicKey(),
    platformAddress: platformKp.publicKey(),
  };

  step("Deploy guarantee escrow (TW /deployer/single-release)");
  const deployG = await tw("POST", "/deployer/single-release", {
    signer: platformKp.publicKey(),
    engagementId: `${engagementId}-g`,
    title: "E2E Test Guarantee",
    description: "E2E guarantee escrow",
    roles,
    amount: grossGuarantee,
    platformFee: 0,
    milestones: [{ description: "guarantee" }],
    trustline,
  });
  const deployGRes = await signAndSubmit(pickXDR(deployG), platformKp, "deploy-guarantee");
  ok(`guarantee deploy tx: ${deployGRes.hash} (via ${deployGRes.via})`);
  // contractId may be in the deploy or send-transaction response — re-query
  // get-escrow to find it.
  const guaranteeContract =
    deployG.contractId ?? (await contractIdFromEngagement(`${engagementId}-g`));
  ok(`guarantee contractId: ${guaranteeContract}`);

  step("Deploy subscription escrow");
  const deployS = await tw("POST", "/deployer/single-release", {
    signer: platformKp.publicKey(),
    engagementId: `${engagementId}-s`,
    title: "E2E Test Subscription",
    description: "E2E subscription escrow",
    roles,
    amount: grossSubscription,
    platformFee: 0,
    milestones: [{ description: "subscription" }],
    trustline,
  });
  const deploySRes = await signAndSubmit(pickXDR(deployS), platformKp, "deploy-subscription");
  ok(`subscription deploy tx: ${deploySRes.hash} (via ${deploySRes.via})`);
  const subscriptionContract =
    deployS.contractId ?? (await contractIdFromEngagement(`${engagementId}-s`));
  ok(`subscription contractId: ${subscriptionContract}`);

  // ── FUND ────────────────────────────────────────────────────────────────
  step("Fund guarantee escrow (signer=provider) — net+0.3% gross");
  const fundG = await tw("POST", "/escrow/single-release/fund-escrow", {
    contractId: guaranteeContract,
    signer: providerKp.publicKey(),
    amount: grossGuarantee,
  });
  console.log("  fund-guarantee XDR head:", pickXDR(fundG)?.slice(0, 80) + "…");
  const fundGRes = await signAndSubmit(pickXDR(fundG), providerKp, "fund-guarantee");
  ok(`guarantee fund tx: ${fundGRes.hash} (via ${fundGRes.via})`);

  step("Fund subscription escrow (signer=subscriber)");
  const fundS = await tw("POST", "/escrow/single-release/fund-escrow", {
    contractId: subscriptionContract,
    signer: subscriberKp.publicKey(),
    amount: grossSubscription,
  });
  const fundSRes = await signAndSubmit(pickXDR(fundS), subscriberKp, "fund-subscription");
  ok(`subscription fund tx: ${fundSRes.hash} (via ${fundSRes.via})`);

  // ── VERIFY ON-CHAIN BALANCE ─────────────────────────────────────────────
  step("Read on-chain balances via TW /helper/get-multiple-escrow-balance");
  const balances = await tw(
    "GET",
    "/helper/get-multiple-escrow-balance",
    { addresses: [guaranteeContract, subscriptionContract] },
    { isQuery: true }
  );
  console.log("  raw balances:", JSON.stringify(balances));
  const balanceFor = (contractId) => {
    const list = Array.isArray(balances) ? balances : balances?.data ?? [];
    return list.find((r) => r.address === contractId)?.balance ?? 0;
  };
  const gBal = balanceFor(guaranteeContract);
  const sBal = balanceFor(subscriptionContract);
  ok(`guarantee balance: ${gBal} USDC`);
  ok(`subscription balance: ${sBal} USDC`);
  if (gBal <= 0) fail(`guarantee escrow is empty after funding! gross funded=${grossGuarantee}`);
  if (sBal <= 0) fail(`subscription escrow is empty after funding! gross funded=${grossSubscription}`);

  // ── DISPUTE + RESOLVE ──────────────────────────────────────────────────
  step("Open dispute on both escrows (signer=platform/approver)");
  for (const cid of [guaranteeContract, subscriptionContract]) {
    try {
      const d = await tw("POST", "/escrow/single-release/dispute-escrow", {
        contractId: cid,
        signer: platformKp.publicKey(),
      });
      const r = await signAndSubmit(pickXDR(d), platformKp, `dispute-${cid.slice(0, 8)}`);
      ok(`disputed ${cid.slice(0, 10)}… → ${r.hash}`);
    } catch (e) {
      if (/already in dispute/i.test(e.message)) {
        ok(`${cid.slice(0, 10)}… already in dispute`);
      } else {
        throw e;
      }
    }
  }

  step("Resolve both disputes — distribute full on-chain balance to subscriber");
  for (const [cid, bal, label] of [
    [guaranteeContract, gBal, "guarantee"],
    [subscriptionContract, sBal, "subscription"],
  ]) {
    const resolve = await tw("POST", "/escrow/single-release/resolve-dispute", {
      contractId: cid,
      disputeResolver: resolverKp.publicKey(),
      distributions: [{ address: subscriberKp.publicKey(), amount: bal }],
    });
    const r = await signAndSubmit(pickXDR(resolve), resolverKp, `resolve-${label}`);
    ok(`resolved ${label} → ${r.hash}`);
  }

  // ── VERIFY RECEIVER ────────────────────────────────────────────────────
  step("Read subscriber USDC balance");
  const finalBal = await getBalance(subscriberKp.publicKey(), TEST_USDC);
  ok(`subscriber USDC balance: ${finalBal}`);
  const expected = 100 - subscriptionNet * 0; // started 100, paid gross, got back gross-fee
  const minExpected = 100 - grossSubscription + (gBal + sBal) - 0.01;
  if (finalBal < minExpected) {
    fail(
      `subscriber balance ${finalBal} is below expected ${minExpected.toFixed(4)} — payout didn't reach`
    );
  }
  ok(`subscriber received ≈ ${(finalBal - (100 - grossSubscription)).toFixed(4)} USDC of payouts`);

  console.log("\n✅ ALL STEPS PASSED — end-to-end deploy → fund → settle works.");
  console.log("\nKey artefacts:");
  console.log(`  guarantee contract:    ${guaranteeContract}`);
  console.log(`  subscription contract: ${subscriptionContract}`);
  console.log(`  test USDC issuer:      ${issuerKp.publicKey()}`);
  console.log(`  provider test key:     ${providerKp.publicKey()}`);
  console.log(`  subscriber test key:   ${subscriberKp.publicKey()}`);
}

async function contractIdFromEngagement(engagementId) {
  // TW's send-transaction may have returned the contractId in the previous
  // response; if not, fall back to scanning by signer via get-escrows-by-role
  // or get-escrows-by-signer. For the test we use signer (platform).
  // (Best-effort — most TW dev API responses include contractId in either the
  // deploy response or the send-transaction response, so this path is rare.)
  const r = await tw(
    "GET",
    "/helper/get-escrows-by-signer",
    { signer: PLATFORM_PUBLIC },
    { isQuery: true }
  );
  const list = Array.isArray(r) ? r : r?.data ?? [];
  const found = list.find((e) => e.engagementId === engagementId);
  if (!found) throw new Error(`could not resolve contractId for engagement ${engagementId}`);
  return found.contractId;
}

main().catch((e) => {
  console.error("\n❌ E2E FAILED");
  console.error(e?.stack ?? e?.message ?? String(e));
  process.exit(1);
});
