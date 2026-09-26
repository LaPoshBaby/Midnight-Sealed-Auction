/**
 * Browser provider set for the Midnight.js SDK.
 *
 * Builds the six providers `findDeployedContract` / `submitTx` need, all of
 * them backed by real infrastructure:
 *
 * | Provider            | Backend                                             |
 * |---------------------|-----------------------------------------------------|
 * | publicDataProvider  | Preprod indexer (GraphQL + WebSocket)               |
 * | zkConfigProvider    | `public/zk/**` artifacts served over HTTP           |
 * | proofProvider       | Lace wallet prover, falling back to a local prover  |
 * | privateStateProvider| encrypted LevelDB in the browser                    |
 * | walletProvider      | DApp Connector `balanceUnsealedTransaction`         |
 * | midnightProvider    | DApp Connector `submitTransaction`                  |
 */
import { dappConnectorProofProvider } from '@midnight-ntwrk/midnight-js-dapp-connector-proof-provider';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import {
  CostModel,
  Transaction,
  type Binding,
  type FinalizedTransaction,
  type Proof,
  type SignatureEnabled,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { fromHex, toHex, validatePassword } from '@midnight-ntwrk/midnight-js-utils';
import type {
  MidnightProviders,
  PrivateStateProvider,
  ProofProvider,
  PublicDataProvider,
  UnboundTransaction,
} from '@midnight-ntwrk/midnight-js-types';

import {
  CONTRACT_ADDRESS,
  PREPROD_INDEXER_URL,
  PREPROD_INDEXER_WS_URL,
  fallbackProofServerUrl,
  zkArtifactsBaseUrl,
} from './config';
import type { WalletSession } from './wallet';

/**
 * The indexer types its optional WebSocket argument as the Node `ws` class
 * (via isomorphic-ws), but in the browser we hand it the platform-native
 * `WebSocket`. Everything the indexer actually uses — the constructor and the
 * standard event surface — is identical, so this widening is safe and
 * documented.
 */
type IndexerWebSocketImpl = NonNullable<Parameters<typeof indexerPublicDataProvider>[2]>;
const browserWebSocketImpl = globalThis.WebSocket as unknown as IndexerWebSocketImpl;

/** UI-facing proving lifecycle stages. */
export type ProvingStage = 'witness' | 'proving' | 'submitting' | 'confirming';

export interface BrowserProviders {
  readonly providers: MidnightProviders;
  readonly privateStateProvider: PrivateStateProvider;
  readonly publicDataProvider: PublicDataProvider;
  readonly zkConfigProvider: FetchZkConfigProvider<string>;
  readonly provingBackend: 'wallet' | 'proof-server';
}

/**
 * Generates a strong random password for the encrypted private-state store.
 * The store only ever lives in this browser profile; a fresh random password
 * per session keeps old, unreadable ciphertext from blocking new bids.
 */
function generateStoragePassword(): string {
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const special = '!@#$%^&*-_=+?';
  const pool = lower + upper + digits + special;

  const randomByte = (max: number): number => {
    const bytes = crypto.getRandomValues(new Uint8Array(4));
    const value = new Uint32Array(bytes)[0] ?? 0;
    return value % max;
  };

  for (let attempt = 0; attempt < 64; attempt++) {
    const pick = (alphabet: string): string => alphabet[randomByte(alphabet.length)] ?? 'x';
    const chars: string[] = [
      pick(lower),
      pick(upper),
      pick(digits),
      pick(special),
      ...Array.from({ length: 20 }, () => pick(pool)),
    ];
    for (let i = chars.length - 1; i > 0; i--) {
      const j = randomByte(i + 1);
      [chars[i], chars[j]] = [chars[j] ?? 'x', chars[i] ?? 'x'];
    }
    const candidate = chars.join('');
    try {
      validatePassword(candidate);
      return candidate;
    } catch {
      // Extremely unlikely; regenerate.
    }
  }
  throw new Error('Unable to generate a valid private-state password');
}

/** True when an error means "this proving backend is unavailable", not "the circuit failed". */
function isProvingBackendError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  const code = (error as { code?: string | number } | undefined)?.code;
  return (
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    /getProvingProvider|not (yet )?supported|unsupported|no proving|ECONNREFUSED|ENOTFOUND|Failed to connect to Proof Server|fetch failed|network error|load failed/i.test(
      message,
    )
  );
}

/**
 * Wraps a proof provider so the UI can show real stage transitions, and falls
 * back from the wallet prover to a local proof server when the wallet cannot
 * prove. Circuit assertion failures ("bid too low") are *not* retried: they are
 * legitimate results of local proving.
 */
function createResilientProofProvider(
  walletProofProvider: ProofProvider | null,
  httpProofProvider: ProofProvider | null,
  onStage: (stage: ProvingStage) => void,
): ProofProvider {
  const candidates = [walletProofProvider, httpProofProvider].filter(
    (candidate): candidate is ProofProvider => candidate !== null,
  );
  if (candidates.length === 0) {
    throw new Error(
      'No proving backend available. The wallet could not prove and no proof server is reachable.',
    );
  }

  return {
    async proveTx(unprovenTx, proveTxConfig) {
      onStage('proving');
      let lastError: unknown = null;
      for (const candidate of candidates) {
        try {
          const result = await candidate.proveTx(unprovenTx, proveTxConfig);
          onStage('submitting');
          return result;
        } catch (error) {
          lastError = error;
          if (!isProvingBackendError(error)) throw error;
        }
      }
      throw lastError ?? new Error('Proving failed');
    },
  };
}

/**
 * Builds the full provider set for a connected wallet session.
 *
 * @param session Connected DApp Connector session.
 * @param onStage Notifies the UI of the current proving stage.
 */
export async function createBrowserProviders(
  session: WalletSession,
  onStage: (stage: ProvingStage) => void,
): Promise<BrowserProviders> {
  const configuration = await session.api.getConfiguration();

  const zkConfigProvider = new FetchZkConfigProvider<string>(zkArtifactsBaseUrl());

  // `isomorphic-ws`'s browser build only exposes a default export, so the
  // indexer's internal `ws.WebSocket` lookup is undefined under bundlers and
  // its GraphQL subscriptions would silently never connect. Hand it the
  // browser's native WebSocket explicitly.
  const publicDataProvider = indexerPublicDataProvider(
    configuration.indexerUri || PREPROD_INDEXER_URL,
    configuration.indexerWsUri || PREPROD_INDEXER_WS_URL,
    browserWebSocketImpl,
  );

  const privateStateProvider = levelPrivateStateProvider({
    accountId: session.unshieldedAddress,
    privateStateStoreName: 'auction-state',
    privateStoragePasswordProvider: generateStoragePassword,
  });
  privateStateProvider.setContractAddress(CONTRACT_ADDRESS);
  // The storage password above is fresh for this session, so any ciphertext
  // written under a previous password is unreadable by construction. Drop it
  // instead of letting a decryption error surface mid-call.
  try {
    await privateStateProvider.clear();
    await privateStateProvider.clearSigningKeys();
  } catch (error) {
    console.warn('[midnight] could not reset local private state', error);
  }

  // Proving: prefer the wallet's own prover (proof never leaves the device),
  // fall back to a local proof server if the wallet cannot prove.
  let walletProofProvider: ProofProvider | null = null;
  try {
    walletProofProvider = await dappConnectorProofProvider(
      session.api,
      zkConfigProvider,
      CostModel.initialCostModel(),
    );
  } catch (error) {
    console.warn('[midnight] wallet prover unavailable, will fall back to proof server', error);
  }

  let httpProofProvider: ProofProvider | null = null;
  const proofServerUrl = fallbackProofServerUrl();
  if (!walletProofProvider || import.meta.env.VITE_FORCE_PROOF_SERVER === 'true') {
    httpProofProvider = httpClientProofProvider(proofServerUrl, zkConfigProvider);
  }

  const proofProvider = createResilientProofProvider(walletProofProvider, httpProofProvider, onStage);

  // Balancing and submission are performed by the Lace wallet itself: the
  // unbalanced transaction is serialised to hex, handed to the connector, and
  // the balanced result is deserialised back into a ledger transaction.
  const walletProvider = {
    getCoinPublicKey: () => session.coinPublicKey,
    getEncryptionPublicKey: () => session.encryptionPublicKey,
    async balanceTx(tx: UnboundTransaction, _ttl?: Date): Promise<FinalizedTransaction> {
      onStage('submitting');
      const { tx: balancedHex } = await session.api.balanceUnsealedTransaction(
        toHex(tx.serialize()),
      );
      return Transaction.deserialize<SignatureEnabled, Proof, Binding>(
        'signature',
        'proof',
        'binding',
        fromHex(balancedHex),
      );
    },
  };

  const midnightProvider = {
    async submitTx(tx: FinalizedTransaction): Promise<string> {
      onStage('confirming');
      await session.api.submitTransaction(toHex(tx.serialize()));
      const identifiers = tx.identifiers();
      const txId = identifiers[0];
      if (!txId) throw new Error('Wallet submitted the transaction but returned no transaction id');
      return txId;
    },
  };

  const providers: MidnightProviders = {
    privateStateProvider,
    publicDataProvider,
    zkConfigProvider,
    proofProvider,
    walletProvider,
    midnightProvider,
  };

  return {
    providers,
    privateStateProvider,
    publicDataProvider,
    zkConfigProvider,
    provingBackend: httpProofProvider && !walletProofProvider ? 'proof-server' : 'wallet',
  };
}

/** Read-only provider set used before (or without) connecting a wallet. */
export function createPublicDataReader(): PublicDataProvider {
  return indexerPublicDataProvider(PREPROD_INDEXER_URL, PREPROD_INDEXER_WS_URL, browserWebSocketImpl);
}
