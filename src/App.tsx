import React from 'react';
import { useMidnight } from './hooks/useMidnight';
import { WalletConnect } from './components/WalletConnect';
import { CircuitCall } from './components/CircuitCall';

export const App: React.FC = () => {
  const midnight = useMidnight();

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="brand-badge">
          <span>Midnight Builder Challenge</span>
          <span>•</span>
          <span>Level 2</span>
        </div>
        <h1 className="app-title">Midnight Sealed-Bid Auction</h1>
        <p className="app-tagline">
          Zero-knowledge sealed-bid auction powered by the Midnight network. Losing bids remain completely shielded and never touch the chain.
        </p>
      </header>

      <main className="app-main">
        {/* Wallet Connection Section */}
        <WalletConnect
          isConnected={midnight.isConnected}
          walletAddress={midnight.walletAddress}
          walletBalance={midnight.walletBalance}
          network={midnight.network}
          error={midnight.error}
          onConnect={midnight.connect}
          onDisconnect={midnight.disconnect}
          onClearError={midnight.clearError}
        />

        {/* Circuit Call Section */}
        <CircuitCall
          isConnected={midnight.isConnected}
          contractAddress={midnight.contractAddress}
          highestBid={midnight.highestBid}
          highestBidder={midnight.highestBidder}
          isAuctionActive={midnight.isAuctionActive}
          isProving={midnight.isProving}
          provingStep={midnight.provingStep}
          isSubmitting={midnight.isSubmitting}
          txResult={midnight.txResult}
          error={midnight.error}
          onBid={midnight.callBidCircuit}
          onCloseAuction={midnight.callCloseCircuit}
          onClearError={midnight.clearError}
        />

        {/* Technical Architecture & Privacy Claims */}
        <section className="info-section-card">
          <h3 className="info-title">Privacy Architecture & Cryptographic Guarantees</h3>
          <div className="info-grid">
            <div className="info-item">
              <h4>Public State (On-Chain)</h4>
              <p>
                Only <code>highest_bid</code>, <code>highest_bidder</code>, and <code>is_active</code> are ever stored on the Midnight ledger. Any public observer can verify who the current winner is and the winning threshold.
              </p>
            </div>

            <div className="info-item">
              <h4>Private Witness (Client-Side)</h4>
              <p>
                Your bid amount is passed to the circuit as witness <code>my_bid</code>. It runs locally inside the browser cryptographic prover and is never exposed in plaintext.
              </p>
            </div>

            <div className="info-item">
              <h4>Off-Chain Failure Protection</h4>
              <p>
                If a user bids lower than the current highest bid, the circuit assertion fails locally during proof generation. No transaction is broadcast, meaning losing bids never touch the blockchain.
              </p>
            </div>

            <div className="info-item">
              <h4>Deliberate Disclosure</h4>
              <p>
                Only when a bid is strictly greater than the highest bid does the circuit invoke <code>disclose(bid_amount)</code> to atomically crown the new highest bidder.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <p>
          Contract Deployed on Midnight Preprod: <code>{midnight.contractAddress}</code>
        </p>
        <p style={{ marginTop: '6px' }}>
          Built for the Midnight Builder Challenge by <a href="https://github.com/LaPoshBaby" target="_blank" rel="noreferrer">LaPoshBaby</a>
        </p>
      </footer>
    </div>
  );
};

export default App;
