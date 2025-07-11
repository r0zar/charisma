import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import type { Token } from '@/types/spin';
import { useSpring, config } from 'react-spring';
import { TrendingUp, Rocket } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogHeader } from "@/components/ui/dialog";

interface SpinAnimationOverlayProps {
    winningTokenId: string;
    tokenBets: Record<string, number>; // Used to determine which tokens to show/potentially weight
    tokenList: Token[]; // Full list to get token details
    onAnimationComplete: () => void;
    spinScheduledAt: number; // Add timestamp for reset calculation
}

// Simple hashing function for deterministic randomness based on winner ID
const simpleHash = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
};

// Use React.memo to prevent unnecessary re-renders from parent component
const SpinAnimationOverlay = React.memo(({
    winningTokenId,
    tokenBets,
    tokenList,
    onAnimationComplete,
    spinScheduledAt
}: SpinAnimationOverlayProps) => {
    // Use refs for values that should persist across re-renders
    const isInitializedRef = useRef(false);
    const [isClient, setIsClient] = useState(false);
    const [resetTimeLeft, setResetTimeLeft] = useState<number | null>(null);
    const resetIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [hasLanded, setHasLanded] = useState(false);
    const animationCompleteCalledRef = useRef(false);
    const [spotlightIndex, setSpotlightIndex] = useState<number | null>(null);
    const spotlightIndexRef = useRef<number | null>(null);
    const animationTimerRef = useRef<NodeJS.Timeout | null>(null);
    const totalStepsRef = useRef(0);
    const currentStepRef = useRef(0);
    const startTimeRef = useRef(0);
    const endTimeRef = useRef(0);
    const isAnimatingRef = useRef(false);
    const tokenCardsRef = useRef<Array<any>>([]);
    const finalWinnerIndexRef = useRef<number | null>(null);
    const [showResultDialog, setShowResultDialog] = useState(false);

    // Generate token cards once on client-side only
    const generateTokenCards = useCallback(() => {
        if (!isClient || tokenCardsRef.current.length > 0) return;

        // Validate inputs for debugging
        const winnerToken = tokenList.find(t => t.id === winningTokenId);
        console.log(`SpinAnimation: Generating cards with winningTokenId=${winningTokenId} (${winnerToken?.symbol || 'unknown'})`);
        console.log(`SpinAnimation: Available tokens:`, tokenList.map(t => ({ id: t.id, symbol: t.symbol })));
        console.log(`SpinAnimation: Token bets:`, tokenBets);

        // Check if winner has bets
        const winnerBetAmount = tokenBets[winningTokenId] || 0;
        if (winnerBetAmount === 0) {
            console.warn(`SpinAnimation: WARNING - Winning token ${winningTokenId} (${winnerToken?.symbol}) has 0 bets! This might indicate a selection algorithm issue.`);
        }

        // Validate that the winning token actually exists in the token list
        const winnerExists = tokenList.some(token => token.id === winningTokenId);
        if (!winnerExists) {
            console.error(`SpinAnimation: WARNING - Winning token ${winningTokenId} not found in token list! This will cause UI issues.`);
        }

        // List all tokens with non-zero bets for debugging
        const tokensWithActualBets = Object.entries(tokenBets)
            .filter(([id, amount]) => amount > 0)
            .map(([id, amount]) => {
                const token = tokenList.find(t => t.id === id);
                return `${token?.symbol || id}: ${amount}`;
            });
        console.log(`SpinAnimation: Tokens with actual bets: ${tokensWithActualBets.join(', ')}`);

        // Only consider tokens that actually exist in the tokenList
        const validTokenIds = new Set(tokenList.map(token => token.id));

        // Filter to only include tokens that exist in the token list
        const idsWithBets = Object.keys(tokenBets)
            .filter(id => tokenBets[id] > 0 && validTokenIds.has(id));

        // Ensure winner is included if it exists in token list
        if (winningTokenId && winnerExists && !idsWithBets.includes(winningTokenId)) {
            idsWithBets.push(winningTokenId);
        }

        console.log(`SpinAnimation: Valid tokens with bets: ${idsWithBets.length}`,
            idsWithBets.map(id => {
                const token = tokenList.find(t => t.id === id);
                return `${token?.symbol || id}(${tokenBets[id] || 0})`;
            })
        );

        // Calculate total bets to determine proportions
        const totalBets = idsWithBets.reduce((sum, id) => sum + (tokenBets[id] || 0), 0);

        // Grid factors: Numbers that make even grids on various screen sizes
        const gridFactors = [4, 5, 6];

        // Create a base number of cards that's proportional to available tokens
        const initialTargetCount = Math.min(60, Math.max(20, idsWithBets.length * 3));

        // Round to nearest multiple of a grid factor to ensure even grid
        let bestFactor = gridFactors[0];
        let minRemainder = initialTargetCount % bestFactor;

        // Find the grid factor that gives the most even distribution
        for (const factor of gridFactors) {
            const remainder = initialTargetCount % factor;
            if (remainder < minRemainder || (remainder === minRemainder && factor > bestFactor)) {
                minRemainder = remainder;
                bestFactor = factor;
            }
        }

        // Adjust target count to be divisible by the best grid factor
        const targetCardCount = initialTargetCount + (bestFactor - minRemainder) % bestFactor;

        console.log(`SpinAnimation: Using grid factor ${bestFactor}, adjusted card count from ${initialTargetCount} to ${targetCardCount}`);

        // Create proportional cards
        const cards: Array<{
            id: string;
            token: Token;
            betAmount: number;
            isWinner: boolean;
            uniqueKey: string;
        }> = [];

        idsWithBets.forEach(id => {
            const token = tokenList.find(t => t.id === id);

            // Skip invalid tokens (this is a safety check that shouldn't be needed)
            if (!token) {
                console.error(`SpinAnimation: Token ${id} not found in token list despite validation!`);
                return;
            }

            const betAmount = tokenBets[id] || 0;
            const isWinner = id === winningTokenId;

            // Calculate proportion of this token (min 1 card, scaled by bet proportion)
            let cardCount = 1; // Minimum one card
            if (totalBets > 0) {
                // Add proportional cards based on bet amount
                const proportion = betAmount / totalBets;
                const additionalCards = Math.round(proportion * (targetCardCount - idsWithBets.length));
                cardCount += additionalCards;
            }

            // Special case: ensure winner has at least one card
            if (isWinner && cardCount < 1) cardCount = 1;

            // Create the cards
            for (let i = 0; i < cardCount; i++) {
                cards.push({
                    id,
                    token,
                    betAmount,
                    isWinner,
                    uniqueKey: `${id}-${i}`
                });
            }
        });

        // Log card generation results
        console.log(`SpinAnimation: Generated ${cards.length} cards for ${idsWithBets.length} tokens`);

        // If the final number of cards isn't divisible by our grid factor, add some extra winner cards
        const remainder = cards.length % bestFactor;
        if (remainder !== 0) {
            const extraNeeded = bestFactor - remainder;
            console.log(`SpinAnimation: Adding ${extraNeeded} extra winner cards to even out the grid`);

            // Find a winner token to duplicate
            const winnerToken = tokenList.find(t => t.id === winningTokenId);
            if (winnerToken) {
                for (let i = 0; i < extraNeeded; i++) {
                    cards.push({
                        id: winningTokenId,
                        token: winnerToken,
                        betAmount: tokenBets[winningTokenId] || 0,
                        isWinner: true,
                        uniqueKey: `${winningTokenId}-extra-${i}`
                    });
                }
            } else {
                // If no winner token, duplicate the first token
                if (cards.length > 0) {
                    const firstCard = cards[0];
                    for (let i = 0; i < extraNeeded; i++) {
                        cards.push({
                            ...firstCard,
                            uniqueKey: `${firstCard.id}-extra-${i}`
                        });
                    }
                }
            }
        }

        // Create a deterministic seed for shuffling based on winning token
        const shuffleSeed = simpleHash(winningTokenId);

        // Deterministically shuffle cards based on seed
        const shuffledCards = [...cards];
        for (let i = shuffledCards.length - 1; i > 0; i--) {
            // Use a deterministic random number based on the seed and current index
            const j = Math.floor((simpleHash(`${shuffleSeed}-${i}`) % 1000) / 1000 * (i + 1));
            [shuffledCards[i], shuffledCards[j]] = [shuffledCards[j], shuffledCards[i]];
        }

        // Find all winner card indices
        const winnerCardIndices = shuffledCards
            .map((card, index) => card.isWinner ? index : -1)
            .filter(index => index !== -1);

        console.log(`SpinAnimation: Winner cards found at indices: ${winnerCardIndices.join(', ')}`);

        // If we have winner cards, ensure at least one is in the middle third
        if (winnerCardIndices.length > 0) {
            const middleThirdStart = Math.floor(shuffledCards.length / 3);
            const middleThirdEnd = Math.floor(shuffledCards.length * 2 / 3);

            // Check if we need to move a winner card
            const hasWinnerInMiddle = winnerCardIndices.some(index =>
                index >= middleThirdStart && index <= middleThirdEnd);

            if (!hasWinnerInMiddle && winnerCardIndices.length > 0) {
                // Move one winner card to the middle
                const winnerToMove = winnerCardIndices[0];
                const targetPosition = Math.floor(shuffledCards.length / 2);

                // Swap positions
                const temp = shuffledCards[targetPosition];
                shuffledCards[targetPosition] = shuffledCards[winnerToMove];
                shuffledCards[winnerToMove] = temp;
            }
        }

        // Store cards in ref
        tokenCardsRef.current = shuffledCards;

        // Determine final winner index (prefer middle third if possible)
        const middleThirdStart = Math.floor(shuffledCards.length / 3);
        const middleThirdEnd = Math.floor(shuffledCards.length * 2 / 3);

        const middleWinners = winnerCardIndices.filter(index =>
            index >= middleThirdStart && index <= middleThirdEnd);

        if (middleWinners.length > 0) {
            // Deterministically pick one from the middle based on seed
            const winnerIndex = middleWinners[simpleHash(winningTokenId) % middleWinners.length];
            finalWinnerIndexRef.current = winnerIndex;
        } else if (winnerCardIndices.length > 0) {
            // If no middle winners, deterministically pick any winner
            const winnerIndex = winnerCardIndices[simpleHash(winningTokenId) % winnerCardIndices.length];
            finalWinnerIndexRef.current = winnerIndex;
        }
    }, [isClient, tokenBets, tokenList, winningTokenId]);

    // Function to pick next spotlight index 
    const pickNextIndex = useCallback((currentIndex: number | null): number => {
        if (!isClient || finalWinnerIndexRef.current === null || tokenCardsRef.current.length === 0) return 0;

        // For the last 5 steps, ensure we move toward the final winner
        if (currentStepRef.current >= totalStepsRef.current - 5) {
            // If we're not on the final winner, move closer
            if (currentIndex !== finalWinnerIndexRef.current) {
                // Get direction to move
                const direction = currentIndex === null || currentIndex < finalWinnerIndexRef.current ? 1 : -1;

                // Calculate how many steps to take
                const stepsLeft = totalStepsRef.current - currentStepRef.current;
                const distance = Math.abs(currentIndex === null ? 0 : currentIndex - finalWinnerIndexRef.current);
                const step = Math.max(1, Math.ceil(distance / stepsLeft));

                return currentIndex === null ?
                    finalWinnerIndexRef.current :
                    Math.max(0, Math.min(tokenCardsRef.current.length - 1, currentIndex + (direction * step)));
            }
            return finalWinnerIndexRef.current; // Stay on winner for final steps
        }

        // We need to use a deterministic approach for SSR compatibility
        // Use the current step as a seed for a pseudo-random selection
        const seed = simpleHash(`${winningTokenId}-step-${currentStepRef.current}`);

        // Normal selection - avoid the same card twice in a row
        const candidates = [...Array(tokenCardsRef.current.length).keys()]
            .filter(idx => idx !== currentIndex);

        // Early in the animation, prefer indices closer to the current one for smoother movement
        if (currentStepRef.current < totalStepsRef.current / 2 && currentIndex !== null) {
            // Sort by proximity to current index
            candidates.sort((a, b) => {
                const distA = Math.abs(a - currentIndex);
                const distB = Math.abs(b - currentIndex);
                return distA - distB;
            });

            // Take one of the closest 25% indices - use deterministic selection
            const closestCount = Math.max(3, Math.floor(candidates.length / 4));
            return candidates[seed % closestCount];
        }

        // Later in the animation, use deterministic selection
        return candidates[seed % candidates.length];
    }, [isClient, winningTokenId]);

    // Start the animation
    const startSpotlightAnimation = useCallback(() => {
        if (!isClient || isAnimatingRef.current || finalWinnerIndexRef.current === null) return;

        // Clear any existing timers
        if (animationTimerRef.current) clearTimeout(animationTimerRef.current);

        // Set this flag to prevent restart during animation
        isAnimatingRef.current = true;

        // Define animation parameters
        const totalDuration = 7000; // 7 seconds total animation time
        const initialDelay = 2; // Initial time between token changes (extremely fast, 2ms)
        const finalDelay = 800; // Final time between token changes (slow)
        const totalSteps = 300; // More steps for smoother animation

        // Time distribution parameters
        // This will keep the animation fast for the first 75% of the time
        // and then dramatically slow down in the last 25%
        const fastPhaseDuration = 0.75; // 75% of time spent cycling fast
        const slowPhaseStart = fastPhaseDuration;

        totalStepsRef.current = totalSteps;
        currentStepRef.current = 0;

        startTimeRef.current = Date.now();
        endTimeRef.current = startTimeRef.current + totalDuration;

        // Start with first index
        let currentIndex = 0;
        spotlightIndexRef.current = currentIndex;
        setSpotlightIndex(currentIndex);

        // Calculate how many steps to take in which direction to land on the winner
        const calculatePath = () => {
            // Get final winner index 
            const targetIndex = finalWinnerIndexRef.current || 0;
            // Calculate how many full loops plus remaining steps needed
            const cardsCount = tokenCardsRef.current.length;

            // We want to:
            // 1. Make a certain number of full loops (at least 15-20 for faster appearance)
            // 2. Then end up at targetIndex

            // Calculate how many full cycles to make first
            const minFullLoops = 20;
            const fullLoopSteps = minFullLoops * cardsCount;

            // Calculate remaining steps to reach target
            let remainingSteps;
            if (currentIndex <= targetIndex) {
                remainingSteps = targetIndex - currentIndex;
            } else {
                remainingSteps = (cardsCount - currentIndex) + targetIndex;
            }

            return fullLoopSteps + remainingSteps;
        };

        const totalPathSteps = calculatePath();
        console.log(`SpinAnimation: Will take ${totalPathSteps} steps to reach winner`);

        // Recursive function to move through tokens at decreasing speed
        const moveSpotlight = () => {
            if (!isAnimatingRef.current) return;

            const now = Date.now();
            const elapsedRatio = Math.min(1, (now - startTimeRef.current) / totalDuration);

            // Calculate current step's index
            currentIndex = (currentIndex + 1) % tokenCardsRef.current.length;

            // Check if we should end the animation
            // End when time is up AND we're at the winner index
            const reachedWinner = currentIndex === finalWinnerIndexRef.current;
            const timeIsUp = elapsedRatio >= 0.95; // Allow animation to end a bit early if needed

            if ((timeIsUp && reachedWinner) || currentStepRef.current >= totalPathSteps) {
                // Ensure we land exactly on the winner
                currentIndex = finalWinnerIndexRef.current as number;
                spotlightIndexRef.current = currentIndex;
                setSpotlightIndex(currentIndex);
                setHasLanded(true);
                isAnimatingRef.current = false;
                return;
            }

            // Otherwise, update spotlight position
            spotlightIndexRef.current = currentIndex;
            setSpotlightIndex(currentIndex);

            // Increase step counter
            currentStepRef.current++;

            // Calculate delay for next step
            // Custom easing: Keep it very fast until slowPhaseStart, then dramatically slow down
            let delay;
            if (elapsedRatio < slowPhaseStart) {
                // Fast phase - minimal delay increase
                delay = initialDelay + (elapsedRatio / slowPhaseStart) * (initialDelay * 3);
            } else {
                // Slow phase - dramatic slowdown using easeOutQuint curve
                const t = (elapsedRatio - slowPhaseStart) / (1 - slowPhaseStart);
                const easeOutQuint = 1 - Math.pow(1 - t, 5);
                delay = initialDelay * 3 + easeOutQuint * (finalDelay - initialDelay * 3);
            }

            // Schedule next movement
            animationTimerRef.current = setTimeout(moveSpotlight, delay);
        };

        // Start the animation after a brief delay
        animationTimerRef.current = setTimeout(moveSpotlight, 100);
    }, [isClient, pickNextIndex]);

    // Set isClient flag on mount
    useEffect(() => {
        setIsClient(true);
    }, []);

    // Initialize once on client-side
    useEffect(() => {
        if (!isClient || isInitializedRef.current) return;

        isInitializedRef.current = true;

        // Generate token cards
        generateTokenCards();

        // Start animation after cards are generated
        const initTimer = setTimeout(() => {
            startSpotlightAnimation();
        }, 500);

        return () => {
            clearTimeout(initTimer);
        };
    }, [isClient, generateTokenCards, startSpotlightAnimation]);

    // Cleanup effect to properly cancel all animation timers
    useEffect(() => {
        return () => {
            if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
            if (resetIntervalRef.current) clearInterval(resetIntervalRef.current);
            isAnimatingRef.current = false;
        };
    }, []);

    // Winning highlight animation with react-spring
    const winnerSpring = useSpring({
        scale: hasLanded ? 1.2 : 1,
        glow: hasLanded ? 1 : 0,
        config: config.gentle,
        delay: 200
    });

    // Use springs for smoother animations
    const spotlightSpring = useSpring({
        scale: hasLanded ? 1 : 1.1,
        glow: hasLanded ? 0 : 0.8,
        pulseOpacity: hasLanded ? 0 : 0.8,
        accentColor: 'rgb(255, 204, 0)',
        config: { tension: 280, friction: 120 }
    });

    // Show result dialog when animation completes
    useEffect(() => {
        if (hasLanded) {
            setShowResultDialog(true);
        } else {
            setShowResultDialog(false);
        }
    }, [hasLanded]);

    // --- Countdown Timer for Auto-Reset ---
    useEffect(() => {
        if (!isClient) return;

        if (hasLanded) {
            const targetResetTime = spinScheduledAt + 60000;
            const updateCountdown = () => {
                const now = Date.now();
                const timeLeftMs = Math.max(0, targetResetTime - now);
                setResetTimeLeft(timeLeftMs);
                if (timeLeftMs <= 0) {
                    if (resetIntervalRef.current) clearInterval(resetIntervalRef.current);
                    if (!animationCompleteCalledRef.current) {
                        console.log("Reset timer finished, calling onAnimationComplete");
                        onAnimationComplete();
                        animationCompleteCalledRef.current = true;
                    }
                }
            };
            updateCountdown();
            resetIntervalRef.current = setInterval(updateCountdown, 1000);
        } else {
            if (resetIntervalRef.current) clearInterval(resetIntervalRef.current);
            setResetTimeLeft(null);
        }
        return () => { if (resetIntervalRef.current) clearInterval(resetIntervalRef.current); };
    }, [hasLanded, isClient, onAnimationComplete, spinScheduledAt]);

    // Helper to format time
    const formatTime = (ms: number | null): string => {
        if (ms === null) return '--:--';
        const totalSeconds = Math.max(0, Math.floor(ms / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    // Find the actual winner token details
    const winnerTokenDetails = tokenList.find(t => t.id === winningTokenId);

    // Create a placeholder token for the "No Token" scenario if winningTokenId === 'none'
    const placeholderToken = winningTokenId === 'none' ? {
        id: 'none',
        name: 'No Tokens Were Pumped',
        symbol: 'None',
        imageUrl: '/placeholder-token.png'
    } : null;

    // Use the winner token or the placeholder token
    const displayToken = winnerTokenDetails || placeholderToken;

    // Server-side or initial client render - return minimal loading state
    if (typeof window === 'undefined' || !isClient) {
        return (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center z-[60] p-4">
                <div className="text-primary text-2xl">Loading...</div>
            </div>
        );
    }

    // If cards aren't generated yet, show loading
    if (tokenCardsRef.current.length === 0) {
        return (
            <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center z-[60] p-4">
                <div className="text-primary text-2xl animate-pulse">Loading...</div>
            </div>
        );
    }

    // Calculate columns based on screen size
    const gridClass = "grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-6 gap-2 md:gap-3";

    return (
        <>
            <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center z-[60] p-4 overflow-hidden">
                {/* Token Grid with Spotlight */}
                <div className="w-full max-w-5xl relative py-4 mb-8">
                    <div className={gridClass}>
                        {tokenCardsRef.current.map((card, index) => {
                            // Exactly compare current spotlight index with this card index
                            const isSpotlight = spotlightIndex === index;
                            const isFinalWinner = finalWinnerIndexRef.current === index;

                            // Apply special spring animation to final winner when landed
                            const style = isFinalWinner && hasLanded ? {
                                transform: winnerSpring.scale.to(s => `scale(${s})`),
                                boxShadow: winnerSpring.glow.to(g =>
                                    `0 0 ${8 + g * 24}px ${g * 12}px rgba(var(--color-primary), ${0.3 + g * 0.5})`)
                            } : isSpotlight && !hasLanded ? {
                                // Dynamic spotlight styling
                                transform: spotlightSpring.scale.to(s => `scale(${s})`),
                                boxShadow: spotlightSpring.glow.to(g =>
                                    `0 0 ${g * 16}px ${g * 12}px rgba(var(--color-primary), ${0.2 + g * 0.3})`),
                                borderColor: spotlightSpring.accentColor,
                            } : {};

                            const animationClass = isSpotlight && !hasLanded
                                ? 'animate-pulse-slow'
                                : '';

                            return (
                                <div
                                    key={card.uniqueKey}
                                    style={style as React.CSSProperties}
                                    className={`
                                        relative aspect-square p-2 rounded-lg 
                                        flex flex-col items-center justify-center text-center
                                        transition-colors duration-100
                                        ${isSpotlight && !hasLanded ? 'border-2 z-10' : 'border'}
                                        ${hasLanded && !isFinalWinner ? 'opacity-30 grayscale' : 'opacity-100'}
                                        ${isFinalWinner && hasLanded ? 'bg-primary/20 border-2 border-primary' : 'bg-card/60 border-border/50'}
                                        ${animationClass}
                                    `}
                                >
                                    {/* Spotlight overlay - only show if this is exactly the spotlight index */}
                                    {isSpotlight && !hasLanded && (
                                        <div
                                            className="absolute inset-0 rounded-lg animate-pulse-medium"
                                            style={{
                                                background: `radial-gradient(circle, rgba(var(--color-primary), 0.5) 0%, rgba(var(--color-primary), 0.2) 70%, rgba(var(--color-primary), 0) 100%)`,
                                                opacity: 0.8
                                            }}
                                        />
                                    )}

                                    <div className="relative flex items-center justify-center h-full">
                                        <Image
                                            src={card.token.imageUrl || '/placeholder-token.png'}
                                            alt={card.token.name}
                                            width={40}
                                            height={40}
                                            className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover"
                                            onError={(e) => { e.currentTarget.src = '/placeholder-token.png'; }}
                                        />
                                    </div>
                                    <p className="text-[10px] md:text-xs font-semibold truncate w-full text-foreground mt-1">
                                        {card.token.symbol}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Result Dialog - shown when animation completes */}
            <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
                <DialogContent className="bg-background/95 backdrop-blur-lg border-primary/30 p-0 max-w-xl overflow-visible z-[100]">
                    <DialogHeader className="sr-only">
                        <DialogTitle>Token Selection Results</DialogTitle>
                    </DialogHeader>
                    {displayToken && (
                        <div className="text-center animate-appear space-y-6 p-8">
                            <div className="space-y-3">
                                <h2 className="text-2xl md:text-4xl font-bold font-display tracking-tight text-pump animate-pulse-slow bg-gradient-to-r from-primary to-primary/80 bg-clip-text">
                                    Token Selected!
                                </h2>
                                <div className="flex items-center justify-center gap-3 px-6 py-4 rounded-xl glass-card max-w-xs mx-auto mt-2 animate-float">
                                    <div className="relative">
                                        <Image
                                            src={displayToken.imageUrl || '/placeholder-token.png'}
                                            alt={displayToken.name}
                                            width={48}
                                            height={48}
                                            className="w-12 h-12 rounded-full object-cover border-2 border-primary animate-pulse-medium"
                                        />
                                        <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs animate-subtle-bounce">
                                            <TrendingUp className="h-3 w-3" />
                                        </div>
                                    </div>
                                    <div className="text-left">
                                        <p className="text-xs text-muted-foreground">Selected Token</p>
                                        <p className="text-2xl font-display font-bold">{displayToken.symbol}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="glass-card p-5 space-y-4 text-left max-w-md mx-auto">
                                <h3 className="font-display text-lg font-medium flex items-center gap-2">
                                    <Rocket className="h-5 w-5 text-primary" />
                                    Group Pump Execution
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex gap-3 items-start">
                                        <div className="bg-primary/20 rounded-full w-7 h-7 flex items-center justify-center mt-0.5 shrink-0">
                                            <span className="text-sm font-bold text-primary">1</span>
                                        </div>
                                        <p className="text-sm">
                                            <span className="text-primary font-semibold numeric">All CHA</span> committed in this round will be used to purchase <span className="font-semibold">{displayToken.symbol}</span> tokens.
                                        </p>
                                    </div>
                                    <div className="flex gap-3 items-start">
                                        <div className="bg-primary/20 rounded-full w-7 h-7 flex items-center justify-center mt-0.5 shrink-0">
                                            <span className="text-sm font-bold text-primary">2</span>
                                        </div>
                                        <p className="text-sm">
                                            Each participant will receive <span className="font-semibold">{displayToken.symbol}</span> tokens equal to the value of <span className="text-primary font-semibold numeric">CHA</span> they committed.
                                        </p>
                                    </div>
                                    <div className="flex gap-3 items-start">
                                        <div className="bg-primary/20 rounded-full w-7 h-7 flex items-center justify-center mt-0.5 shrink-0">
                                            <span className="text-sm font-bold text-primary">3</span>
                                        </div>
                                        <p className="text-sm">
                                            Purchases will be executed in the same order that commitments were placed.
                                        </p>
                                    </div>
                                </div>

                                <div className="pt-3 mt-2 border-t border-border/30 flex items-center justify-between">
                                    <p className="text-sm text-muted-foreground">
                                        Next round starts in:
                                    </p>
                                    <span className="font-mono text-lg font-semibold text-primary numeric">{formatTime(resetTimeLeft)}</span>
                                </div>
                            </div>

                            <button
                                onClick={onAnimationComplete}
                                className="button-primary mt-4 mx-auto py-3 px-8"
                            >
                                View Results
                            </button>
                        </div>
                    )}

                    {hasLanded && !displayToken && (
                        <div className="text-center animate-appear space-y-4 p-6">
                            <div className="space-y-3">
                                <h2 className="text-2xl md:text-3xl font-bold font-display text-warning mb-2">Selection Complete</h2>
                                <div className="bg-muted/30 p-4 rounded-lg">
                                    <p className="text-muted-foreground mb-2">
                                        The selected token (ID: <span className="font-mono">{winningTokenId}</span>) is not in the current token list.
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        This may be a temporary issue. The purchase will still proceed as planned.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onAnimationComplete}
                                className="button-primary mt-4"
                            >
                                Continue to Results
                            </button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Add the animation classes to the animation layer in globals.css */}
            {hasLanded && (
                <style jsx global>{`
                    @keyframes pulse-slow {
                        0% { opacity: 0.7; }
                        100% { opacity: 0.9; }
                    }
                    
                    @keyframes pulse-medium {
                        0% { opacity: 0.65; }
                        100% { opacity: 0.95; }
                    }
                    
                    @keyframes pulse-fast {
                        0% { opacity: 0.6; }
                        100% { opacity: 1; }
                    }
                    
                    @keyframes subtle-rotate {
                        0% { transform: rotate(-1deg); }
                        100% { transform: rotate(1deg); }
                    }
                    
                    @keyframes subtle-bounce {
                        0% { transform: translateY(0); }
                        100% { transform: translateY(-2px); }
                    }
                    
                    .animate-pulse-slow {
                        animation: pulse-slow 1s infinite alternate;
                    }
                    
                    .animate-pulse-medium {
                        animation: pulse-medium 0.5s infinite alternate;
                    }
                    
                    .animate-pulse-fast {
                        animation: pulse-fast 0.25s infinite alternate;
                    }
                    
                    .animate-subtle-rotate {
                        animation: subtle-rotate 2s infinite alternate ease-in-out;
                    }
                    
                    .animate-subtle-bounce {
                        animation: subtle-bounce 0.3s infinite alternate ease-in-out;
                    }
                `}</style>
            )}
        </>
    );
});

SpinAnimationOverlay.displayName = 'SpinAnimationOverlay';

export default SpinAnimationOverlay;