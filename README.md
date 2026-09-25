# Midnight Sealed-Bid Auction
> A privacy-preserving sealed-bid auction contract on the Midnight Network where losing bids remain completely private.

## Contract Address
| Network  | Address                                                          |
|----------|------------------------------------------------------------------|
| Preview  | `b671842d01b496fe92996677264432174343c0560d0b6d7bfed48612ac95702e` |
| Preprod  | `ddfce3729deff0625222a385625130a06a8f5467592d5fd8d8b3a0fa3bcc8fb7` |

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
In traditional on-chain auctions, every bid is either public or vulnerable to front-running, maximal extractable value (MEV), and bidder collusion. Even on Ethereum, pseudo-sealed auctions require multi-phase commit-reveal schemes with high gas overhead or centralized auctioneers who can leak bid data. The inspiration behind this project was to leverage Midnight Network's native zero-knowledge architecture to build a true one-round, private sealed-bid auction: participants submit cryptographically shielded bids using zero-knowledge proofs where losing bids are rejected off-chain and never revealed, preserving complete bidder privacy while publicly declaring only genuine higher bids.

## Screenshots

### 1. Contract Compilation & Test Suite
![Compile & Test](docs/screenshots/compile_and_test.png)

### 2. Preprod Deployment & On-Chain Contract Confirmation
![Preprod Deployment](docs/screenshots/deployment_preprod.png)

### 3. GitHub Actions CI/CD Run (#36119554846)
![GitHub Actions CI/CD Deployment](docs/screenshots/github_workflow_run.png)

