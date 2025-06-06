'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSpin } from '@/contexts/SpinContext';
import VoteModal from '@/components/VoteModal';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import SpinCountdown from '@/components/SpinCountdown';
import BetProgress from '@/components/BetProgress';
import LockOverlay from '@/components/LockOverlay';
import SkeletonLoader from '@/components/SkeletonLoader';
import Confetti from 'react-confetti';
import useWindowSize from '@/hooks/useWindowSize';
import { useTokenPrices } from '@/hooks/useTokenPrices';
import TokenAmountDisplay from '@/components/TokenAmountDisplay';
import { HandCoins, Trophy, Rocket, TrendingUp, DollarSign } from 'lucide-react';
import Image from 'next/image';
import type { Vote } from '@/types/spin';
import { listTokens } from 'dexterity-sdk';
import type { Token as SpinToken } from '@/types/spin';
import SpinAnimationOverlay from '@/components/SpinAnimationOverlay';
import SpinValidationDisplay from '@/components/SpinValidationDisplay';
import SpinReadyDisplay from '@/components/SpinReadyDisplay';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InstructionsButton } from '@/components/InstructionsButton';
import { useWallet } from '@/contexts/wallet-context';
import { TwitterShareButton } from '@/components/ui/TwitterShareButton';

// Define CHA decimals (ideally, get this from token data if CHA is in pageTokens)
const CHA_DECIMALS = 6;

// Helper function to format atomic amounts
const formatAtomicToWholeUnit = (atomicAmount: number | undefined | null, decimals: number): string => {
  if (atomicAmount === undefined || atomicAmount === null || isNaN(atomicAmount) || isNaN(decimals)) {
    return '0.00'; // Or some other placeholder
  }
  const wholeUnitAmount = atomicAmount / (10 ** decimals);
  // Adjust toFixed as needed, e.g., toFixed(2) for typical currency display, or more for tokens
  return wholeUnitAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
};

export default function HubPage() {
  const {
    state: {
      feedData,
      isFeedLoading,
      tokenBets,
      myBets
    }
  } = useSpin();

  // Add token price hook
  const { chaPrice, isLoading: isPriceLoading } = useTokenPrices();

  const [pageTokens, setPageTokens] = useState<SpinToken[]>([]);
  const [loadingPageTokens, setLoadingPageTokens] = useState(true);
  const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const { width, height } = useWindowSize();
  const [hasMounted, setHasMounted] = useState(false);
  const [showSpinAnimation, setShowSpinAnimation] = useState(false);

  // Multi-stage spin state
  const [currentSpinPhase, setCurrentSpinPhase] = useState<'idle' | 'starting' | 'validating' | 'ready' | 'spinning' | 'complete'>('idle');
  const [validationResults, setValidationResults] = useState<any>(null);
  const [showReadyDisplay, setShowReadyDisplay] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    async function loadPageTokens() {
      console.log("[HubPage] Fetching token list...");
      setLoadingPageTokens(true);
      try {
        const result = await listTokens();
        if (result) {
          const mappedTokens: SpinToken[] = result.map((token: any) => ({
            id: token.contractId,
            contractId: token.contractId,
            name: token.name,
            symbol: token.symbol,
            decimals: token.decimals,
            imageUrl: token.image || '/placeholder-token.png',
            userBalance: 0,
            type: token.type,
            base: token.base
          }));
          setPageTokens(mappedTokens);
          console.log(`[HubPage] Stored ${mappedTokens.length} tokens.`);
        } else {
          console.error("[HubPage] Failed to list tokens:", result);
          setPageTokens([]);
        }
      } catch (err) {
        console.error("[HubPage] Error calling listTokens action:", err);
        setPageTokens([]);
      } finally {
        setLoadingPageTokens(false);
      }
    }
    loadPageTokens();
  }, []);

  const spinTime = feedData?.endTime || 0;
  const lockDuration = feedData?.lockDuration || 5 * 60 * 1000; // Use the dynamic value or default to 5 minutes
  const isBettingLocked = hasMounted && timeLeft > 0 && timeLeft <= lockDuration && !feedData?.winningTokenId;
  const isSpinComplete = hasMounted && !!feedData?.winningTokenId;
  const isSpinActive = hasMounted && isBettingLocked && !isSpinComplete;
  const spinDuration = feedData?.roundDuration || 5 * 60 * 1000; // Default to 5 minutes if not provided

  const totalBetSum = useMemo(() => {
    // tokenBets stores amounts in atomic units
    return Object.values(tokenBets || {}).reduce((sum, amount) => sum + amount, 0);
  }, [tokenBets]);

  // Handle multi-stage spin phases based on feed data
  useEffect(() => {
    if (!hasMounted || !feedData) return;

    // Handle different spin phases from feed data
    if (feedData.type === 'spin_starting') {
      setCurrentSpinPhase('starting');
      setShowSpinAnimation(false);
      setShowConfetti(false);
    } else if (feedData.type === 'validation_complete' && feedData.validationResults) {
      setCurrentSpinPhase('ready');
      setValidationResults(feedData.validationResults);
      setShowReadyDisplay(false);
    } else if (feedData.spinPhase === 'spinning') {
      setCurrentSpinPhase('spinning');
    } else if (feedData.winningTokenId && feedData.spinPhase === 'complete') {
      setCurrentSpinPhase('complete');
      setShowSpinAnimation(true);
    } else if (!feedData.winningTokenId) {
      setCurrentSpinPhase('idle');
      setShowSpinAnimation(false);
      setShowConfetti(false);
      setValidationResults(null);
      setShowReadyDisplay(false);
    }
  }, [hasMounted, feedData]);

  // Auto-transition from validation to ready display
  useEffect(() => {
    if (currentSpinPhase === 'ready' && validationResults && !showReadyDisplay) {
      const transitionTimer = setTimeout(() => {
        setShowReadyDisplay(true);
      }, 4000);

      return () => clearTimeout(transitionTimer);
    }
  }, [currentSpinPhase, validationResults, showReadyDisplay]);

  const handleAnimationComplete = () => {
    console.log("Spin animation complete!");
    setShowSpinAnimation(false);
    setShowConfetti(true);
    const timer = setTimeout(() => setShowConfetti(false), 15000);
  };

  useEffect(() => {
    if (!spinTime) return;
    const calculateRemaining = () => Math.max(0, spinTime - Date.now());
    setTimeLeft(calculateRemaining());
    const interval = setInterval(() => {
      setTimeLeft(calculateRemaining());
    }, 1000);
    return () => clearInterval(interval);
  }, [spinTime]);

  const handleVoteClick = () => {
    if (!isBettingLocked && !isSpinComplete) {
      setIsVoteModalOpen(true);
    }
  };

  const getTokenInfo = useCallback((tokenId: string): SpinToken | undefined => {
    return pageTokens.find((t: SpinToken) => t.id === tokenId);
  }, [pageTokens]);

  const renderMyBetsSection = () => {
    if (!hasMounted || (isFeedLoading && myBets?.length === 0)) {
      return (
        <div className="bg-background/40 md:glass-card px-4 py-6 md:p-6 border-b border-border/20 md:border md:rounded-xl">
          <h2 className="text-base sm:text-lg font-semibold font-display mb-3 sm:mb-4 flex items-center gap-2">
            <HandCoins className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            My Votes
          </h2>
          <SkeletonLoader type="generic" count={2} />
        </div>
      );
    }

    if (!myBets || myBets.length === 0) {
      return (
        <div className="bg-background/40 md:glass-card px-4 py-6 md:p-6 border-b border-border/20 md:border md:rounded-xl">
          <h2 className="text-base sm:text-lg font-semibold font-display mb-3 sm:mb-4 flex items-center gap-2">
            <HandCoins className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            My Votes
          </h2>
          <div className="bg-muted/10 border border-border/20 p-6 sm:p-8 rounded-xl text-center">
            <div className="text-muted-foreground/70 mb-3 justify-center flex items-center">
              <HandCoins size={40} />
            </div>
            <p className="text-muted-foreground mb-4">You haven't committed any CHA yet.</p>
            <Button
              onClick={handleVoteClick}
              disabled={isBettingLocked || isSpinComplete}
              variant="outline"
            >
              🚀 Vote for Your Favorite!
            </Button>
          </div>
        </div>
      );
    }

    const sortedBets = [...myBets].sort((a, b) => b.voteTime - a.voteTime);

    return (
      <div className="bg-background/40 md:glass-card px-4 py-6 md:p-6 border-b border-border/20 md:border md:rounded-xl">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <h2 className="text-base sm:text-lg font-semibold font-display flex items-center gap-2">
            <HandCoins className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            My Votes
          </h2>
          {myBets && myBets.length > 0 && (
            <TwitterShareButton
              message={`Currently have ${myBets.length} vote${myBets.length > 1 ? 's' : ''} in this Meme Roulette round! 🎰 Waiting for the spin...`}
              size="sm"
              variant="ghost"
              className="opacity-60 hover:opacity-100"
              showIcon={false}
            />
          )}
        </div>
        <ScrollArea className="h-[220px] sm:h-[280px] lg:h-[320px] pr-3 -mr-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            {sortedBets.map((vote: Vote) => {
              const token = getTokenInfo(vote.tokenId);
              const isWinningBet = vote.tokenId === feedData?.winningTokenId;
              return (
                <div
                  key={vote.id}
                  className={`
                    bg-card/50 border border-border/20 rounded-lg p-3 sm:p-4 
                    hover:bg-card/70 transition-all duration-200
                    ${isWinningBet ? 'bg-primary/5 border-primary/20 animate-pulse-glow' : ''}
                  `}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {token?.imageUrl && (
                      <div className="relative flex-shrink-0">
                        <Image
                          src={token.imageUrl}
                          alt={token.symbol || 'Token'}
                          width={32}
                          height={32}
                          className={`
                            rounded-full object-cover bg-muted 
                            ${isWinningBet ? 'ring-2 ring-primary/30' : ''}
                          `}
                          unoptimized
                        />
                        {isWinningBet && (
                          <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full flex items-center justify-center w-4 h-4">
                            <Trophy className="h-2.5 w-2.5" />
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold font-display text-foreground truncate text-sm">
                          {token?.symbol || vote.tokenId}
                        </span>
                        {isWinningBet && (
                          <Badge variant="secondary" className="flex-shrink-0 text-xs animate-pulse-medium">
                            WIN
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">
                        <TokenAmountDisplay
                          amount={vote.voteAmountCHA}
                          decimals={CHA_DECIMALS}
                          symbol="CHA"
                          usdPrice={chaPrice}
                          className="font-medium text-primary"
                          size="sm"
                          showUsdInTooltip={true}
                        />
                      </p>
                      <p className="text-xs text-muted-foreground/70 truncate">
                        {new Date(vote.voteTime)?.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    );
  };

  // Function to manually refresh the page
  const handleRefresh = () => {
    window.location.reload();
  };

  // Render content based on current state
  const renderContent = () => {
    if (!hasMounted || (isFeedLoading && !feedData)) {
      return <SkeletonLoader type="hub" />;
    }

    // Show placeholder when feed is disconnected
    if (!feedData || !feedData.tokenVotes) {
      return (
        <div className="flex flex-col items-center justify-center p-4 text-center h-full">
          <h2 className="text-xl font-bold mb-2">Connection Lost</h2>
          <p className="mb-4">We've lost connection to the feed. Please check your internet connection.</p>
          <Button onClick={handleRefresh}>Refresh</Button>
        </div>
      );
    }

    // No votes in the current round
    const hasAnyVotes = Object.values(tokenBets || {}).some(amount => amount > 0);
    const isSpinOver = feedData.endTime && new Date(feedData.endTime) < new Date();
    if (!hasAnyVotes && !isSpinActive && isSpinOver) {
      // Calculate time until next round
      const nextRoundTime = feedData.endTime ? feedData.endTime + 60000 : Date.now() + 60000; // 1 minute for empty rounds
      const timeUntilNextRound = Math.max(0, nextRoundTime - Date.now());

      return (
        <div className="flex flex-col items-center justify-center p-4 text-center h-full">
          <h2 className="text-xl font-bold mb-2">No Tokens Were Pumped</h2>
          <p className="mb-4">No one voted in this round. Get ready for the next round!</p>
          <div className="mb-4">
            <SpinCountdown
              timeLeft={timeUntilNextRound}
              totalTime={60000} // 1 minute totalTime
              label="Time until next round"
            />
          </div>
          <Button onClick={handleRefresh}>Refresh</Button>
        </div>
      );
    }

    // If the feed is done loading, render the main content
    return (
      <>
        {isBettingLocked && currentSpinPhase === 'idle' && <LockOverlay timeLeft={timeLeft} />}

        {/* Multi-Stage Spin Displays */}
        {currentSpinPhase === 'starting' && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center z-[60] p-4">
            <div className="bg-card/95 backdrop-blur-lg border border-border rounded-xl p-8 max-w-md w-full text-center">
              <h2 className="text-2xl font-bold font-display mb-4 text-primary">
                🎰 Spin Starting!
              </h2>
              <p className="text-muted-foreground mb-6">
                Validating user balances and preparing for the spin...
              </p>
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span className="text-primary font-semibold">Processing...</span>
              </div>
            </div>
          </div>
        )}

        {currentSpinPhase === 'ready' && validationResults && !showReadyDisplay && (
          <SpinValidationDisplay
            validationResults={validationResults}
            chaPrice={chaPrice}
            onContinue={() => setShowReadyDisplay(true)}
          />
        )}

        {currentSpinPhase === 'ready' && validationResults && showReadyDisplay && (
          <SpinReadyDisplay
            validationResults={validationResults}
            tokens={pageTokens}
            chaPrice={chaPrice}
          />
        )}

        {currentSpinPhase === 'spinning' && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center z-[60] p-4">
            <div className="bg-card/95 backdrop-blur-lg border border-border rounded-xl p-8 max-w-md w-full text-center">
              <h2 className="text-2xl font-bold font-display mb-4 text-primary">
                🎲 Spinning...
              </h2>
              <p className="text-muted-foreground mb-6">
                Determining the winner based on validated votes
              </p>
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="text-primary font-semibold">Selecting Winner...</span>
              </div>
            </div>
          </div>
        )}

        {showSpinAnimation && feedData?.winningTokenId && currentSpinPhase === 'complete' && (
          <SpinAnimationOverlay
            winningTokenId={feedData.winningTokenId}
            tokenBets={validationResults?.validTokenBets || tokenBets || {}}
            tokenList={pageTokens}
            onAnimationComplete={handleAnimationComplete}
            spinScheduledAt={feedData?.endTime || Date.now()}
          />
        )}

        {showConfetti && width > 0 && height > 0 && (
          <Confetti
            width={width}
            height={height}
            recycle={false}
            numberOfPieces={500}
            tweenDuration={10000}
            className="!fixed !z-[70]"
          />
        )}

        <div className={`flex flex-col gap-0 md:gap-6 mb-0 md:mb-8 ${currentSpinPhase !== 'idle' ? 'opacity-0 pointer-events-none' : 'opacity-100'} transition-opacity duration-300`}>
          {/* Combined Status Section - Full width, better balanced layout */}
          <div className="bg-background/50 md:glass-card px-4 py-6 md:p-6 border-b border-border/20 md:border md:rounded-xl">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Countdown Section */}
              <div className="lg:col-span-2">
                <h2 className="text-base sm:text-lg font-semibold mb-4 font-display flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  Next Mass Buy In
                </h2>
                <SpinCountdown
                  timeLeft={timeLeft}
                  totalTime={spinDuration}
                  label={isSpinComplete ? "Time until next round" : "Time until mass buy"}
                />
              </div>

              {/* Enhanced Funds Raised Section */}
              <div className="lg:col-span-1 flex flex-col justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold mb-3 font-display flex items-center gap-2">
                    <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    Funds Raised
                  </h2>

                  {/* Current Amount */}
                  <div className="text-center lg:text-left mb-4">
                    <div className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display text-primary mb-1 numeric" aria-live="polite">
                      <TokenAmountDisplay
                        amount={totalBetSum}
                        decimals={CHA_DECIMALS}
                        symbol="CHA"
                        usdPrice={chaPrice}
                        className="text-primary"
                        size="lg"
                        showUsd={true}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">Committed this round</p>
                  </div>

                  {/* Quick Stats */}
                  <div className="space-y-2 mb-4 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">ATH:</span>
                      {(feedData?.athTotalAmount || 0) > 0 ? (
                        <TokenAmountDisplay
                          amount={feedData?.athTotalAmount || 0}
                          decimals={CHA_DECIMALS}
                          symbol="CHA"
                          usdPrice={chaPrice}
                          className="font-bold"
                          size="sm"
                          showUsdInTooltip={true}
                        />
                      ) : (
                        <span className="font-bold text-muted-foreground/60">No data</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Last Round:</span>
                      {(feedData?.previousRoundAmount || 0) > 0 ? (
                        <TokenAmountDisplay
                          amount={feedData?.previousRoundAmount || 0}
                          decimals={CHA_DECIMALS}
                          symbol="CHA"
                          usdPrice={chaPrice}
                          className="font-bold"
                          size="sm"
                          showUsdInTooltip={true}
                        />
                      ) : (
                        <span className="font-bold text-muted-foreground/60">No data</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress Section */}
                <div>
                  <BetProgress
                    current={totalBetSum}
                    athAmount={feedData?.athTotalAmount || 0}
                    previousRoundAmount={feedData?.previousRoundAmount || 0}
                    decimals={CHA_DECIMALS}
                    usdPrice={chaPrice}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Section */}
        {currentSpinPhase === 'idle' && (
          <div className="bg-background/40 md:glass-card px-4 py-6 md:p-6 border-b border-border/20 md:border md:rounded-xl mb-0 md:mb-8">
            <div className="max-w-md mx-auto">
              <Button
                size="lg"
                onClick={handleVoteClick}
                disabled={isBettingLocked}
                className={`button-primary w-full py-4 text-base sm:text-lg shadow-lg ${isBettingLocked ? 'opacity-50 cursor-not-allowed' : 'animate-pulse-medium'}`}
              >
                <Rocket className="h-5 w-5" />
                {isBettingLocked ? 'Voting Locked' : 'Vote for Your Favorite Meme!'}
              </Button>
            </div>
          </div>
        )}

        {/* Leaderboard Section */}
        <div className={`bg-background/40 md:glass-card px-4 py-6 md:p-6 border-b border-border/20 md:border md:rounded-xl md:mb-6 ${currentSpinPhase !== 'idle' ? 'opacity-0 pointer-events-none' : 'opacity-100'} transition-opacity duration-300`}>
          <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 font-display flex items-center gap-2">
            <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            Token Leaderboard
          </h2>
          <LeaderboardTable
            tokens={pageTokens}
            tokenBets={tokenBets || {}}
            isLoading={loadingPageTokens || isFeedLoading}
            chaPrice={chaPrice}
          />
        </div>

        {/* My Votes Section */}
        <div className={`mb-20 sm:mb-8 ${currentSpinPhase !== 'idle' ? 'opacity-0 pointer-events-none' : 'opacity-100'} transition-opacity duration-300`}>
          {renderMyBetsSection()}
        </div>

        <VoteModal
          isOpen={isVoteModalOpen}
          onClose={() => setIsVoteModalOpen(false)}
          tokens={pageTokens}
        />
      </>
    );
  };

  return (
    renderContent()
  );
}
