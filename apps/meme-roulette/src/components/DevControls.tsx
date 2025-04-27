'use client';
import React, { useState } from 'react';
import type { SpinFeedData, Token } from '@/types/spin';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { resetKVForNextSpin, setKVSpinScheduledAt, setKVWinningToken } from '@/app/api/stream/state'; // Import state functions

interface DevControlsProps {
    isConnected: boolean;
    setIsConnected: (connected: boolean) => void;
    data: SpinFeedData | null;
    chaBalance: number;
    setChaBalance: (balance: number) => void;
    tokenList: Token[];
}

const DevControls: React.FC<DevControlsProps> = ({
    isConnected,
    setIsConnected,
    data,
    chaBalance,
    setChaBalance,
    tokenList,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleForceSpinEnd = async () => {
        setIsLoading(true);
        console.log('[DEV] Forcing spin end...');
        // Example: Directly set the end time in KV to now (or past)
        await setKVSpinScheduledAt(Date.now() - 1000); // Set end time to 1 second ago
        setIsLoading(false);
    };

    const handleForceSelectWinner = async () => {
        setIsLoading(true);
        console.log('[DEV] Forcing winner selection...');
        if (tokenList.length > 0) {
            const randomIndex = Math.floor(Math.random() * tokenList.length);
            const randomWinnerId = tokenList[randomIndex].id;
            await setKVWinningToken(randomWinnerId);
            console.log(`[DEV] Set ${randomWinnerId} as winner.`);
        } else {
            console.warn('[DEV] No tokens available to select a winner.');
        }
        setIsLoading(false);
    };

    const handleResetSpin = async () => {
        setIsLoading(true);
        console.log('[DEV] Resetting spin state...');
        await resetKVForNextSpin();
        setIsLoading(false);
    };

    return (
        <div className="fixed bottom-4 left-4 bg-background/90 backdrop-blur-sm border border-border shadow-lg rounded-lg p-4 z-[100] max-w-xs w-full text-xs">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center justify-between w-full font-bold mb-2 text-center text-sm"
                aria-expanded={isOpen}
            >
                <span>DEV CONTROLS</span>
                {isOpen ?
                    <ChevronUp size={16} aria-hidden="true" /> :
                    <ChevronDown size={16} aria-hidden="true" />
                }
            </button>
            {isOpen && (
                <div className="space-y-3 border-t border-border pt-3">
                    {/* Connection Toggle */}
                    <div className="flex items-center justify-between">
                        <Label htmlFor="connection-switch">Feed Connected</Label>
                        <Switch
                            id="connection-switch"
                            checked={isConnected}
                            onCheckedChange={setIsConnected}
                            disabled={isLoading}
                        />
                    </div>

                    {/* CHA Balance Slider */}
                    <div className="space-y-1">
                        <Label htmlFor="cha-slider">My CHA Balance: {chaBalance.toLocaleString()}</Label>
                        <Slider
                            id="cha-slider"
                            min={0}
                            max={100000}
                            step={1000}
                            value={[chaBalance]}
                            onValueChange={(value) => setChaBalance(value[0])}
                            disabled={isLoading}
                        />
                    </div>

                    {/* Instructions Toggle Removed */}

                    {/* Spin State Info */}
                    <div className="text-muted-foreground border-t border-border pt-2 mt-2">
                        <p>Status: <span className="font-mono">{data?.type || 'N/A'}</span></p>
                        <p>End Time: <span className="font-mono">{data?.endTime ? new Date(data.endTime).toLocaleTimeString() : 'N/A'}</span></p>
                        <p>Winner: <span className="font-mono">{data?.winningTokenId || 'N/A'}</span></p>
                        <p>Tokens: <span className="font-mono">{tokenList.length}</span></p>
                        <p>Total Votes: <span className="font-mono">{Object.keys(data?.tokenVotes || {}).length}</span></p> {/* Use tokenVotes */}
                    </div>

                    {/* Manual Spin Triggers */}
                    <div className="flex gap-2 pt-2 border-t border-border">
                        <Button size="sm" variant="outline" onClick={handleForceSpinEnd} disabled={isLoading}>Force End</Button>
                        <Button size="sm" variant="outline" onClick={handleForceSelectWinner} disabled={isLoading}>Force Winner</Button>
                        <Button size="sm" variant="destructive" onClick={handleResetSpin} disabled={isLoading}>Reset Spin</Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DevControls; 