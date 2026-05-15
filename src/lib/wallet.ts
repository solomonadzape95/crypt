"use client";

import {
  StellarWalletsKit,
  Networks,
} from "@creit.tech/stellar-wallets-kit";
import {
  FreighterModule,
  FREIGHTER_ID,
} from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { AlbedoModule } from "@creit.tech/stellar-wallets-kit/modules/albedo";
import { xBullModule } from "@creit.tech/stellar-wallets-kit/modules/xbull";
import { LobstrModule } from "@creit.tech/stellar-wallets-kit/modules/lobstr";

let initialized = false;

function ensureInit() {
  if (initialized || typeof window === "undefined") return;
  StellarWalletsKit.init({
    network: Networks.TESTNET,
    selectedWalletId: FREIGHTER_ID,
    modules: [
      new FreighterModule(),
      new AlbedoModule(),
      new xBullModule(),
      new LobstrModule(),
    ],
  });
  initialized = true;
}

export class WalletError extends Error {
  constructor(message: string, readonly kind: "rejected" | "no-wallet" | "unknown" = "unknown") {
    super(message);
  }
}

export type WalletInfo = { address: string };

/** Open the wallet-picker modal. Returns the selected address. */
export async function connectWallet(): Promise<WalletInfo> {
  ensureInit();
  try {
    const { address } = await StellarWalletsKit.authModal();
    return { address };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not connect a wallet.";
    throw new WalletError(msg, "rejected");
  }
}

/** Disconnect the active wallet (clears kit's selected module). */
export async function disconnectWallet(): Promise<void> {
  ensureInit();
  try {
    await StellarWalletsKit.disconnect();
  } catch {
    // ignore
  }
}

/** Returns the currently active wallet address, or null if none. */
export async function getActiveAddress(): Promise<string | null> {
  ensureInit();
  try {
    const { address } = await StellarWalletsKit.getAddress();
    return address || null;
  } catch {
    return null;
  }
}

/** Sign a login challenge. Returns base64-encoded signature. */
export async function signLoginMessage(
  message: string,
  address: string
): Promise<string> {
  ensureInit();
  try {
    const { signedMessage } = await StellarWalletsKit.signMessage(message, {
      networkPassphrase: Networks.TESTNET,
      address,
    });
    if (typeof signedMessage !== "string") {
      // Should never happen with kit v2.2+, but guard anyway.
      throw new WalletError("Unexpected signMessage shape from kit.", "unknown");
    }
    return signedMessage;
  } catch (e) {
    if (e instanceof WalletError) throw e;
    throw new WalletError(e instanceof Error ? e.message : "Sign rejected.", "rejected");
  }
}

/** Sign a transaction XDR. Returns the signed XDR string. */
export async function signXDR(xdr: string, address?: string): Promise<string> {
  ensureInit();
  try {
    const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
      networkPassphrase: Networks.TESTNET,
      address,
    });
    return signedTxXdr;
  } catch (e) {
    throw new WalletError(e instanceof Error ? e.message : "Sign rejected.", "rejected");
  }
}
