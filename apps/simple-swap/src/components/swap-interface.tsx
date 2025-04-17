"use client";

import { useState, useEffect, useMemo } from "react";
import { swapClient, type Token, type QuoteResponse } from "../lib/swap-client";

// Custom TokenOption component for dropdown
interface TokenOptionProps {
  token: Token;
  onClick: () => void;
  active?: boolean;
}

function TokenOption({ token, onClick, active = false }: TokenOptionProps) {
  // Use the swapClient utility function to get token logos
  const getTokenLogo = (token: Token): string => {
    return swapClient.getTokenLogo(token);
  };

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        cursor: 'pointer',
        backgroundColor: active ? '#f3f4f6' : 'transparent',
        borderRadius: '8px',
        transition: 'all 0.15s ease',
        margin: '4px 0',
      }}
      onMouseOver={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = '#f9fafb';
        }
      }}
      onMouseOut={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
    >
      <img
        src={getTokenLogo(token)}
        alt={token.symbol || "token"}
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "50%",
          marginRight: "12px",
          border: "1px solid #f3f4f6",
          objectFit: "cover",
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <div style={{ fontWeight: 600 }}>{token.symbol}</div>
        <div style={{ fontSize: '12px', color: '#6b7280', maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {token.name || token.contractId}
        </div>
      </div>
    </div>
  );
}

export function SwapInterface() {
  // State
  const [tokens, setTokens] = useState<Token[]>([]);
  const [selectedFromToken, setSelectedFromToken] = useState<Token | null>(null);
  const [selectedToToken, setSelectedToToken] = useState<Token | null>(null);

  // Display amount (human readable) and actual amount (in micro units)
  const [displayAmount, setDisplayAmount] = useState<string>("1"); // Default 1 in human readable format
  const [microAmount, setMicroAmount] = useState<string>("1000000"); // Default 1 in micro units (assuming 6 decimals)

  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [defaultTokensSet, setDefaultTokensSet] = useState(false);

  // Dropdown states
  const [fromDropdownOpen, setFromDropdownOpen] = useState(false);
  const [toDropdownOpen, setToDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Router is configured in the swap client

  // Fetch tokens on mount
  useEffect(() => {
    async function fetchTokens() {
      setIsLoadingTokens(true);
      setError(null);

      try {
        const data = await swapClient.getTokens();
        setTokens(data);
      } catch (err) {
        setError("Failed to load tokens. Please try again later.");
        console.error(err);
      } finally {
        setIsLoadingTokens(false);
      }
    }

    fetchTokens();
  }, []);

  // Set default tokens once tokens are loaded
  useEffect(() => {
    if (tokens.length > 0 && !defaultTokensSet) {
      // Set STX as default "from" token
      const stxToken = tokens.find(t => t.contractId === ".stx");
      if (stxToken) {
        setSelectedFromToken(stxToken);
        // Update microAmount based on default token decimals (1 STX in micro units)
        const microUnits = convertInputToMicroUnits(displayAmount, stxToken.decimals);
        setMicroAmount(microUnits);
      } else if (tokens.length > 0) {
        setSelectedFromToken(tokens[0]);
        // Update microAmount based on first token decimals
        const microUnits = convertInputToMicroUnits(displayAmount, tokens[0].decimals);
        setMicroAmount(microUnits);
      }

      // Set a BTC token as default "to" token if possible
      const btcToken = tokens.find(t =>
        t.symbol?.toLowerCase().includes("btc") ||
        t.symbol?.toLowerCase().includes("bitcoin")
      );

      if (btcToken) {
        setSelectedToToken(btcToken);
      } else if (tokens.length > 1) {
        setSelectedToToken(tokens[1]);
      }

      setDefaultTokensSet(true);
    }
  }, [tokens, defaultTokensSet, displayAmount]);

  // Get quote when inputs change
  useEffect(() => {
    if (selectedFromToken && selectedToToken && microAmount && Number(microAmount) > 0) {
      fetchQuote();
    } else {
      setQuote(null);
    }
  }, [selectedFromToken, selectedToToken, microAmount]);

  // Fetch quote using swapClient
  const fetchQuote = async () => {
    if (!selectedFromToken || !selectedToToken || !microAmount) return;

    // Skip if amount is invalid
    const amountNum = Number(microAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    setIsLoadingQuote(true);
    setError(null);

    try {
      const quoteData = await swapClient.getQuote(
        selectedFromToken.contractId,
        selectedToToken.contractId,
        microAmount
      );

      setQuote(quoteData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get quote");
      console.error(err);
      setQuote(null);
    } finally {
      setIsLoadingQuote(false);
    }
  };

  // Swap the tokens using swapClient
  const handleSwap = async () => {
    if (!quote) return;

    const result = await swapClient.executeSwap(quote.route);
    console.log('Swap result:', result);

    if ('error' in result) {
      setError(result.error);
    }
  };

  // Handle token from/to swap
  const handleSwitchTokens = () => {
    const temp = selectedFromToken;
    setSelectedFromToken(selectedToToken);
    setSelectedToToken(temp);

    // Update the microAmount based on new from token decimals
    if (selectedToToken) {
      const microUnits = convertInputToMicroUnits(displayAmount, selectedToToken.decimals);
      setMicroAmount(microUnits);
    }
  };

  // Format token amount for display - using swapClient utility
  const formatTokenAmount = (amount: number, decimals: number): string => {
    return swapClient.formatTokenAmount(amount, decimals);
  };

  // Convert user input to micro units based on token decimals - using swapClient utility
  const convertInputToMicroUnits = (input: string, decimals: number): string => {
    if (!input || input === '') return '0';
    try {
      return swapClient.convertToMicroUnits(input, decimals);
    } catch (e) {
      return '0';
    }
  };

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Check if click is outside the from-dropdown
      if (fromDropdownOpen && !target.closest('#from-token-container')) {
        setFromDropdownOpen(false);
      }

      // Check if click is outside the to-dropdown
      if (toDropdownOpen && !target.closest('#to-token-container')) {
        setToDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [fromDropdownOpen, toDropdownOpen]);

  // Filter tokens based on search query
  const filteredTokens = useMemo(() => {
    if (!searchQuery) return tokens;

    return tokens.filter(token =>
      token.symbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.contractId.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [tokens, searchQuery]);

  // Use the swapClient utility function to get token logos
  const getTokenLogo = (token: Token): string => {
    return swapClient.getTokenLogo(token);
  };

  return (
    <div
      style={{
        background: `#ffffff`,
        borderRadius: `12px`,
        padding: "1.5rem",
        fontWeight: 500,
        maxWidth: "500px",
        margin: "0 auto",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h2 style={{ margin: 0, fontSize: "24px", fontWeight: "bold" }}>Swap</h2>
        <div>
          {/* Settings icon would go here */}
        </div>
      </div>

      {/* From Token Section */}
      <div style={{
        background: "#f3f4f6",
        padding: "16px",
        borderRadius: "12px",
        marginBottom: "8px"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
          <label style={{ color: "#6b7280", fontSize: "14px" }}>From</label>
          <div style={{ color: "#6b7280", fontSize: "14px" }}>
            {/* Balance would go here */}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <input
            type="text"
            inputMode="decimal"
            value={displayAmount}
            onChange={(e) => {
              const newValue = e.target.value;
              // Only allow numbers and one decimal point
              if (/^[0-9]*\.?[0-9]*$/.test(newValue) || newValue === '') {
                setDisplayAmount(newValue);

                // Convert to micro units for API when token is selected
                if (selectedFromToken) {
                  const microUnits = convertInputToMicroUnits(newValue, selectedFromToken.decimals);
                  setMicroAmount(microUnits);
                }
              }
            }}
            placeholder="0"
            style={{
              fontSize: "20px",
              background: "transparent",
              border: "none",
              outline: "none",
              maxWidth: "60%",
            }}
          />

          <div
            id="from-token-container"
            style={{
              position: "relative",
              minWidth: "180px",
            }}
          >
            {/* Token selector button */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "10px 14px",
                borderRadius: "20px",
                border: "1px solid #e5e7eb",
                background: "#ffffff",
                fontSize: "16px",
                cursor: "pointer",
                position: "relative",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                transition: "all 0.2s ease",
                justifyContent: "space-between",
                width: "100%",
                minWidth: "140px",
                fontWeight: 500,
              }}
              onClick={() => {
                setFromDropdownOpen(!fromDropdownOpen);
                setToDropdownOpen(false);
                setSearchQuery("");
              }}
            >
              <div style={{ display: "flex", alignItems: "center" }}>
                {selectedFromToken ? (
                  <>
                    <img
                      src={getTokenLogo(selectedFromToken)}
                      alt={selectedFromToken.symbol || "token"}
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        marginRight: "10px",
                        border: "1px solid #f3f4f6",
                      }}
                    />
                    <span>{selectedFromToken.symbol}</span>
                  </>
                ) : (
                  <span>Select token</span>
                )}
              </div>
              <div
                style={{
                  marginLeft: "8px",
                  color: "#6b7280",
                  fontSize: "12px",
                  background: "#f9fafb",
                  width: "18px",
                  height: "18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                  transform: fromDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s ease",
                }}
              >
                ▼
              </div>
            </div>

            {/* Custom dropdown menu */}
            {fromDropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  left: 0,
                  width: "300px",
                  backgroundColor: "white",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                  borderRadius: "12px",
                  zIndex: 50,
                  maxHeight: "350px",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Search bar */}
                <div style={{ padding: "16px 16px 8px 16px", borderBottom: "1px solid #f3f4f6" }}>
                  <div style={{
                    position: "relative",
                    width: "100%",
                  }}>
                    <input
                      type="text"
                      placeholder="Search by name or address"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px 10px 36px",
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                        fontSize: "14px",
                        outline: "none",
                      }}
                    />
                    <div style={{
                      position: "absolute",
                      top: "50%",
                      left: "12px",
                      transform: "translateY(-50%)",
                      color: "#9ca3af"
                    }}>
                      🔍
                    </div>
                  </div>
                </div>

                {/* Token list */}
                <div style={{
                  overflowY: "auto",
                  maxHeight: "280px",
                  padding: "8px",
                }}>
                  {isLoadingTokens ? (
                    <div style={{ padding: "16px", textAlign: "center", color: "#6b7280" }}>
                      Loading tokens...
                    </div>
                  ) : filteredTokens.length === 0 ? (
                    <div style={{ padding: "16px", textAlign: "center", color: "#6b7280" }}>
                      No tokens found
                    </div>
                  ) : (
                    filteredTokens.map(token => (
                      <TokenOption
                        key={token.contractId}
                        token={token}
                        active={selectedFromToken?.contractId === token.contractId}
                        onClick={() => {
                          setSelectedFromToken(token);
                          setFromDropdownOpen(false);

                          // Update the microAmount based on new token decimals
                          const microUnits = convertInputToMicroUnits(displayAmount, token.decimals);
                          setMicroAmount(microUnits);
                        }}
                      />
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Swap Direction Button */}
      <div style={{ textAlign: "center", margin: "8px 0" }}>
        <button
          onClick={handleSwitchTokens}
          style={{
            background: "#ffffff",
            border: "4px solid #f3f4f6",
            borderRadius: "50%",
            width: "40px",
            height: "40px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 2px 5px rgba(0, 0, 0, 0.08)",
            color: "#3b82f6",
            fontSize: "18px",
            fontWeight: "bold",
            transition: "all 0.2s ease",
            position: "relative",
            zIndex: 5,
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = "scale(1.05)";
            e.currentTarget.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 2px 5px rgba(0, 0, 0, 0.08)";
          }}
        >
          ⇅
        </button>
      </div>

      {/* To Token Section */}
      <div style={{
        background: "#f3f4f6",
        padding: "16px",
        borderRadius: "12px",
        marginBottom: "24px"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
          <label style={{ color: "#6b7280", fontSize: "14px" }}>To</label>
          <div style={{ color: "#6b7280", fontSize: "14px" }}>
            {/* Balance would go here */}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "20px", maxWidth: "60%" }}>
            {isLoadingQuote ? (
              <span style={{ color: "#6b7280" }}>Loading...</span>
            ) : quote ? (
              formatTokenAmount(quote.amountOut, selectedToToken?.decimals || 0)
            ) : (
              "0"
            )}
          </div>

          <div
            id="to-token-container"
            style={{
              position: "relative",
              minWidth: "180px",
            }}
          >
            {/* Token selector button */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "10px 14px",
                borderRadius: "20px",
                border: "1px solid #e5e7eb",
                background: "#ffffff",
                fontSize: "16px",
                cursor: "pointer",
                position: "relative",
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                transition: "all 0.2s ease",
                justifyContent: "space-between",
                width: "100%",
                minWidth: "140px",
                fontWeight: 500,
              }}
              onClick={() => {
                setToDropdownOpen(!toDropdownOpen);
                setFromDropdownOpen(false);
                setSearchQuery("");
              }}
            >
              <div style={{ display: "flex", alignItems: "center" }}>
                {selectedToToken ? (
                  <>
                    <img
                      src={getTokenLogo(selectedToToken)}
                      alt={selectedToToken.symbol || "token"}
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        marginRight: "10px",
                        border: "1px solid #f3f4f6",
                      }}
                    />
                    <span>{selectedToToken.symbol}</span>
                  </>
                ) : (
                  <span>Select token</span>
                )}
              </div>
              <div
                style={{
                  marginLeft: "8px",
                  color: "#6b7280",
                  fontSize: "12px",
                  background: "#f9fafb",
                  width: "18px",
                  height: "18px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "50%",
                  transform: toDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s ease",
                }}
              >
                ▼
              </div>
            </div>

            {/* Custom dropdown menu */}
            {toDropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  left: 0,
                  width: "300px",
                  backgroundColor: "white",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                  borderRadius: "12px",
                  zIndex: 50,
                  maxHeight: "350px",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Search bar */}
                <div style={{ padding: "16px 16px 8px 16px", borderBottom: "1px solid #f3f4f6" }}>
                  <div style={{
                    position: "relative",
                    width: "100%",
                  }}>
                    <input
                      type="text"
                      placeholder="Search by name or address"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px 10px 36px",
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                        fontSize: "14px",
                        outline: "none",
                      }}
                    />
                    <div style={{
                      position: "absolute",
                      top: "50%",
                      left: "12px",
                      transform: "translateY(-50%)",
                      color: "#9ca3af"
                    }}>
                      🔍
                    </div>
                  </div>
                </div>

                {/* Token list */}
                <div style={{
                  overflowY: "auto",
                  maxHeight: "280px",
                  padding: "8px",
                }}>
                  {isLoadingTokens ? (
                    <div style={{ padding: "16px", textAlign: "center", color: "#6b7280" }}>
                      Loading tokens...
                    </div>
                  ) : filteredTokens.length === 0 ? (
                    <div style={{ padding: "16px", textAlign: "center", color: "#6b7280" }}>
                      No tokens found
                    </div>
                  ) : (
                    filteredTokens.map(token => (
                      <TokenOption
                        key={token.contractId}
                        token={token}
                        active={selectedToToken?.contractId === token.contractId}
                        onClick={() => {
                          setSelectedToToken(token);
                          setToDropdownOpen(false);
                        }}
                      />
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quote Details */}
      {quote && !isLoadingQuote && (
        <div style={{
          padding: "16px",
          backgroundColor: "#f9fafb",
          borderRadius: "8px",
          marginBottom: "24px",
          fontSize: "14px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span>Rate</span>
            <span>
              1 {selectedFromToken?.symbol} = {quote.expectedPrice.toFixed(6)} {selectedToToken?.symbol}
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span>Minimum received</span>
            <span>
              {formatTokenAmount(quote.minimumReceived, selectedToToken?.decimals || 0)} {selectedToToken?.symbol}
            </span>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
            <span>Route</span>
            <div style={{ display: "flex", alignItems: "center" }}>
              {quote.route.path.map((token, index) => (
                <div key={token.contractId} style={{ display: "flex", alignItems: "center" }}>
                  {index > 0 && <span style={{ margin: "0 4px" }}>→</span>}
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <img
                      src={getTokenLogo(token)}
                      alt={token.symbol || "token"}
                      style={{
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        marginRight: "4px",
                      }}
                    />
                    <span>{token.symbol}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div style={{
          padding: "12px",
          backgroundColor: "#fee2e2",
          color: "#b91c1c",
          borderRadius: "8px",
          marginBottom: "24px",
          fontSize: "14px",
        }}>
          {error}
        </div>
      )}

      {/* Swap Button */}
      <button
        onClick={handleSwap}
        disabled={!quote || isLoadingQuote}
        style={{
          width: "100%",
          padding: "16px",
          backgroundColor: !quote || isLoadingQuote ? "#9ca3af" : "#3b82f6",
          color: "white",
          borderRadius: "12px",
          border: "none",
          fontSize: "16px",
          fontWeight: "600",
          cursor: !quote || isLoadingQuote ? "not-allowed" : "pointer",
          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
          transition: "all 0.2s ease",
          position: "relative",
          overflow: "hidden",
        }}
        onMouseOver={(e) => {
          if (!(!quote || isLoadingQuote)) {
            e.currentTarget.style.backgroundColor = "#2563eb";
            e.currentTarget.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.15)";
          }
        }}
        onMouseOut={(e) => {
          if (!(!quote || isLoadingQuote)) {
            e.currentTarget.style.backgroundColor = "#3b82f6";
            e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 0, 0, 0.1)";
          }
        }}
      >
        {isLoadingQuote ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ marginRight: "8px" }}>Loading Quote</span>
            <span className="loading-dots">...</span>
          </div>
        ) : !selectedFromToken || !selectedToToken ? (
          "Select tokens"
        ) : (
          "Swap Tokens"
        )}
      </button>

      {/* Attribution */}
      <div style={{
        marginTop: "16px",
        textAlign: "center",
        fontSize: "12px",
        color: "#9ca3af"
      }}>
        Powered by Charisma
      </div>
    </div>
  );
}
