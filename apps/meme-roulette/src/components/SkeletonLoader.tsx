import React from 'react';

interface SkeletonProps {
    type: 'hub' | 'portfolio' | 'leaderboardRow' | 'generic';
    count?: number;
}

const SkeletonLoader = ({ type, count = 1 }: SkeletonProps) => {
    const Shimmer = () => (
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-gray-300/30 dark:via-gray-600/30 to-transparent"></div>
    );

    const renderSkeletons = () => {
        switch (type) {
            case 'hub':
                return (
                    <div className="animate-pulse">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="md:col-span-1 relative overflow-hidden bg-muted p-4 rounded-lg shadow h-40"> <Shimmer /> </div>
                            <div className="md:col-span-2 relative overflow-hidden bg-muted p-4 rounded-lg shadow h-40"> <Shimmer /> </div>
                        </div>
                        <div className="relative overflow-hidden bg-muted p-4 rounded-lg shadow h-64 mb-24 sm:mb-8"> <Shimmer /> </div>
                    </div>
                );
            case 'portfolio':
                return (
                    <div className="animate-pulse space-y-4">
                        <div className="relative overflow-hidden bg-muted p-4 rounded-lg shadow h-24"> <Shimmer /> </div>
                        <div className="relative overflow-hidden bg-muted p-4 rounded-lg shadow h-48"> <Shimmer /> </div>
                    </div>
                );
            case 'leaderboardRow':
                return Array.from({ length: count }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                        <td className="py-3 px-4"><div className="h-6 relative overflow-hidden bg-muted rounded"> <Shimmer /> </div></td>
                        <td className="py-3 px-4"><div className="h-6 relative overflow-hidden bg-muted rounded"> <Shimmer /> </div></td>
                        <td className="py-3 px-4"><div className="h-6 relative overflow-hidden bg-muted rounded"> <Shimmer /> </div></td>
                    </tr>
                ));
            default:
                return (
                    <div className="relative overflow-hidden bg-muted p-4 rounded-lg h-20 animate-pulse">
                        <Shimmer />
                    </div>
                );
        }
    };

    return <>{renderSkeletons()}</>;
};

export default SkeletonLoader;
