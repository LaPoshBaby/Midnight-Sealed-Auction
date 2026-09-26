/**
 * Binds the compiled Compact contract (`managed/auction`) to the browser.
 *
 * The `bid()` circuit takes no public arguments: the bid amount and the
 * bidder's public identifier are supplied by the `my_bid` / `my_public_key`
 * witnesses and therefore live exclusively in the client's private state.
 */
import * as Auction from '../../managed/auction/contract/index.js';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';

/**
 * Private (witness) state for one bidder. Stored encrypted in the browser by
 * `levelPrivateStateProvider` and never transmitted anywhere.
 */
export interface AuctionPrivateState {
  /** Secret bid amount, in tNIGHT. Witness input for `my_bid`. */
  my_bid: number;
  /** Public identifier disclosed on a winning bid (derived from the wallet key). */
  my_public_key: number;
}

export const auctionWitnesses: Auction.Witnesses<AuctionPrivateState> = {
  my_bid: (context) => [context.privateState, BigInt(context.privateState.my_bid)],
  my_public_key: (context) => [context.privateState, BigInt(context.privateState.my_public_key)],
};

/**
 * Contract binding with witnesses attached. The compiled ZK artifacts are not
 * attached here (`withCompiledFileAssets` is a Node-ism); the browser loads
 * them over HTTP through `FetchZkConfigProvider` instead.
 */
export const compiledAuctionContract = CompiledContract.make('auction', Auction.Contract).pipe(
  CompiledContract.withWitnesses(auctionWitnesses),
);

/** Public ledger state decoded from an indexer contract state. */
export interface AuctionPublicState {
  highestBid: number;
  highestBidder: string;
  isAuctionActive: boolean;
}

/**
 * Decodes the public on-chain state of the auction contract.
 *
 * @param contractState The `ContractState` returned by the indexer, or `null`.
 */
export function decodeAuctionState(contractState: unknown): AuctionPublicState | null {
  if (!contractState) return null;
  const data = (contractState as { data?: unknown }).data;
  if (data === undefined || data === null) return null;

  const ledger = Auction.ledger(data as Parameters<typeof Auction.ledger>[0]);
  return {
    highestBid: Number(ledger.highest_bid),
    highestBidder: ledger.highest_bidder.toString(),
    isAuctionActive: ledger.is_active,
  };
}
