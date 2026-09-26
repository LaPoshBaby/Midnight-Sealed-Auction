/**
 * Midnight Lace wallet connection (DApp Connector API v4).
 *
 * Everything in this module talks to the real wallet injected into the page
 * under `window.midnight`. There is no simulated connection: if the wallet is
 * missing, rejects the request, or is on the wrong network, the caller gets a
 * typed error and the UI stays disconnected.
 */
import type { ConnectedAPI, InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { parseCoinPublicKeyToHex, parseEncPublicKeyToHex } from '@midnight-ntwrk/midnight-js-utils';

import { TARGET_NETWORK_ID } from './config';

/** Machine-readable wallet failure categories surfaced to the UI. */
export type WalletErrorCode = 'not-installed' | 'user-rejected' | 'network-mismatch' | 'unknown';

export class WalletError extends Error {
  readonly code: WalletErrorCode;

  constructor(code: WalletErrorCode, message: string) {
    super(message);
    this.name = 'WalletError';
    this.code = code;
  }
}

/** A live DApp Connector session plus the key material derived from it. */
export interface WalletSession {
  readonly api: ConnectedAPI;
  readonly networkId: string;
  /** Unshielded (public) wallet address, Bech32m. */
  readonly unshieldedAddress: string;
  /** Shielded wallet address, Bech32m. */
  readonly shieldedAddress: string;
  /** Hex-encoded coin public key (required by `WalletProvider`). */
  readonly coinPublicKey: string;
  /** Hex-encoded encryption public key (required by `WalletProvider`). */
  readonly encryptionPublicKey: string;
  /** tNIGHT balance as reported by the wallet, or `null` when unknown. */
  readonly balance: bigint | null;
  /** Public identifier used by the `my_public_key` witness (fits `Uint<32>`). */
  readonly publicIdentifier: number;
}

/** True when this page has a Midnight wallet injected. */
export function isWalletInjected(): boolean {
  return discoverWallet() !== null;
}

/**
 * Finds the injected DApp Connector `InitialAPI`, preferring the Midnight Lace
 * wallet when several wallets are present.
 */
export function discoverWallet(): InitialAPI | null {
  if (typeof window === 'undefined') return null;
  const injected = window.midnight;
  if (!injected) return null;

  const candidates = Object.values(injected).filter(
    (entry): entry is InitialAPI => Boolean(entry) && typeof entry.connect === 'function',
  );
  if (candidates.length === 0) return null;

  const preferred =
    candidates.find((entry) => /lace/i.test(entry.rdns ?? '')) ??
    candidates.find((entry) => /lace/i.test(entry.name ?? '')) ??
    candidates[0];
  return preferred ?? null;
}

function normalizeNetworkId(networkId: string): string {
  return networkId.trim().toLowerCase();
}

function classifyConnectionFailure(error: unknown): WalletError {
  const err = error as { code?: number; message?: string } | undefined;
  const message = err?.message ?? String(error ?? '');
  const code = err?.code;

  if (
    code === 4001 ||
    code === -32000 ||
    code === -32603 ||
    /reject|denied|declined|cancel|disapproved/i.test(message)
  ) {
    return new WalletError('user-rejected', 'Connection request was rejected in the Lace wallet.');
  }
  return new WalletError('unknown', `Lace wallet connection failed: ${message || 'unknown error'}`);
}

/**
 * Connects to the injected Midnight Lace wallet on the target network.
 *
 * @throws {WalletError} `not-installed`, `user-rejected`, or `network-mismatch`.
 */
export async function connectWallet(): Promise<WalletSession> {
  const initial = discoverWallet();
  if (!initial) {
    throw new WalletError(
      'not-installed',
      'Midnight Lace wallet is not installed. Install the Midnight Lace extension and reload this page.',
    );
  }

  let api: ConnectedAPI;
  try {
    api = await initial.connect(TARGET_NETWORK_ID);
  } catch (error) {
    throw classifyConnectionFailure(error);
  }

  const configuration = await api.getConfiguration();
  const walletNetwork = normalizeNetworkId(configuration.networkId ?? '');
  if (walletNetwork && walletNetwork !== normalizeNetworkId(TARGET_NETWORK_ID)) {
    throw new WalletError(
      'network-mismatch',
      `Wallet is connected to "${configuration.networkId}", but this dApp requires "${TARGET_NETWORK_ID}". Switch the network in Lace and try again.`,
    );
  }

  setNetworkId(configuration.networkId ?? TARGET_NETWORK_ID);

  const [unshielded, shielded, balances] = await Promise.all([
    api.getUnshieldedAddress(),
    api.getShieldedAddresses(),
    api.getUnshieldedBalances(),
  ]);

  // Hint the wallet about the connector methods this dApp will use so it can
  // ask for permissions up-front instead of mid-flow.
  try {
    await api.hintUsage(['balanceUnsealedTransaction', 'submitTransaction', 'getProvingProvider']);
  } catch {
    // Optional: wallets are free to ignore or defer usage hints.
  }

  const rawToken = unshieldedToken().raw;
  const balance = balances?.[rawToken] ?? null;

  return {
    api,
    networkId: configuration.networkId ?? TARGET_NETWORK_ID,
    unshieldedAddress: unshielded.unshieldedAddress,
    shieldedAddress: shielded.shieldedAddress,
    coinPublicKey: parseCoinPublicKeyToHex(shielded.shieldedCoinPublicKey, configuration.networkId),
    encryptionPublicKey: parseEncPublicKeyToHex(
      shielded.shieldedEncryptionPublicKey,
      configuration.networkId,
    ),
    balance,
    publicIdentifier: publicIdentifierFrom(shielded.shieldedCoinPublicKey),
  };
}

/**
 * Derives the 32-bit public identifier disclosed by the `my_public_key`
 * witness. It is a deterministic function of the wallet's (public) coin key,
 * so it is stable per bidder while leaking nothing beyond what a winning bid
 * deliberately discloses.
 */
function publicIdentifierFrom(coinPublicKeyBech32: string): number {
  let hash = 2166136261;
  for (let i = 0; i < coinPublicKeyBech32.length; i++) {
    hash ^= coinPublicKeyBech32.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

/** Refreshes the wallet balance for an existing session. */
export async function readBalance(session: WalletSession): Promise<bigint | null> {
  try {
    const balances = await session.api.getUnshieldedBalances();
    return balances?.[unshieldedToken().raw] ?? null;
  } catch {
    return null;
  }
}
