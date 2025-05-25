import { Header } from "@/components/layout/header";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default function OfferLoading() {
    return (
        <div className="relative flex min-h-screen flex-col">
            <Header />
            <main className="container max-w-4xl py-8">
                {/* Breadcrumb Skeleton */}
                <div className="mb-6">
                    <div className="inline-flex items-center gap-2">
                        <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                        <Skeleton className="h-4 w-20" />
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Left Column - Offer Details */}
                    <div className="order-1">
                        {/* Main Offer Card */}
                        <Card className="p-6">
                            <div className="space-y-4">
                                {/* Title and Status */}
                                <div className="flex items-start justify-between">
                                    <div className="space-y-2">
                                        <Skeleton className="h-7 w-48" />
                                        <Skeleton className="h-4 w-32" />
                                    </div>
                                    <Skeleton className="h-6 w-16" />
                                </div>

                                {/* Asset Images */}
                                <div className="grid grid-cols-3 gap-3">
                                    <Skeleton className="aspect-square rounded-lg" />
                                    <Skeleton className="aspect-square rounded-lg" />
                                    <Skeleton className="aspect-square rounded-lg" />
                                </div>

                                {/* Description */}
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-full" />
                                    <Skeleton className="h-4 w-3/4" />
                                </div>

                                {/* Asset List */}
                                <div className="space-y-3">
                                    <Skeleton className="h-5 w-24" />
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3">
                                            <Skeleton className="h-8 w-8 rounded-full" />
                                            <Skeleton className="h-4 w-24" />
                                            <Skeleton className="h-4 w-16 ml-auto" />
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Skeleton className="h-8 w-8 rounded-full" />
                                            <Skeleton className="h-4 w-32" />
                                            <Skeleton className="h-4 w-20 ml-auto" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>

                    {/* Right Column - Bid Form */}
                    <div className="order-2">
                        <Card className="p-6">
                            <div className="space-y-4">
                                <Skeleton className="h-6 w-32" />

                                {/* Form Fields */}
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-20" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-16" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                </div>

                                {/* Submit Button */}
                                <Skeleton className="h-10 w-full" />
                            </div>
                        </Card>
                    </div>
                </div>

                {/* Stats Cards - Full Width */}
                <div className="mt-8">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card className="p-4">
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-8 w-12" />
                            </div>
                        </Card>
                        <Card className="p-4">
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-12" />
                                <Skeleton className="h-6 w-16" />
                            </div>
                        </Card>
                        <Card className="p-4">
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-14" />
                                <Skeleton className="h-8 w-8" />
                            </div>
                        </Card>
                        <Card className="p-4">
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-16" />
                                <Skeleton className="h-5 w-20" />
                            </div>
                        </Card>
                    </div>
                </div>

                {/* Social Share */}
                <div className="mt-8">
                    <Card className="p-6">
                        <div className="space-y-4">
                            <Skeleton className="h-5 w-24" />
                            <div className="flex gap-2">
                                <Skeleton className="h-10 w-10" />
                                <Skeleton className="h-10 w-10" />
                                <Skeleton className="h-10 w-10" />
                                <Skeleton className="h-10 w-10" />
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Bids Section */}
                <div className="mt-8">
                    <Card className="p-6">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Skeleton className="h-6 w-32" />
                                <Skeleton className="h-4 w-16" />
                            </div>

                            {/* Bid List */}
                            <div className="space-y-3">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 border border-border rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <Skeleton className="h-8 w-8 rounded-full" />
                                            <div className="space-y-1">
                                                <Skeleton className="h-4 w-24" />
                                                <Skeleton className="h-3 w-16" />
                                            </div>
                                        </div>
                                        <div className="text-right space-y-1">
                                            <Skeleton className="h-4 w-20" />
                                            <Skeleton className="h-3 w-16" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </Card>
                </div>
            </main>
        </div>
    );
} 