import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/header";

export default function Loading() {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            <Header />
            <main className="flex-1 container py-8">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
                    <div>
                        <Skeleton className="h-10 w-48 mb-2" />
                        <Skeleton className="h-4 w-72" />
                    </div>
                    <Skeleton className="h-10 w-36" />
                </div>

                <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
                    {/* Sidebar Filters skeleton */}
                    <div className="lg:col-span-1">
                        <Skeleton className="h-64 w-full" />
                    </div>

                    {/* Main content skeleton */}
                    <div className="lg:col-span-3">
                        <Skeleton className="h-10 w-64 mb-6" />

                        {/* Grid of items skeleton */}
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(i => (
                                <div key={i} className="border border-border/50 rounded-lg overflow-hidden">
                                    <Skeleton className="h-32 w-full" />
                                    <div className="p-3">
                                        <Skeleton className="h-4 w-3/4 mb-2" />
                                        <Skeleton className="h-3 w-1/2" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}