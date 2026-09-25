/**
 * Quick script to generate a wallet and print its address.
 * No deployment, no sync waiting. Just address derivation.
 */
import { resolveNetwork, getOrCreateWallet } from './network.js';
import { createWallet } from './wallet.js';
import { WebSocket } from 'ws';

// @ts-expect-error Required for wallet
globalThis.WebSocket = WebSocket;

const { network, config: networkConfig } = resolveNetwork();
const WALLET = getOrCreateWallet(network);

console.log('\n═══ Wallet Info ═══');
if (WALLET.mnemonic) {
  console.log(`Mnemonic: ${WALLET.mnemonic}`);
}
console.log(`Seed: ${WALLET.seed.substring(0, 16)}...`);

console.log('\nCreating wallet context...');
const walletCtx = await createWallet({ network, networkConfig, seed: WALLET.seed });

const address = walletCtx.unshieldedKeystore.getBech32Address();
console.log(`\n══════════════════════════════════════`);
console.log(`  WALLET ADDRESS: ${address}`);
console.log(`══════════════════════════════════════`);
console.log(`\nFund this address at the faucet:`);
console.log(`  ${networkConfig.faucet}`);
console.log(`\nThen re-run the deploy workflow with this mnemonic.`);

await walletCtx.wallet.stop();
process.exit(0);
