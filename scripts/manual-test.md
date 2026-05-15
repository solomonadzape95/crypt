# Manual end-to-end test — Stellar testnet

Automated smoke (`pnpm smoke`) covers route reachability + copy substrings.
The full Trustless Work payout path can't be automated without testnet wallet
signatures and live tx confirmation, so run this by hand once per material
backend change.

Budget ~3 minutes once everything is set up.

## Pre-flight

- [ ] `pnpm build` exits 0
- [ ] `pnpm smoke` exits 0 (run against a live `pnpm dev`)
- [ ] `.env.local` has `STELLAR_PLATFORM_PUBLIC/SECRET` and `STELLAR_RESOLVER_PUBLIC/SECRET`,
      both friendbot-funded with testnet XLM
- [ ] `pnpm dev` running on :3000
- [ ] `pnpm demo:target` running on :4000 (a 200 OK HTTP server)
- [ ] Connected wallet has testnet XLM and a USDC trustline (for paying deposits
      and receiving the payout)

## Happy-path run

1. Visit `/` → click **browse coverage** → land on `/login`.
2. Sign in with your wallet → land on `/marketplace`.
3. Open the side nav → **provider** → `/provider`.
4. Click **+ new offer** → fill:
   - title: `Demo API`
   - API URL: `http://localhost:4000`
   - your deposit: `1` USDC
   - subscriber deposit: `5` USDC
   - check every: `15s`
   - payout wallet: use signed-in wallet
   - Publish offer.
5. → `/provider/listings/<id>` shows the offer with 0 subscribers.
6. Click **marketplace** → see the offer in the list.
7. Click the offer → `/listing/<id>` → **subscribe** → confirm dialog.
8. Wait ~40s (two lockbox contracts deploying on Stellar). Redirect to `/vault/<id>` in
   waiting-on-deposits state.
9. Fund the **provider deposit** side from the wallet (since this is a single-wallet
   demo).
10. Fund the **subscriber deposit** side likewise.
11. Status flips to **active**. The heartbeat panel ticks every 15s — green dots.
12. Ctrl+C `pnpm demo:target` in its terminal.
13. Within `3 × 15s = 45s`:
    - heartbeat tick fails → status `failing` → countdown reads "payout in 2 checks"
    - one more tick → "payout in 1 check"
    - one more tick → settlement fires
14. Status flips to **paid out**. PayoutCard appears with two Stellar Expert links.
15. Click each tx link → both show non-zero USDC transferred to the subscriber payout
    wallet.
16. Confirm in the wallet's transaction history: total received ≈
    `provider deposit + subscriber deposit` (minus a tiny TW protocol fee).

## Guardrails to look for

- [ ] **Failed-checks counter caps at the threshold.** The rail value reads
      `3 / 3` after settlement, never higher. If you see `8/3` or anything past
      the threshold, the cap from `check/route.ts` regressed.
- [ ] **No tick storm.** The dev-server log should show ~1 POST `/check` per
      `oracle_period_sec`, not multiple per second.
- [ ] **Settlement is idempotent.** If you reload mid-settlement or the first
      attempt fails, subsequent ticks see `triggered_at` recent → respond with
      `debounced: true` and don't hit TW again. After 30s, retry is allowed.
- [ ] **`settle_error` clears on success.** After a successful payout the
      vault row's `settle_error` is null.

## Tear-down (between runs)

Wipe all data in Supabase SQL editor:

```sql
delete from public.checks;
delete from public.vaults;
delete from public.listings;
```

Restart `pnpm demo:target` so port 4000 answers again.
