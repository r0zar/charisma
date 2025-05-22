"use client";

import * as React from 'react'; // Import React if TooltipProvider requires it
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { HelpCircle } from "lucide-react";

// Pool Configuration Step Component
export const PoolConfigStep = ({
    poolName,
    onPoolNameChange,
    swapFee,
    onSwapFeeChange,
    token1,
    token2,
    errors,
    onPrevious,
    onNext
}: {
    poolName: string;
    onPoolNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    swapFee: string;
    onSwapFeeChange: (value: string) => void;
    token1: string;
    token2: string;
    errors: Record<string, string>;
    onPrevious: () => void;
    onNext: () => void;
}) => {
    return (
        <Card className="mb-8">
            <CardHeader>
                <CardTitle>Pool Configuration</CardTitle>
                <CardDescription>
                    Set the core properties of your {token1}-{token2} liquidity pool
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="poolName">
                        Pool Name
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <HelpCircle className="h-4 w-4 ml-1 inline-block text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="w-80">
                                        The name of your liquidity pool
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </Label>
                    <Input
                        id="poolName"
                        value={poolName}
                        onChange={onPoolNameChange}
                        placeholder={`${token1}-${token2} Liquidity Pool`}
                        className={errors.poolName ? "border-destructive" : ""}
                    />
                    {errors.poolName && (
                        <p className="text-destructive text-sm">{errors.poolName}</p>
                    )}
                </div>

                {/* Swap Fee */}
                <div className="space-y-2">
                    <div className="flex items-center">
                        <Label htmlFor="swapFee">Swap Fee (%)</Label>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className="h-5 w-5 p-0 ml-1"
                                    >
                                        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span className="sr-only">Info</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="w-80">
                                        The fee charged on swaps, which is distributed to liquidity providers. Common values: 0.3% (standard), 0.1% (stable pairs), 1% (exotic pairs)
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                    <Select
                        value={swapFee}
                        onValueChange={onSwapFeeChange}
                    >
                        <SelectTrigger className={errors.swapFee ? "border-destructive" : ""}>
                            <SelectValue defaultValue="0.3" placeholder="Select swap fee" />
                        </SelectTrigger>
                        <SelectContent className="bg-background">
                            <SelectItem value="0.1">0.1% (Stable pairs)</SelectItem>
                            <SelectItem value="0.3">0.3% (Standard)</SelectItem>
                            <SelectItem value="1.0">1.0% (Exotic pairs)</SelectItem>
                            <SelectItem value="3.0">3.0% (Meme pairs)</SelectItem>
                        </SelectContent>
                    </Select>
                    {errors.swapFee && (
                        <p className="text-destructive text-sm">{errors.swapFee}</p>
                    )}
                </div>
            </CardContent>
            <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={onPrevious}>
                    Back
                </Button>
                <Button onClick={onNext}>
                    Continue to Initialize
                </Button>
            </CardFooter>
        </Card>
    );
}; 