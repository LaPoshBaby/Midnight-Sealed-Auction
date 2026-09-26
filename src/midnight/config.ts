/**
 * Runtime configuration for the browser dApp.
 *
 * Everything here is read-only configuration: network target, the deployed
 * contract address, and the URLs used to fetch ZK artifacts / talk to the
 * Preprod indexer. Nothing in this module performs I/O.
 */

/** The Midnight network this dApp is bound to. */
export const TARGET_NETWORK_ID = 'preprod';

/** Contract deployed to Preprod by the Level 1 deployment workflow. */
export const PREPROD_CONTRACT_ADDRESS =
  'ddfce3729deff0625222a385625130a06a8f5467592d5fd8d8b3a0fa3bcc8fb7';

/** Contract deployed to the Preview testnet (kept for reference). */
export const PREVIEW_CONTRACT_ADDRESS =
  'b671842d01b496fe92996677264432174343c0560d0b6d7bfed48612ac95702e';

/** The contract address every frontend call targets. */
export const CONTRACT_ADDRESS = PREPROD_CONTRACT_ADDRESS;

/** Private state slot used by `findDeployedContract` / `privateStateProvider`. */
export const PRIVATE_STATE_ID = 'auctionPrivateState';

/** Directory under `public/` that mirrors `managed/auction` (keys + zkir). */
export const ZK_ARTIFACTS_DIR = 'zk';

/** Preprod indexer endpoints, used until the wallet reports its own config. */
export const PREPROD_INDEXER_URL = 'https://indexer.preprod.midnight.network/api/v4/graphql';
export const PREPROD_INDEXER_WS_URL = 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws';

/**
 * Local proof server used only when the connected wallet cannot prove by
 * itself (`docker compose up -d` starts it). Overridable per deployment with
 * `VITE_PROOF_SERVER_URL`.
 */
export const FALLBACK_PROOF_SERVER_URL = 'http://127.0.0.1:6300';

/**
 * Absolute base URL of the compiled ZK artifacts (`public/zk/...`).
 * `FetchZkConfigProvider` parses its base URL with `new URL(...)`, so an
 * origin-qualified absolute URL is required.
 */
export function zkArtifactsBaseUrl(): string {
  const base = import.meta.env.BASE_URL || '/';
  const path = `${base.replace(/\/+$/, '')}/${ZK_ARTIFACTS_DIR}`;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return new URL(path, window.location.origin).toString();
  }
  return path;
}

/** Absolute URL of the fallback proof server, if one is configured. */
export function fallbackProofServerUrl(): string {
  const configured = import.meta.env.VITE_PROOF_SERVER_URL;
  return typeof configured === 'string' && configured.length > 0
    ? configured
    : FALLBACK_PROOF_SERVER_URL;
}
