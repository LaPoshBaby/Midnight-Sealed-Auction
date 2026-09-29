# Product Proposal

## What is the product, and who uses it?

Midnight Sealed-Bid Auction is a one-round, sealed-bid auction where **losing
bids never exist on the chain at all**. A bidder proves, inside a
zero-knowledge circuit running in their own browser, that their bid is strictly
higher than the current public highest bid — and if it isn't, the circuit
fails locally and nothing is ever transmitted. No commit phase, no reveal
phase, no auctioneer holding the envelope: the only thing the chain ever
learns is each genuine new winning bid.

**Who uses it, and what it fixes for them:**

- **NFT and token launch teams.** Public orderbooks and transparent Dutch
  auctions leak demand in real time and invite sniping in the final block.
  A sealed round settles on merit, not on who watched the mempool best.
- **DAOs and treasuries running RFPs and service procurements.** Today a
  "sealed" procurement on a transparent chain is a spreadsheet held by a
  committee. Here the envelope is cryptographic and the tally is trustless.
- **OTC desks and market makers.** Price discovery without broadcasting
  intent — no counterparty can see your size, and failed interest leaves no
  trace for competitors to scrape.
- **Any bidder operating under MEV conditions.** The single biggest UX
  failure of on-chain auctions is that honesty is expensive: revealing your
  true maximum invites front-running. This product makes honesty free,
  because the true maximum is never publishable — only beatable.

The roadmap keeps the same grain: a commitment window with deposit escrow
(`Uint<64>` amounts settled through the zswap ledger), tie-break and reserve
price rules, and multi-lot auctions — each an extension of the same
circuit, not a redesign.

## Why Midnight specifically?

Because the product's core claim — *losing bids never touch the chain* — is
not a feature a transparent chain can bolt on; it is a property of where
computation happens.

On Ethereum, a sealed auction is a compromise, and every variant leaks:

- **Open bids** leak everything, instantly: mempool bots outbid you by one
  wei and the auction is a front-running competition.
- **Commit–reveal** needs two rounds, doubles the gas, still leaks the
  timing and frequency of participation, and dies silently whenever a
  bidder fails to reveal. The "seal" is enforced by an eventual disclosure
  the bidder controls — which is exactly the weakness.
- **Trusted auctioneers or TEEs** move the leak to an operator and ask you
  to trust hardware vendors instead of cryptography.

Midnight changes the order of operations. The bid lives in a private witness
on the bidder's machine. The circuit asserts `bid_amount > highest_bid` and
`is_active == true`; a losing bid **aborts inside the local prover**, so no
transaction is ever constructed, submitted, or visible — not even its
existence. Only a genuinely higher bid produces a proof, and only the new
`highest_bid` / `highest_bidder` pair is disclosed through the circuit's
deliberate `disclose()` boundary. Compact's compiler enforces the boundary:
anything not disclosed cannot compile its way onto the chain, and our own
test suite asserts the isolation.

That is the decisive difference: on a transparent chain, privacy is a
protocol you bolt around public state. On Midnight, it is the state model.

## Data Model

| Data Point | Type | Disclosed To |
|------------------|----------------|--------------|
| `highest_bid` — current winning amount | Public ledger | Everyone |
| `highest_bidder` — winner's public identifier | Public ledger | Everyone |
| `is_active` — auction status flag | Public ledger | Everyone |
| Transaction id, block height, fees | Public ledger | Everyone |
| Validity proof per successful bid | Public (transaction) | Everyone — proves the rules, never the inputs |
| `my_bid()` — the bidder's secret amount | Private witness | No one — stays in the browser's encrypted store |
| `my_public_key()` — bidder identity witness | Private witness | No one — disclosed only on a winning bid |
| Losing bids | Never created | No one — they abort locally and transmit 0 bytes |
| Failed bidding attempts / participation rate | Derived from privacy | No one — unobservable by design |

## Mainnet Feasibility

**Realistic by Level 6 — the contract is small and the path is already
network-agnostic.**

The circuit is two witnesses, one assertion, two deliberate disclosures; it
compiles in seconds and proofs are wallet-local. The engineering position:

- **Toolchain pins.** The compiler is pinned (`compact update 0.31.1`) to
  match the `@midnight-ntwrk/compact-runtime` 0.16.0 the SDK expects, and CI
  (green on every push) compiles and tests against the exact pinned
  toolchain, so drift is caught automatically.
- **One-flag deployment.** `deploy.yml` already deploys to `preview` or
  `preprod` from a single dispatch input, with wallet-state caching and
  automatic README address updates. Mainnet is a third option on an
  existing switch.
- **Frontend port = two constants.** `src/midnight/config.ts` carries the
  network id and the deployed contract address; the Vercel build is live
  and network-blind today.

**What actually gates the date:**

1. **Hardening the admin surface.** `close_auction()` is intentionally
   unguarded in this build (documented as a stub); mainnet needs an owner
   guard and a sealed end-time. Small, but it must be done and audited.
2. **Economic mechanics.** Bids on mainnet move real value, so the circuit
   needs deposit escrow and refund settlement through the zswap ledger —
   the largest genuine piece of new circuit work.
3. **Toolchain churn.** Pre-1.0 SDKs will move versions before mainnet; the
   pins follow, and CI holds the line.
4. **Audit.** An auction contract handles custody-adjacent value; the audit
   is the critical path, and the code is structured for it now — one file,
   one circuit, explicit disclosure boundary.

**Bottom line:** the same repo, the same pipeline and the same dApp reach
mainnet by adding the deposit escrow circuit, hardening two admin guards,
bumping the toolchain pins and passing an audit. Everything else — CI,
deployment tooling, wallet flow, privacy tests — is already in place.
