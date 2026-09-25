# Midnight Sealed-Bid Auction
> A privacy-preserving sealed-bid auction contract on the Midnight Network where losing bids remain completely private.

## Contract Address
| Network  | Address                                                          |
|----------|------------------------------------------------------------------|
| Preview  | `b671842d01b496fe92996677264432174343c0560d0b6d7bfed48612ac95702e` |
| Preprod  | [PASTE ADDRESS AFTER DEPLOY]                                     |

## What This Does
This contract implements a sealed-bid auction. Participants submit their bids privately using zero-knowledge proofs. The contract logic ensures that a bid is only accepted if it is strictly greater than the current highest bid. Losing bids are rejected at the client level and never touch the public blockchain.

## Privacy Model
- **What is PUBLIC (on-chain, visible to anyone):** The `highest_bid` amount, the `highest_bidder` identifier, and the `is_active` status of the auction.
- **What is PRIVATE (private witness, never on-chain):** The exact bid amounts of all losing participants, as well as the cryptographic credentials of the users.
- **What the user PROVES without revealing:** A user proves that their private bid is strictly higher than the current public `highest_bid`. If the proof succeeds, the new highest bid is deliberately disclosed to the chain.

## Tech Stack
- Midnight network, Compact language, Node.js v22, Docker

## Prerequisites
- Node.js v22+
- Docker Desktop (must be running for the proof server)
- Midnight Compact Compiler (`npm install -g @midnight-ntwrk/compact-compiler` or via the official installer)

## Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/LaPoshBaby/Midnight-Sealed-Auction.git
   cd Midnight-Sealed-Auction
   ```
2. Start the Docker proof server:
   ```bash
   docker run -p 6300:6300 midnightnetwork/proof-server
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Compile the contract:
   ```bash
   npm run compile
   ```

## Run Tests
Command to run the test suite:
```bash
npm test
```

## Initial Idea
[LEAVE PLACEHOLDER — I will fill this in manually]

## Screenshots
[LEAVE PLACEHOLDER — I will add compile output and contract address screenshots]
