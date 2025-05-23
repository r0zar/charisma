"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    generateMinimalDataUri,
    generate1x1ColorPixel,
    generateCompactSvgDataUri,
    generateOptimizedOnChainMetadata,
    generateUltraCompactMetadata,
    generateCustomOptimizedMetadata
} from "@/lib/utils/image-utils";

export default function MetadataTestPage() {
    const [tokenSymbol, setTokenSymbol] = useState("ROO");
    const [results, setResults] = useState<any[]>([]);

    const testOptimizations = () => {
        const strategies = [
            {
                name: "Original (Your Current)",
                generate: () => {
                    const metadata = {
                        name: `${tokenSymbol}-sublink`,
                        image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAECAYAAAChp8Z5+AAAAXNSr0IArs4c6QAAAhNJREFUGFdjPHPmzP+zZ88yGBsbM4BoxpkzZ/6HcUA0I0EVAF9GHl+SiMqPAAAAElFTkSuQmCC"
                    };
                    const jsonString = JSON.stringify(metadata);
                    const base64 = btoa(jsonString);
                    return `data:application/json;base64,${base64}`;
                }
            },
            {
                name: "Optimized with 1x1 Transparent Pixel",
                generate: () => generateOptimizedOnChainMetadata(tokenSymbol, 'transparent').dataUri
            },
            {
                name: "Optimized with 1x1 Color Pixel",
                generate: () => generateOptimizedOnChainMetadata(tokenSymbol, 'color', 'random').dataUri
            },
            {
                name: "Optimized with SVG",
                generate: () => generateOptimizedOnChainMetadata(tokenSymbol, 'svg', 'random').dataUri
            },
            {
                name: "Ultra Compact (Standard Fields)",
                generate: () => generateUltraCompactMetadata(tokenSymbol).dataUri
            },
            {
                name: "Custom Minimal (Standard Fields)",
                generate: () => generateCustomOptimizedMetadata(
                    tokenSymbol,
                    'transparent'
                ).dataUri
            }
        ];

        const testResults = strategies.map(strategy => {
            const dataUri = strategy.generate();
            const decoded = JSON.parse(atob(dataUri.split(',')[1]));

            return {
                strategy: strategy.name,
                dataUri,
                length: dataUri.length,
                underLimit: dataUri.length <= 256,
                decoded
            };
        });

        setResults(testResults);
    };

    return (
        <div className="container mx-auto p-6 max-w-6xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-4">Metadata URI Optimization Test</h1>
                <p className="text-muted-foreground mb-6">
                    Test different strategies to keep metadata URIs under the 256 character limit for on-chain storage.
                    All optimized versions use only name and image fields (description removed to save space) with standard field names for compatibility.
                </p>

                <div className="flex items-center gap-4 mb-6">
                    <div>
                        <Label htmlFor="symbol">Token Symbol</Label>
                        <Input
                            id="symbol"
                            value={tokenSymbol}
                            onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                            placeholder="ROO"
                            className="w-32"
                        />
                    </div>
                    <Button onClick={testOptimizations} className="mt-6">
                        Test Optimizations
                    </Button>
                </div>
            </div>

            {results.length > 0 && (
                <div className="grid gap-6">
                    {results.map((result, index) => (
                        <Card key={index} className={`${result.underLimit ? 'border-emerald-500 dark:border-emerald-400' : 'border-destructive dark:border-destructive'}`}>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-between">
                                    <span>{result.strategy}</span>
                                    <div className="flex items-center gap-2">
                                        <Badge variant={result.underLimit ? "default" : "destructive"}>
                                            {result.length} chars
                                        </Badge>
                                        {result.underLimit && (
                                            <Badge variant="outline" className="border-emerald-500 dark:border-emerald-400 text-emerald-600 dark:text-emerald-300">
                                                ✓ Under 256
                                            </Badge>
                                        )}
                                    </div>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div>
                                        <Label className="text-sm font-medium">Decoded Metadata:</Label>
                                        <pre className="mt-1 p-3 bg-muted rounded text-xs overflow-auto">
                                            {JSON.stringify(result.decoded, null, 2)}
                                        </pre>
                                    </div>

                                    <div>
                                        <Label className="text-sm font-medium">Data URI:</Label>
                                        <div className="mt-1 p-3 bg-muted rounded text-xs break-all font-mono">
                                            {result.dataUri}
                                        </div>
                                    </div>

                                    {result.decoded.image && result.decoded.image.startsWith('data:image') && (
                                        <div>
                                            <Label className="text-sm font-medium">Image Preview:</Label>
                                            <div className="mt-1 w-16 h-16 border rounded bg-background dark:bg-background flex items-center justify-center">
                                                <img
                                                    src={result.decoded.image}
                                                    alt="preview"
                                                    className="max-w-full max-h-full"
                                                    onError={(e) => {
                                                        (e.target as HTMLElement).style.display = 'none';
                                                        (e.target as HTMLElement).parentElement!.innerHTML = '<span class="text-xs text-muted-foreground">1x1 pixel</span>';
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <div className="mt-8 p-6 bg-muted/50 rounded-lg">
                <h2 className="text-xl font-semibold mb-4">Optimization Strategies Summary</h2>
                <div className="space-y-3 text-sm">
                    <div>
                        <strong>1. 1x1 Transparent Pixel:</strong> Uses the smallest possible valid image (37 chars) - completely transparent.
                    </div>
                    <div>
                        <strong>2. 1x1 Color Pixel:</strong> Uses a 1x1 solid color pixel (~45-50 chars) - allows custom branding colors.
                    </div>
                    <div>
                        <strong>3. Compact SVG:</strong> Uses a simple SVG circle (50-80 chars) - scalable and customizable.
                    </div>
                    <div>
                        <strong>4. Ultra Compact:</strong> Uses minimal content with standard field names - just symbol for name.
                    </div>
                    <div>
                        <strong>5. Custom Minimal:</strong> Allows full customization while maintaining size optimization.
                    </div>
                </div>

                <div className="mt-4 p-4 bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30 rounded-lg">
                    <p className="text-sm text-primary dark:text-primary">
                        <strong>Optimization:</strong> Description field removed to save ~15-30 characters.
                        All strategies maintain standard field names (name, image) for full SIP-010 and metadata standards compatibility.
                        Color pixels and SVG circles now use random colors for visual variety!
                    </p>
                </div>
            </div>
        </div>
    );
} 