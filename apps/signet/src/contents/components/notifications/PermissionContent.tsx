import React from 'react';
import { type PermissionContentProps, type DefaultPermissionContentProps, PermissionLevel, BannerType, type SwapPermissionContentProps } from './types';
import { PermissionLevelIndicator, OriginBanner, FeatureExplanation, OperationTypeDisplay } from './UIComponents';
import { PermissionIcons } from './Icons';
import { commonStyles } from './styles';

/**
 * ExtensionCheck permission content
 */
export const ExtensionCheckContent: React.FC<PermissionContentProps> = ({ origin, rememberCheckbox }) => (
  <div style={commonStyles.contentContainer}>
    <PermissionLevelIndicator level={PermissionLevel.INFO} />

    <OriginBanner
      origin={origin}
      type={BannerType.INFO}
      message="wants to detect Signet"
    />

    <div style={commonStyles.explanationContainer}>
      <FeatureExplanation
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 6H20M4 12H14M4 18H10" stroke="#36C758" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
        text="Check if Signet extension is installed"
      />

      <FeatureExplanation
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#36C758" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 17L12 22L22 17" stroke="#36C758" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 12L12 17L22 12" stroke="#36C758" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
        text="Retrieve extension version information"
      />
    </div>

    {rememberCheckbox}
  </div>
);

/**
 * GetStatus permission content
 */
export const GetStatusContent: React.FC<PermissionContentProps> = ({ origin, rememberCheckbox }) => (
  <div style={commonStyles.contentContainer}>
    <PermissionLevelIndicator level={PermissionLevel.INFO} />

    <OriginBanner
      origin={origin}
      type={BannerType.INFO}
      message="wants to read Signet status"
    />

    <div style={commonStyles.explanationContainer}>
      <FeatureExplanation
        icon={PermissionIcons.status}
        text="View connection status"
      />

      <FeatureExplanation
        icon={PermissionIcons.subnet}
        text="See available subnets"
      />

      <FeatureExplanation
        icon={PermissionIcons.wallet}
        text="Access wallet address"
      />
    </div>

    {rememberCheckbox}
  </div>
);

/**
 * Balance permission content
 */
export const BalanceContent: React.FC<PermissionContentProps> = ({ origin, rememberCheckbox }) => (
  <div style={commonStyles.contentContainer}>
    <PermissionLevelIndicator level={PermissionLevel.SENSITIVE} />

    <OriginBanner
      origin={origin}
      type={BannerType.WARNING}
      message="wants to access your account balance"
    />

    <div style={commonStyles.explanationContainer}>
      <FeatureExplanation
        icon={PermissionIcons.balance}
        text="View your balance on a specific subnet"
      />

      <FeatureExplanation
        icon={PermissionIcons.wallet}
        text="Access wallet address"
      />
    </div>

    {rememberCheckbox}
  </div>
);

/**
 * Balances permission content
 */
export const BalancesContent: React.FC<PermissionContentProps> = ({ origin, rememberCheckbox }) => (
  <div style={commonStyles.contentContainer}>
    <PermissionLevelIndicator level={PermissionLevel.SENSITIVE} />

    <OriginBanner
      origin={origin}
      type={BannerType.WARNING}
      message="wants to access all your account balances"
    />

    <div style={commonStyles.explanationContainer}>
      <FeatureExplanation
        icon={PermissionIcons.balance}
        text="View your balances across all subnets"
      />

      <FeatureExplanation
        icon={PermissionIcons.subnet}
        text="Access information about all your subnets"
      />
    </div>

    {rememberCheckbox}
  </div>
);

/**
 * Transfer permission content
 */
export const TransferContent: React.FC<PermissionContentProps> = ({ origin, rememberCheckbox }) => (
  <div style={commonStyles.contentContainer}>
    <PermissionLevelIndicator level={PermissionLevel.CRITICAL} />

    <OriginBanner
      origin={origin}
      type={BannerType.CRITICAL}
      message="wants to create a transfer transaction"
    />

    <div style={commonStyles.explanationContainer}>
      <FeatureExplanation
        icon={PermissionIcons.transfer}
        text="Transfer tokens from your wallet"
      />

      <FeatureExplanation
        icon={PermissionIcons.wallet}
        text="Access your wallet address and balance"
      />
    </div>

    {rememberCheckbox}
  </div>
);

/**
 * Transaction Custody permission content
 */
export const TransactionCustodyContent: React.FC<PermissionContentProps> = ({ origin, rememberCheckbox }) => (
  <div style={commonStyles.contentContainer}>
    <PermissionLevelIndicator level={PermissionLevel.CRITICAL} />

    <OriginBanner
      origin={origin}
      type={BannerType.CRITICAL}
      message="wants to take custody of a signed transaction"
    />

    <div style={commonStyles.explanationContainer}>
      <FeatureExplanation
        icon={PermissionIcons.transfer}
        text="Take control of a transaction you've signed"
      />

      <FeatureExplanation
        icon={PermissionIcons.warning}
        text="Can submit the transaction to the blockchain at any time"
      />

      <FeatureExplanation
        icon={PermissionIcons.warning}
        text="Transaction will be removed from your pending transactions"
      />
    </div>

    {rememberCheckbox}
  </div>
);

/**
 * Search Mempool permission content
 */
export const SearchMempoolContent: React.FC<PermissionContentProps> = ({ origin, rememberCheckbox }) => (
  <div style={commonStyles.contentContainer}>
    <PermissionLevelIndicator level={PermissionLevel.SENSITIVE} />

    <OriginBanner
      origin={origin}
      type={BannerType.WARNING}
      message="wants to view your pending transactions"
    />

    <div style={commonStyles.explanationContainer}>
      <FeatureExplanation
        icon={PermissionIcons.balance}
        text="View your pending transaction queue"
      />

      <FeatureExplanation
        icon={PermissionIcons.wallet}
        text="Access information about unsigned transactions"
      />

      <FeatureExplanation
        icon={PermissionIcons.warning}
        text="Transaction signatures are masked for security"
      />
    </div>

    {rememberCheckbox}
  </div>
);

/**
 * Swap permission content
 */
export const SwapContent: React.FC<SwapPermissionContentProps> = ({
  origin,
  rememberCheckbox,
  route,
  amount,
  options
}) => {
  // Helper function to render token pair for a hop
  const renderTokenPair = (hop: any, index: number, allHops: any[]) => {
    // For a proper multi-hop display, we need to:
    // 1. First determine the actual tokens in the current vault
    // 2. Then figure out the direction based on opcode
    // 3. For hops after the first, ensure the input token matches the previous hop's output

    // Collect token metadata from different places
    // For tokens in the vault (A/B or X/Y)
    let tokenA = {
      symbol: null as string | null,
      image: null as string | null,
      decimals: 6 // Default decimals
    };

    let tokenB = {
      symbol: null as string | null,
      image: null as string | null,
      decimals: 6 // Default decimals
    };

    // Check tokenA/tokenB (primary structure)
    if (hop.vault?.tokenA) {
      tokenA.symbol = hop.vault.tokenA.symbol;
      tokenA.image = hop.vault.tokenA.image;
      tokenA.decimals = hop.vault.tokenA.decimals || 6;
    }
    if (hop.vault?.tokenB) {
      tokenB.symbol = hop.vault.tokenB.symbol;
      tokenB.image = hop.vault.tokenB.image;
      tokenB.decimals = hop.vault.tokenB.decimals || 6;
    }

    // Check tokenX/tokenY (alternative naming)
    if (!tokenA.symbol && hop.vault?.tokenX) {
      tokenA.symbol = hop.vault.tokenX.symbol;
      tokenA.image = hop.vault.tokenX.image;
      tokenA.decimals = hop.vault.tokenX.decimals || 6;
    }
    if (!tokenB.symbol && hop.vault?.tokenY) {
      tokenB.symbol = hop.vault.tokenY.symbol;
      tokenB.image = hop.vault.tokenY.image;
      tokenB.decimals = hop.vault.tokenY.decimals || 6;
    }

    // Check liquidity array
    if (!tokenA.symbol && Array.isArray(hop.vault?.liquidity) && hop.vault.liquidity.length >= 1) {
      tokenA.symbol = hop.vault.liquidity[0].symbol;
      tokenA.image = hop.vault.liquidity[0].image;
      tokenA.decimals = hop.vault.liquidity[0].decimals || 6;
    }
    if (!tokenB.symbol && Array.isArray(hop.vault?.liquidity) && hop.vault.liquidity.length >= 2) {
      tokenB.symbol = hop.vault.liquidity[1].symbol;
      tokenB.image = hop.vault.liquidity[1].image;
      tokenB.decimals = hop.vault.liquidity[1].decimals || 6;
    }

    // Set defaults if still missing
    if (!tokenA.symbol) tokenA.symbol = "Token A";
    if (!tokenB.symbol) tokenB.symbol = "Token B";

    // Now determine input and output tokens based on operation code
    let fromToken, toToken;

    // Determine if this is a SWAP_A_TO_B (code 1) or SWAP_B_TO_A (code 2)
    const isSwapAToB = hop.opcode?.code !== 2; // Default to A→B if not specified

    if (isSwapAToB) {
      // A→B swap
      fromToken = { ...tokenA };
      toToken = { ...tokenB };
    } else {
      // B→A swap
      fromToken = { ...tokenB };
      toToken = { ...tokenA };
    }

    // For subsequent hops in a multi-hop route, we might need to override 
    // the fromToken to match the previous hop's toToken for continuity
    if (index > 0 && allHops[index - 1]) {
      // Look up previous hop's tokens
      const prevHop = allHops[index - 1];
      let prevToToken;

      // Determine the output token of the previous hop
      const isPrevSwapAToB = prevHop.opcode?.code !== 2;

      // We'll use the explicit tokenIn/tokenOut if available for more precision
      if (prevHop.tokenOut) {
        prevToToken = prevHop.tokenOut.symbol;
      } else if (isPrevSwapAToB && prevHop.vault?.tokenB) {
        prevToToken = prevHop.vault.tokenB.symbol;
      } else if (!isPrevSwapAToB && prevHop.vault?.tokenA) {
        prevToToken = prevHop.vault.tokenA.symbol;
      } else if (isPrevSwapAToB && prevHop.vault?.tokenY) {
        prevToToken = prevHop.vault.tokenY.symbol;
      } else if (!isPrevSwapAToB && prevHop.vault?.tokenX) {
        prevToToken = prevHop.vault.tokenX.symbol;
      } else if (Array.isArray(prevHop.vault?.liquidity)) {
        prevToToken = isPrevSwapAToB
          ? prevHop.vault.liquidity[1]?.symbol
          : prevHop.vault.liquidity[0]?.symbol;
      }

      // If we can determine that this doesn't match our current input token,
      // we have an inconsistency in the route. Let's provide a warning.
      if (prevToToken && fromToken.symbol !== prevToToken) {
        // Add a visual indicator that there's a route inconsistency
        fromToken.symbol = prevToToken;
        // We could also add a warning flag here
      }
    }

    // Direct tokenIn/tokenOut data takes precedence if available
    if (hop.tokenIn) {
      fromToken.symbol = hop.tokenIn.symbol || fromToken.symbol;
      fromToken.image = hop.tokenIn.image || fromToken.image;
      fromToken.decimals = hop.tokenIn.decimals || fromToken.decimals;
    }

    if (hop.tokenOut) {
      toToken.symbol = hop.tokenOut.symbol || toToken.symbol;
      toToken.image = hop.tokenOut.image || toToken.image;
      toToken.decimals = hop.tokenOut.decimals || toToken.decimals;
    }

    // Check for token amounts if available
    let fromAmount: number | null = null;
    let toAmount: number | null = null;

    // Try to get amounts from different possible locations
    if (index === 0 && typeof amount === 'number') {
      // For the first hop, we know the input amount
      fromAmount = amount;
    }

    // Try to get quote data if available 
    if (hop.quote) {
      if (typeof hop.quote.amountIn === 'number') fromAmount = hop.quote.amountIn;
      if (typeof hop.quote.amountOut === 'number') toAmount = hop.quote.amountOut;
    } else if (typeof hop.amountIn === 'number' && typeof hop.amountOut === 'number') {
      // Direct amounts in the hop
      fromAmount = hop.amountIn;
      toAmount = hop.amountOut;
    }

    // Generate default images if needed
    if (!fromToken.image) {
      const symbol = fromToken.symbol || "?";
      fromToken.image = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" fill="%23334155"/><text x="12" y="16" font-family="Arial" font-size="10" fill="%23f8fafc" text-anchor="middle">${symbol.charAt(0)}</text></svg>`;
    }

    if (!toToken.image) {
      const symbol = toToken.symbol || "?";
      toToken.image = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" fill="%23334155"/><text x="12" y="16" font-family="Arial" font-size="10" fill="%23f8fafc" text-anchor="middle">${symbol.charAt(0)}</text></svg>`;
    }

    return (
      <div key={index} style={{
        display: 'flex',
        alignItems: 'center',
        margin: '5px 0',
        padding: '5px',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '4px'
      }}>
        <div style={{
          padding: '4px 8px',
          backgroundColor: 'rgba(125, 249, 255, 0.1)',
          borderRadius: '4px',
          marginRight: '10px',
          fontWeight: 'bold',
          fontSize: '12px',
          color: '#7DF9FF'
        }}>
          {index + 1}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
          {/* From Token */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              width: '24px',
              height: '24px',
              marginRight: '6px',
              borderRadius: '50%',
              overflow: 'hidden',
              backgroundColor: '#334155'
            }}>
              <img
                src={fromToken.image || ''}
                alt={fromToken.symbol || ''}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  // Fallback if image fails to load
                  const target = e.target as HTMLImageElement;
                  const symbol = fromToken.symbol || "?";
                  target.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" fill="%23334155"/><text x="12" y="16" font-family="Arial" font-size="10" fill="%23f8fafc" text-anchor="middle">${symbol.charAt(0)}</text></svg>`;
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{
                fontWeight: 'bold',
                color: '#FFF',
                fontSize: '12px'
              }}>
                {fromToken.symbol}
              </span>
              {fromAmount !== null && (
                <span style={{
                  color: '#8C9CA8',
                  fontSize: '10px'
                }}>
                  {formatTokenAmount(fromAmount, fromToken.decimals)}
                </span>
              )}
            </div>
          </div>

          <span style={{ padding: '0 8px', color: '#7DF9FF' }}>→</span>

          {/* To Token */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              width: '24px',
              height: '24px',
              marginRight: '6px',
              borderRadius: '50%',
              overflow: 'hidden',
              backgroundColor: '#334155'
            }}>
              <img
                src={toToken.image || ''}
                alt={toToken.symbol || ''}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  // Fallback if image fails to load
                  const target = e.target as HTMLImageElement;
                  const symbol = toToken.symbol || "?";
                  target.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" fill="%23334155"/><text x="12" y="16" font-family="Arial" font-size="10" fill="%23f8fafc" text-anchor="middle">${symbol.charAt(0)}</text></svg>`;
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{
                fontWeight: 'bold',
                color: '#FFF',
                fontSize: '12px'
              }}>
                {toToken.symbol}
              </span>
              {toAmount !== null && (
                <span style={{
                  color: '#8C9CA8',
                  fontSize: '10px'
                }}>
                  {formatTokenAmount(toAmount, toToken.decimals)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Helper to format token amounts with proper decimal adjustment
  const formatTokenAmount = (value: number, decimals: number = 6): string => {
    if (value === null || value === undefined) return "";

    // Adjust for token decimals (convert from smallest units to standard units)
    const adjustedValue = value / Math.pow(10, decimals);

    // Different formatting based on size
    if (adjustedValue < 0.00001) return adjustedValue.toExponential(2);
    if (adjustedValue < 0.001) return adjustedValue.toFixed(6);
    if (adjustedValue < 1) return adjustedValue.toFixed(4);
    if (adjustedValue < 1000) return adjustedValue.toFixed(2);
    if (adjustedValue < 1000000) return `${(adjustedValue / 1000).toFixed(1)}K`;
    return `${(adjustedValue / 1000000).toFixed(1)}M`;
  };

  return (
    <div style={commonStyles.contentContainer}>
      <PermissionLevelIndicator level={PermissionLevel.CRITICAL} />

      <OriginBanner
        origin={origin}
        type={BannerType.CRITICAL}
        message="wants to execute a token swap"
      />

      <div style={commonStyles.explanationContainer}>
        <FeatureExplanation
          icon={PermissionIcons.swap}
          text="Swap tokens via Dexterity protocol"
        />

        <FeatureExplanation
          icon={PermissionIcons.balance}
          text={amount !== undefined ? `Amount: ${amount}` : "Amount: Unknown"}
        />

        {options?.disablePostConditions && (
          <FeatureExplanation
            icon={PermissionIcons.warning}
            text="Post-conditions disabled (be careful!)"
          />
        )}
      </div>

      {/* Swap route visualization - only shown if route data is available */}
      {route && route.hops ? (
        <div style={{
          margin: '10px 0',
          padding: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '6px',
          border: '1px solid rgba(125, 249, 255, 0.2)'
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#7DF9FF',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            {PermissionIcons.dexterity}
            <span>SWAP ROUTE ({route.hops.length} hop{route.hops.length !== 1 ? 's' : ''})</span>
          </div>

          {/* Display overall route summary if multi-hop */}
          {route.hops.length > 1 && route.tokenIn && route.tokenOut && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: '4px',
              padding: '6px 10px',
              marginBottom: '10px',
              borderLeft: '3px solid #7DF9FF'
            }}>
              {/* Starting token icon */}
              <div style={{
                width: '20px',
                height: '20px',
                marginRight: '6px',
                borderRadius: '50%',
                overflow: 'hidden',
                backgroundColor: '#334155',
                flexShrink: 0
              }}>
                <img
                  src={route.tokenIn.image || ''}
                  alt={route.tokenIn.symbol || ''}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    // Fallback if image fails to load
                    const target = e.target as HTMLImageElement;
                    const symbol = route.tokenIn.symbol || "?";
                    target.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" fill="%23334155"/><text x="12" y="16" font-family="Arial" font-size="10" fill="%23f8fafc" text-anchor="middle">${symbol.charAt(0)}</text></svg>`;
                  }}
                />
              </div>

              <span style={{
                fontWeight: 'bold',
                color: '#FFF',
                fontSize: '13px'
              }}>
                {route.tokenIn.symbol || "Starting Token"}
              </span>

              <span style={{
                padding: '0 8px',
                color: '#7DF9FF',
                fontWeight: 'bold'
              }}>→</span>

              {/* Ending token icon */}
              <div style={{
                width: '20px',
                height: '20px',
                marginRight: '6px',
                borderRadius: '50%',
                overflow: 'hidden',
                backgroundColor: '#334155',
                flexShrink: 0
              }}>
                <img
                  src={route.tokenOut.image || ''}
                  alt={route.tokenOut.symbol || ''}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    // Fallback if image fails to load
                    const target = e.target as HTMLImageElement;
                    const symbol = route.tokenOut.symbol || "?";
                    target.src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" fill="%23334155"/><text x="12" y="16" font-family="Arial" font-size="10" fill="%23f8fafc" text-anchor="middle">${symbol.charAt(0)}</text></svg>`;
                  }}
                />
              </div>

              <span style={{
                fontWeight: 'bold',
                color: '#FFF',
                fontSize: '13px'
              }}>
                {route.tokenOut.symbol || "Final Token"}
              </span>

              {/* Show total amount if available */}
              {amount !== undefined && route.tokenIn.decimals !== undefined && (
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '12px',
                  color: '#8C9CA8',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}>
                  {formatTokenAmount(amount, route.tokenIn.decimals || 6)}
                </span>
              )}
            </div>
          )}

          <div>
            {route.hops.map((hop, index) => renderTokenPair(hop, index, route.hops))}
          </div>
        </div>
      ) : (
        <div style={{
          margin: '10px 0',
          padding: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.2)',
          borderRadius: '6px',
          border: '1px solid rgba(125, 249, 255, 0.2)'
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 'bold',
            color: '#FF9500',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            {PermissionIcons.warning}
            <span>SWAP DETAILS UNAVAILABLE</span>
          </div>

          <div style={{
            color: '#8C9CA8',
            fontSize: '11px',
            textAlign: 'center',
            padding: '5px'
          }}>
            Route information could not be loaded. Please review the transaction carefully.
          </div>
        </div>
      )}

      {rememberCheckbox}
    </div>
  );
};

/**
 * Sign Prediction permission content
 */
export const SignPredictionContent: React.FC<PermissionContentProps> = ({ origin, rememberCheckbox }) => (
  <div style={commonStyles.contentContainer}>
    <PermissionLevelIndicator level={PermissionLevel.CRITICAL} />

    <OriginBanner
      origin={origin}
      type={BannerType.CRITICAL}
      message="wants to sign a prediction transaction"
    />

    <div style={commonStyles.explanationContainer}>
      <FeatureExplanation
        icon={PermissionIcons.transfer}
        text="Create a prediction in a market"
      />

      <FeatureExplanation
        icon={PermissionIcons.wallet}
        text="Spend funds to make a prediction"
      />

      <FeatureExplanation
        icon={PermissionIcons.balance}
        text="Receive a prediction NFT as receipt"
      />
    </div>

    {rememberCheckbox}
  </div>
);

/**
 * Claim Rewards permission content
 */
export const ClaimRewardsContent: React.FC<PermissionContentProps> = ({ origin, rememberCheckbox }) => (
  <div style={commonStyles.contentContainer}>
    <PermissionLevelIndicator level={PermissionLevel.SENSITIVE} />

    <OriginBanner
      origin={origin}
      type={BannerType.WARNING}
      message="wants to claim prediction rewards"
    />

    <div style={commonStyles.explanationContainer}>
      <FeatureExplanation
        icon={PermissionIcons.balance}
        text="Claim rewards from winning predictions"
      />

      <FeatureExplanation
        icon={PermissionIcons.wallet}
        text="Recieve reward funds in your wallet"
      />

      <FeatureExplanation
        icon={PermissionIcons.transfer}
        text="Redeem prediction receipt NFT"
      />
    </div>

    {rememberCheckbox}
  </div>
);

/**
 * Default permission content
 */
export const DefaultPermissionContent: React.FC<DefaultPermissionContentProps> = ({ origin, type, rememberCheckbox }) => (
  <div style={commonStyles.contentContainer}>
    <PermissionLevelIndicator level={PermissionLevel.CRITICAL} />

    <OriginBanner
      origin={origin}
      type={BannerType.CRITICAL}
      message="is requesting access to Signet"
    />

    <div style={{ margin: '10px 0', color: '#8C9CA8', fontSize: '11px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={commonStyles.iconContainer}>
          {PermissionIcons.warning}
        </div>
        <span>This website is requesting permission for an operation of type:</span>
      </div>
      <OperationTypeDisplay type={type} />
    </div>

    {rememberCheckbox}
  </div>
);
/**
 * Connect (standard wallet request): share the active address with a site
 */
export const ConnectContent: React.FC<{ origin: string; address: string | null }> = ({ origin, address }) => (
  <div style={commonStyles.contentContainer}>
    <PermissionLevelIndicator level={PermissionLevel.INFO} />

    <OriginBanner
      origin={origin}
      type={BannerType.INFO}
      message="wants to connect to Signet"
    />

    <div style={commonStyles.explanationContainer}>
      <FeatureExplanation
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 21V19A4 4 0 0 0 16 15H8A4 4 0 0 0 4 19V21" stroke="#36C758" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="12" cy="7" r="4" stroke="#36C758" strokeWidth="1.5" />
          </svg>
        }
        text={address ? `Share your address ${address.slice(0, 6)}…${address.slice(-4)}` : 'Share your address'}
      />

      <FeatureExplanation
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 22S20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke="#36C758" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
        text="It can't move funds: every signature asks you first"
      />
    </div>
  </div>
);

/**
 * Sign message (standard wallet request): prove who you are by signing text
 */
export const SignMessageContent: React.FC<{ origin: string; address: string | null; message: string }> = ({ origin, address, message }) => (
  <div style={commonStyles.contentContainer}>
    <PermissionLevelIndicator level={PermissionLevel.SENSITIVE} />

    <OriginBanner
      origin={origin}
      type={BannerType.WARNING}
      message="wants you to sign this message"
    />

    <div
      className="signet-scrollbar"
      style={{
        maxHeight: '140px',
        overflowY: 'auto',
        padding: '8px 10px',
        margin: '10px 0',
        background: 'rgba(125, 249, 255, 0.05)',
        border: '1px solid rgba(125, 249, 255, 0.2)',
        borderRadius: '4px',
        fontSize: '11px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
      }}
    >
      {message}
    </div>

    <div style={commonStyles.explanationContainer}>
      <FeatureExplanation
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 20H21" stroke="#FF9500" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M16.5 3.5A2.1 2.1 0 0 1 19.5 6.5L7 19L3 20L4 16L16.5 3.5Z" stroke="#FF9500" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
        text={address ? `Signs as ${address.slice(0, 6)}…${address.slice(-4)}` : 'Signs with your active account'}
      />

      <FeatureExplanation
        icon={
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 22S20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke="#FF9500" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        }
        text="Signing a message doesn't move funds"
      />
    </div>
  </div>
);
