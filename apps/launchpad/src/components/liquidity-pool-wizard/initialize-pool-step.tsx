"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle } from "lucide-react";

// Initial Pool Ratio Configuration Step Component
export const InitializePoolStep = ({
    token1,
    token2,
    initialTokenRatio,
    onUpdateRatio,
    onPrevious,
    onNext
}: {
    token1: string;
    token2: string;
    initialTokenRatio: {
        token1Amount: number;
        token2Amount: number;
        useRatio: boolean;
    };
    onUpdateRatio: (ratio: {
        token1Amount: number;
        token2Amount: number;
        useRatio: boolean;
    }) => void;
    onPrevious: () => void;
    onNext: () => void;
}) => {
    const [token1Amount, setToken1Amount] = useState(initialTokenRatio.token1Amount.toString());
    const [token2Amount, setToken2Amount] = useState(initialTokenRatio.token2Amount.toString());
    const [useRatio, setUseRatio] = useState(initialTokenRatio.useRatio);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (useRatio) {
            if (token1Amount && isNaN(parseFloat(token1Amount))) {
                newErrors.token1Amount = "Must be a valid number";
            }

            if (token2Amount && isNaN(parseFloat(token2Amount))) {
                newErrors.token2Amount = "Must be a valid number";
            }

            if (parseFloat(token1Amount) <= 0 && parseFloat(token2Amount) <= 0) {
                newErrors.general = "At least one token amount must be greater than zero";
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleNext = () => {
        if (validateForm()) {
            onUpdateRatio({
                token1Amount: useRatio ? Math.max(0, parseFloat(token1Amount) || 0) : 0,
                token2Amount: useRatio ? Math.max(0, parseFloat(token2Amount) || 0) : 0,
                useRatio
            });
            onNext();
        }
    };

    return (
        <Card className="mb-8">
            <CardHeader>
                <CardTitle>Initial Pool Ratio</CardTitle>
                <CardDescription>
                    Set the initial ratio between {token1} and {token2} for your liquidity pool
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center space-x-2">
                    <Switch
                        id="useInitialRatio"
                        checked={useRatio}
                        onCheckedChange={setUseRatio}
                    />
                    <Label htmlFor="useInitialRatio">Initialize the pool with an initial token ratio</Label>
                </div>

                {useRatio && (
                    <div className="space-y-4 pt-4">
                        <div className="border rounded-md p-4 bg-muted/10">
                            <p className="text-sm text-muted-foreground mb-4">
                                Providing initial liquidity allows you to set the starting price ratio for your pool.
                                This affects the initial swap rate between the two tokens.
                            </p>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="token1Amount">
                                        Initial {token1} Amount
                                    </Label>
                                    <div className="flex">
                                        <Input
                                            id="token1Amount"
                                            value={token1Amount}
                                            onChange={(e) => setToken1Amount(e.target.value)}
                                            placeholder="0"
                                            type="number"
                                            min="0"
                                            className={errors.token1Amount ? "border-destructive" : ""}
                                        />
                                    </div>
                                    {errors.token1Amount && (
                                        <p className="text-destructive text-sm">{errors.token1Amount}</p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="token2Amount">
                                        Initial {token2} Amount
                                    </Label>
                                    <div className="flex">
                                        <Input
                                            id="token2Amount"
                                            value={token2Amount}
                                            onChange={(e) => setToken2Amount(e.target.value)}
                                            placeholder="0"
                                            type="number"
                                            min="0"
                                            className={errors.token2Amount ? "border-destructive" : ""}
                                        />
                                    </div>
                                    {errors.token2Amount && (
                                        <p className="text-destructive text-sm">{errors.token2Amount}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center p-4 bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/30 rounded-lg">
                            <AlertTriangle className="h-5 w-5 text-orange-500 mr-2" />
                            <p className="text-sm text-muted-foreground">
                                The contract will automatically transfer these token amounts from your wallet
                                during deployment. Make sure you have sufficient balance.
                            </p>
                        </div>

                        {errors.general && (
                            <p className="text-destructive text-sm">{errors.general}</p>
                        )}
                    </div>
                )}
            </CardContent>
            <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={onPrevious}>
                    Back
                </Button>
                <Button onClick={handleNext}>
                    Continue to Review
                </Button>
            </CardFooter>
        </Card>
    );
}; 