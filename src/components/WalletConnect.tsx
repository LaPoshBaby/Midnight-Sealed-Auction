import React, { useState } from 'react';

interface WalletConnectProps {
  isConnected: boolean;
  isConnecting?: boolean;
  walletDetected?: boolean;
  walletAddress: string | null;
  walletBalance: string | null;
  network: string;
  error: string | null;
  onConnect: () => Promise<void>;
  onDisconnect: () => void;
  onClearError: () => void;
}

export const WalletConnect: React.FC<WalletConnectProps> = ({
  isConnected,
  isConnecting = false,
  walletDetected = true,
  walletAddress,
  walletBalance,
  network,
  error,
  onConnect,
  onDisconnect,
  onClearError,
}) => {
  const [copied, setCopied] = useState(false);

  const connecting = isConnecting;

  const handleCopy = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatAddress = (addr: string) => {
    if (addr.length <= 20) return addr;
    return `${addr.slice(0, 14)}...${addr.slice(-8)}`;
  };

  return (
    <div className="wallet-card">
      <div className="wallet-header">
        <div className="wallet-title-area">
          <div className="pulse-indicator-wrapper">
            <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
            <span className="wallet-title">Midnight Lace Wallet</span>
          </div>
          <span className="network-pill">
            <span className="network-dot"></span>
            Midnight {network.toUpperCase()}
          </span>
        </div>

        {isConnected ? (
          <button onClick={onDisconnect} className="btn-disconnect" id="disconnect-wallet-btn">
            Disconnect
          </button>
        ) : (
          <button 
            onClick={onConnect} 
            disabled={connecting} 
            className="btn-connect"
            id="connect-wallet-btn"
          >
            {connecting ? (
              <span className="btn-loading">
                <span className="spinner-small"></span> Connecting...
              </span>
            ) : (
              'Connect Lace Wallet'
            )}
          </button>
        )}
      </div>

      {error && (
        <div className="wallet-error-banner" role="alert">
          <div className="error-icon">⚠️</div>
          <div className="error-body">
            <strong>Connection Error</strong>
            <p>{error}</p>
          </div>
          <button onClick={onClearError} className="error-dismiss-btn" aria-label="Dismiss">✕</button>
        </div>
      )}

      {isConnected && walletAddress ? (
        <div className="wallet-details">
          <div className="detail-row">
            <span className="detail-label">Connected Address:</span>
            <div className="address-container">
              <code className="address-code" title={walletAddress}>
                {formatAddress(walletAddress)}
              </code>
              <button 
                onClick={handleCopy} 
                className="btn-copy" 
                title="Copy full address"
                id="copy-address-btn"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>
          {walletBalance && (
            <div className="detail-row">
              <span className="detail-label">Balance:</span>
              <span className="balance-badge">{walletBalance}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="disconnected-notice">
          <p>
            Wallet disconnected. Connect your Midnight Lace wallet to submit private bids and
            interact with the Preprod contract.
          </p>
          {!walletDetected && (
            <p className="wallet-missing-hint">
              No Midnight Lace wallet detected in this browser. Install the extension and reload
              this page before connecting.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
