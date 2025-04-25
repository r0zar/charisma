'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// TODO: Fetch this list dynamically in the future
const knownPools = [
    {
        contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.monkey-d-luffy-rc8',
        name: 'Monkey D. Luffy',
        description: 'Provides liquidity between CHA and WELSH.'
    },
    // Add more known pools here as they are deployed
];

export default function PoolsIndexPage() {
    return (
        <div className="container py-8 max-w-7xl">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Liquidity Pools</h1>
                <p className="text-muted-foreground">
                    Explore and interact with liquidity pools.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {knownPools.map((pool) => (
                    <Card key={pool.contractId}>
                        <CardHeader>
                            <CardTitle>{pool.name}</CardTitle>
                            <CardDescription>{pool.contractId}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex flex-col justify-between">
                            <p className="text-sm mb-4">{pool.description}</p>
                            <Link href={`/pools/${pool.contractId}`} passHref>
                                <Button className="w-full">View Details</Button>
                            </Link>
                        </CardContent>
                    </Card>
                ))}
                {knownPools.length === 0 && (
                    <p className="text-muted-foreground col-span-full text-center">
                        No liquidity pools available yet.
                    </p>
                )}
            </div>
        </div>
    );
}
