'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSpin } from '@/contexts/SpinContext';
import PlaceBetModal from '@/components/PlaceBetModal';
import { LeaderboardTable } from '@/components/LeaderboardTable';
import SpinCountdown from '@/components/SpinCountdown';
import BetProgress from '@/components/BetProgress';
import LockOverlay from '@/components/LockOverlay';
import SkeletonLoader from '@/components/SkeletonLoader';
import Confetti from 'react-confetti';
import useWindowSize from '@/hooks/useWindowSize';
import { HandCoins, Trophy, Rocket, TrendingUp, DollarSign } from 'lucide-react';
import Image from 'next/image';
import type { Vote } from '@/types/spin';
import { listTokens } from 'dexterity-sdk';
import type { Token as SwapClientToken } from '@/lib/swap-client';
import type { Token as SpinToken } from '@/types/spin';
import SpinAnimationOverlay from '@/components/SpinAnimationOverlay';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InstructionsButton } from '@/components/InstructionsButton';

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
  const [pageTokens, setPageTokens] = useState<SpinToken[]>([]);
  const [loadingPageTokens, setLoadingPageTokens] = useState(true);
  const [isPlaceBetModalOpen, setIsPlaceBetModalOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const { width, height } = useWindowSize();
  const [hasMounted, setHasMounted] = useState(false);
  const [showSpinAnimation, setShowSpinAnimation] = useState(false);

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
          const mappedTokens: SpinToken[] = result.map((token: SwapClientToken) => ({
            id: token.contractId,
            contractId: token.contractId,
            name: token.name,
            symbol: token.symbol,
            decimals: token.decimals,
            imageUrl: token.image || '/placeholder-token.png',
            userBalance: 0
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

  useEffect(() => {
    if (isSpinComplete) {
      setShowSpinAnimation(true);
    } else {
      setShowSpinAnimation(false);
      setShowConfetti(false);
    }
  }, [isSpinComplete]);

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

  const handlePlaceBetClick = () => {
    if (!isBettingLocked && !isSpinComplete) {
      setIsPlaceBetModalOpen(true);
    }
  };

  const getTokenInfo = useCallback((tokenId: string): SpinToken | undefined => {
    return pageTokens.find((t: SpinToken) => t.id === tokenId);
  }, [pageTokens]);

  const renderTimeLeft = () => {
    if (!spinTime || !hasMounted) return <div className="text-sm h-5">Loading...</div>;
    if (isSpinComplete) {
      const winnerToken = getTokenInfo(feedData.winningTokenId!);
      return <div className="text-center text-lg font-display font-semibold text-pump animate-pulse-slow">Pump Complete! Winner: {winnerToken?.symbol || 'Unknown'}</div>;
    }
    if (isBettingLocked) {
      return <div className="text-center text-sm text-warning font-medium">Commitment Locked! Preparing pump...</div>;
    }
    const minutes = Math.floor(timeLeft / 60000);
    const seconds = Math.floor((timeLeft % 60000) / 1000);
    return (
      <div className="text-center text-sm text-primary font-medium font-display" aria-live="polite">
        Time left to commit: <span className="numeric">{minutes}:{seconds.toString().padStart(2, '0')}</span>
      </div>
    );
  };

  const renderMyBetsSection = () => {
    if (!hasMounted || (isFeedLoading && myBets?.length === 0)) {
      return (
        <>
          <h2 className="text-lg font-semibold font-display mb-4 flex items-center gap-2">
            <HandCoins className="h-5 w-5 text-primary" />
            My Commits
          </h2>
          <SkeletonLoader type="generic" count={2} />
        </>
      );
    }

    if (!myBets || myBets.length === 0) {
      return (
        <>
          <h2 className="text-lg font-semibold font-display mb-4 flex items-center gap-2">
            <HandCoins className="h-5 w-5 text-primary" />
            My Commits
          </h2>
          <div className="glass-card p-8 rounded-xl text-center border">
            <div className="text-muted-foreground/70 mb-3 justify-center flex items-center">
              <HandCoins size={40} />
            </div>
            <p className="text-muted-foreground mb-4">You haven't committed any CHA yet.</p>
            <Button
              onClick={handlePlaceBetClick}
              disabled={isBettingLocked || isSpinComplete}
              variant="outline"
            >
              Make Your First Commitment
            </Button>
          </div>
        </>
      );
    }

    const sortedBets = [...myBets].sort((a, b) => b.voteTime - a.voteTime);

    return (
      <>
        <h2 className="text-lg font-semibold font-display mb-4 flex items-center gap-2">
          <HandCoins className="h-5 w-5 text-primary" />
          My Commits
        </h2>
        <ScrollArea className="h-[220px] pr-3 -mr-3">
          <div className="space-y-3">
            {sortedBets.map((vote: Vote) => {
              const token = getTokenInfo(vote.tokenId);
              const isWinningBet = vote.tokenId === feedData?.winningTokenId;
              const displayVoteAmount = formatAtomicToWholeUnit(vote.voteAmountCHA, CHA_DECIMALS);
              return (
                <div
                  key={vote.id}
                  className={`token-card ${isWinningBet ? 'animate-pulse-glow' : ''}`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {token?.imageUrl && (
                      <div className="relative">
                        <Image
                          src={token.imageUrl}
                          alt={token.symbol || 'Token'}
                          width={40}
                          height={40}
                          className="rounded-full object-cover flex-shrink-0"
                          unoptimized
                        />
                        {isWinningBet && (
                          <div className="absolute -top-1 -right-1 bg-success text-white rounded-full flex items-center justify-center w-5 h-5">
                            <Trophy className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold font-display text-foreground truncate block">{token?.symbol || vote.tokenId}</span>
                      <p className="text-sm text-muted-foreground">
                        Committed: <span className="numeric font-medium text-primary">{displayVoteAmount} CHA</span>
                      </p>
                      <p className="text-xs text-muted-foreground/70">Time: {new Date(vote.voteTime)?.toLocaleString()}</p>
                    </div>
                  </div>
                  {isWinningBet && (
                    <Badge variant="secondary" className="flex-shrink-0 mt-2 sm:mt-0 animate-pulse-medium">WINNING PUMP!</Badge>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </>
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
        {isBettingLocked && !showSpinAnimation && <LockOverlay timeLeft={timeLeft} />}

        {showSpinAnimation && feedData?.winningTokenId && (
          <SpinAnimationOverlay
            winningTokenId={feedData.winningTokenId}
            tokenBets={tokenBets || {}}
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

        <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 ${showSpinAnimation ? 'opacity-0 pointer-events-none' : 'opacity-100'} transition-opacity duration-300`}>
          <div className="md:col-span-1 glass-card p-6">
            <h2 className="text-lg font-semibold mb-4 text-center font-display flex items-center justify-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Next Mass Buy In
            </h2>
            <SpinCountdown
              timeLeft={timeLeft}
              totalTime={5 * 60 * 1000}
              label={isSpinComplete ? "Time until next round" : "Time until mass buy"}
            />
            <div className="text-center text-sm mt-3 h-5 font-medium" aria-live="polite">
              {isSpinComplete ? (
                <span className="text-pump font-display">Pump Complete</span>
              ) : isBettingLocked ? (
                <span className="text-warning font-display">Voting Locked</span>
              ) : (
                <span className="text-primary font-display animate-pulse-medium">Open for Voting</span>
              )}
            </div>
          </div>

          <div className="md:col-span-2 glass-card p-6">
            <h2 className="text-lg font-semibold mb-3 font-display flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Funds Raised for Pump
            </h2>
            <p className="text-3xl font-bold font-display text-primary mb-4 numeric" aria-live="polite">
              {formatAtomicToWholeUnit(totalBetSum, CHA_DECIMALS)} CHA
            </p>
            <BetProgress current={totalBetSum} target={1000000 * (10 ** CHA_DECIMALS)} />

            {!isSpinComplete && !showSpinAnimation && (
              <div className="mt-5">
                <Button
                  size="lg"
                  onClick={handlePlaceBetClick}
                  disabled={isBettingLocked}
                  className={`button-primary w-full py-4 text-lg shadow-lg ${isBettingLocked ? 'opacity-50 cursor-not-allowed' : 'animate-pulse-medium'}`}
                >
                  <Rocket className="h-5 w-5" />
                  {isBettingLocked ? 'Voting Locked' : 'Vote to Pump a Token'}
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className={`glass-card p-6 mb-6 ${showSpinAnimation ? 'opacity-0 pointer-events-none' : 'opacity-100'} transition-opacity duration-300`}>
          <h2 className="text-lg font-semibold mb-4 font-display flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Token Leaderboard
          </h2>
          <LeaderboardTable
            tokens={pageTokens}
            tokenBets={tokenBets || {}}
            isLoading={loadingPageTokens || isFeedLoading}
          />
        </div>

        <div className={`mb-24 sm:mb-8 ${showSpinAnimation ? 'opacity-0 pointer-events-none' : 'opacity-100'} transition-opacity duration-300`}>
          {renderMyBetsSection()}
        </div>

        <PlaceBetModal
          isOpen={isPlaceBetModalOpen}
          onClose={() => setIsPlaceBetModalOpen(false)}
          tokens={pageTokens}
        />
      </>
    );
  };

  return (
    renderContent()
  );
}
