"use client";

import React from 'react';

/** A pulsing block standing in for one piece of the swap card */
const Bone = ({ className }: { className: string }) => <div className={`rounded-lg bg-surface-hover ${className}`} />;

/** One side of the swap (send or receive), shaped like the real card */
function SideSkeleton() {
    return (
        <div className="space-y-5 rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-center gap-3">
                <Bone className="h-10 w-10 rounded-xl" />
                <div className="space-y-2">
                    <Bone className="h-3.5 w-20" />
                    <Bone className="h-3 w-32" />
                </div>
            </div>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Bone className="h-10 w-10 rounded-full" />
                    <div className="space-y-2">
                        <Bone className="h-3.5 w-14" />
                        <Bone className="h-3 w-20" />
                    </div>
                </div>
                <Bone className="h-4 w-28" />
            </div>
            <Bone className="h-7 w-48 rounded-lg" />
            <div className="flex items-center justify-between">
                <Bone className="h-9 w-32" />
                <Bone className="h-8 w-24 rounded-full" />
            </div>
        </div>
    );
}

/** The swap card's outline while tokens and routes load */
export default function LoadingState() {
    return (
        <div className="mx-auto max-w-md animate-pulse space-y-4" aria-busy="true" aria-label="Loading the swap">
            <SideSkeleton />
            <div className="flex justify-center">
                <Bone className="h-10 w-10 rounded-full" />
            </div>
            <SideSkeleton />
            <Bone className="h-12 w-full rounded-xl" />
        </div>
    );
}
