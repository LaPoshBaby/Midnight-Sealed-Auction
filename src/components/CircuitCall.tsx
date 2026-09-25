import React, { useState } from 'react';
import type { TxResult } from '../hooks/useMidnight';

interface CircuitCallProps {
  isConnected: boolean;
  contractAddress: string;
  highestBid: number;
  highestBidder: string;
  isAuctionActive: boolean;
  isProving: boolean;
  provingStep: string;
  isSubmitting: boolean;
  txResult: TxResult | null;
  error: string | null;
  onBid: (amount: number) => Promise<boolean>;
  onCloseAuction: () => Promise<boolean>;
  onClearError: () => void;
}

export const CircuitCall: React.FC<CircuitCallProps> = ({
  isConnected,
  contractAddress,
  highestBid,
  highestBidder,
  isAuctionActive,
  isProving,
  provingStep,
  isSubmitting,
  txResult,
  error,
  onBid,
  onCloseAuction,
  onClearError,
}) => {
  const [bidInput, setBidInput] = useState<string>((highestBid + 50).toString());
  const [copiedTx, setCopiedTx] = useState(false);

  const handleBidSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(bidInput);
    if (!val || val <= 0) return;
    await onBid(val);
  };

  const formatHash = (h: string) => {
    if (h.length <= 24) return h;
    return `${h.slice(0, 16)}...${h.slice(-10)}`;
  };

  const handleCopyTx = (tx: string) => {
    navigator.clipboard.writeText(tx);
    setCopiedTx(true);
    setTimeout(() => setCopiedTx(false), 2000);
  };

  return (
    <div className="circuit-card">
      <div className="card-header">
        <div>
          <h2 className="card-title">Midnight ZK Sealed-Bid Auction</h2>
          <p className="card-subtitle">
            Deployed on Midnight Preprod: <code className="contract-inline">{contractAddress.slice(0, 12)}...{contractAddress.slice(-8)}</code>
          </p>
        </div>
        <div className="status-badge-container">
          <span className={`auction-status-badge ${isAuctionActive ? 'active' : 'closed'}`}>
            {isAuctionActive ? '🟢 AUCTION ACTIVE' : '🔴 AUCTION CLOSED'}
          </span>
        </div>
      </div>

      {/* On-Chain Public Ledger Display */}
      <div className="ledger-overview-grid">
        <div className="ledger-metric-box">
          <span className="metric-label">CURRENT PUBLIC HIGHEST BID</span>
          <span className="metric-value">{highestBid} <small>tNIGHT</small></span>
          <span className="metric-subtext">Visible on-chain to all observers</span>
        </div>

        <div className="ledger-metric-box">
          <span className="metric-label">CURRENT HIGHEST BIDDER</span>
          <span className="metric-value-address" title={highestBidder}>
            {highestBidder.slice(0, 14)}...{highestBidder.slice(-6)}
          </span>
          <span className="metric-subtext">Public winner identifier</span>
        </div>
      </div>

      {/* Privacy Guarantee Banner (Mandatory Label) */}
      <div className="privacy-callout-banner">
        <div className="privacy-badge">
          <span className="lock-icon">🔒</span>
          <strong>Proved without revealing your input</strong>
        </div>
        <p className="privacy-explanation">
          Your bid amount is held exclusively inside your local browser witness sandbox. The Compact circuit 
          generates a zero-knowledge proof that your bid is strictly higher than <strong>{highestBid} tNIGHT</strong>. 
          If your bid is lower, the circuit assertion reverts locally—your bid is never published, never stored, and never leaked to the chain!
        </p>
      </div>

      {/* Circuit Execution Form */}
      {isAuctionActive ? (
        <form onSubmit={handleBidSubmit} className="bid-form">
          <div className="input-group">
            <label htmlFor="private-bid-amount" className="input-label">
              <span>Your Shielded Bid Amount:</span>
              <span className="shielded-tag">🛡️ Client-Side Private Witness</span>
            </label>
            <div className="input-wrapper">
              <input
                id="private-bid-amount"
                type="number"
                min={highestBid + 1}
                step="1"
                disabled={!isConnected || isProving || isSubmitting}
                value={bidInput}
                onChange={(e) => setBidInput(e.target.value)}
                placeholder={`Enter amount > ${highestBid}`}
                className="bid-input"
                required
              />
              <span className="input-unit">tNIGHT</span>
            </div>
            <span className="input-hint">
              Must be strictly greater than current highest bid ({highestBid} tNIGHT).
            </span>
          </div>

          <div className="action-buttons-group">
            <button
              type="submit"
              disabled={!isConnected || isProving || isSubmitting}
              className="btn-call-circuit"
              id="call-circuit-btn"
            >
              {isProving ? (
                <span className="btn-loading">
                  <span className="spinner-small"></span> Generating ZK Proof...
                </span>
              ) : isSubmitting ? (
                <span className="btn-loading">
                  <span className="spinner-small"></span> Submitting to Preprod...
                </span>
              ) : (
                'Call bid() Circuit with ZK Proof'
              )}
            </button>

            <button
              type="button"
              onClick={onCloseAuction}
              disabled={!isConnected || isProving || isSubmitting}
              className="btn-close-circuit"
              id="close-circuit-btn"
            >
              Close Auction Circuit
            </button>
          </div>
        </form>
      ) : (
        <div className="auction-closed-notice">
          <h3>Auction is Closed</h3>
          <p>The auction contract on Preprod is no longer accepting new bids. Final winning bid: <strong>{highestBid} tNIGHT</strong>.</p>
        </div>
      )}

      {/* Proof Generation & Submission Real-Time Indicator */}
      {(isProving || isSubmitting) && (
        <div className="proving-status-card" role="status" aria-live="polite">
          <div className="proving-header">
            <span className="spinner-ring"></span>
            <div>
              <h4 className="proving-title">
                {isProving ? 'Compiling Zero-Knowledge Circuit Proof' : 'Submitting Transaction to Midnight Preprod'}
              </h4>
              <p className="proving-detail">
                {isProving ? provingStep : 'Awaiting consensus confirmation on block indexer...'}
              </p>
            </div>
          </div>
          <div className="proving-bar-bg">
            <div className={`proving-bar-fill ${isSubmitting ? 'step-submitting' : 'step-proving'}`}></div>
          </div>
        </div>
      )}

      {/* Execution Error Notice */}
      {error && (
        <div className="circuit-error-banner" role="alert">
          <div className="error-title-row">
            <span className="error-icon">❌</span>
            <strong>Circuit Reversion / Error:</strong>
          </div>
          <p className="error-text">{error}</p>
          <button onClick={onClearError} className="error-dismiss-btn" aria-label="Dismiss">✕</button>
        </div>
      )}

      {/* Confirmed On-Chain Transaction Result */}
      {txResult && (
        <div className="tx-result-card" role="region" aria-label="Transaction Result">
          <div className="result-header">
            <span className="result-icon">✓</span>
            <div>
              <h3 className="result-title">Transaction Submitted On-Chain</h3>
              <p className="result-subtitle">{txResult.message}</p>
            </div>
          </div>

          <div className="result-details">
            <div className="result-row">
              <span className="row-label">Circuit Called:</span>
              <code className="code-pill">{txResult.circuitName}</code>
            </div>
            <div className="result-row">
              <span className="row-label">Transaction Hash:</span>
              <div className="hash-wrapper">
                <code className="code-pill tx-hash">{formatHash(txResult.txHash)}</code>
                <button 
                  onClick={() => handleCopyTx(txResult.txHash)} 
                  className="btn-copy-small"
                  id="copy-tx-btn"
                >
                  {copiedTx ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
            {txResult.blockHeight && (
              <div className="result-row">
                <span className="row-label">Preprod Block Height:</span>
                <span className="code-pill">#{txResult.blockHeight.toLocaleString()}</span>
              </div>
            )}
            <div className="result-row">
              <span className="row-label">Timestamp:</span>
              <span>{txResult.timestamp}</span>
            </div>
            {txResult.disclosedHighestBid && (
              <div className="result-row highlight-row">
                <span className="row-label">Disclosed Highest Bid:</span>
                <strong className="disclosed-amount">{txResult.disclosedHighestBid} tNIGHT</strong>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
