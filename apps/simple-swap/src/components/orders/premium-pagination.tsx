'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

export interface PaginationInfo {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
}

interface PremiumPaginationProps {
    pagination: PaginationInfo;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
    isLoading?: boolean;
}

/**
 * Premium pagination component with Apple/Tesla design system
 */
export default function PremiumPagination({ 
    pagination, 
    onPageChange, 
    onLimitChange, 
    isLoading = false 
}: PremiumPaginationProps) {
    const { page, totalPages, hasNextPage, hasPrevPage, total, limit } = pagination;

    // Generate page numbers to show
    const getPageNumbers = () => {
        const pages: (number | 'ellipsis')[] = [];
        const maxVisible = 7; // Maximum number of page buttons to show
        
        if (totalPages <= maxVisible) {
            // Show all pages if we have few enough
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Always show first page
            pages.push(1);
            
            if (page > 4) {
                pages.push('ellipsis');
            }
            
            // Show pages around current page
            const start = Math.max(2, page - 1);
            const end = Math.min(totalPages - 1, page + 1);
            
            for (let i = start; i <= end; i++) {
                pages.push(i);
            }
            
            if (page < totalPages - 3) {
                pages.push('ellipsis');
            }
            
            // Always show last page
            if (totalPages > 1) {
                pages.push(totalPages);
            }
        }
        
        return pages;
    };

    const pageNumbers = getPageNumbers();

    return (
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            {/* Results info */}
            <div className="flex items-center gap-4 text-sm text-white/60">
                <span>
                    Showing {Math.min((page - 1) * limit + 1, total)} to {Math.min(page * limit, total)} of {total} orders
                </span>
                
                {/* Page size selector */}
                <div className="flex items-center gap-2">
                    <span className="text-white/40">Show:</span>
                    <div className="relative">
                        <select
                            value={limit}
                            onChange={(e) => onLimitChange(parseInt(e.target.value, 10))}
                            disabled={isLoading}
                            className="appearance-none px-3 py-2 pr-8 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/90 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white/[0.15] focus:border-white/[0.2] hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
                            style={{
                                backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23ffffff' stroke-opacity='0.4' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                                backgroundPosition: 'right 0.5rem center',
                                backgroundRepeat: 'no-repeat',
                                backgroundSize: '1rem'
                            }}
                        >
                            <option value={5} className="bg-gray-900 text-white">5</option>
                            <option value={10} className="bg-gray-900 text-white">10</option>
                            <option value={20} className="bg-gray-900 text-white">20</option>
                            <option value={50} className="bg-gray-900 text-white">50</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Pagination controls */}
            <div className="flex items-center gap-2">
                {/* Previous button */}
                <button
                    onClick={() => onPageChange(page - 1)}
                    disabled={!hasPrevPage || isLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/80 hover:bg-white/[0.08] hover:border-white/[0.15] hover:text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/[0.03] disabled:hover:border-white/[0.08] disabled:hover:text-white/80"
                >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Previous</span>
                </button>

                {/* Page numbers */}
                <div className="flex items-center gap-1">
                    {pageNumbers.map((pageNum, index) => {
                        if (pageNum === 'ellipsis') {
                            return (
                                <div key={`ellipsis-${index}`} className="px-3 py-2 text-white/40">
                                    <MoreHorizontal className="h-4 w-4" />
                                </div>
                            );
                        }

                        const isCurrentPage = pageNum === page;
                        
                        return (
                            <button
                                key={pageNum}
                                onClick={() => onPageChange(pageNum)}
                                disabled={isLoading}
                                className={`px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-50 ${
                                    isCurrentPage
                                        ? 'bg-white/[0.12] border border-white/[0.25] text-white shadow-lg'
                                        : 'bg-white/[0.03] border border-white/[0.08] text-white/70 hover:bg-white/[0.08] hover:border-white/[0.15] hover:text-white'
                                }`}
                            >
                                {pageNum}
                            </button>
                        );
                    })}
                </div>

                {/* Next button */}
                <button
                    onClick={() => onPageChange(page + 1)}
                    disabled={!hasNextPage || isLoading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-white/80 hover:bg-white/[0.08] hover:border-white/[0.15] hover:text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/[0.03] disabled:hover:border-white/[0.08] disabled:hover:text-white/80"
                >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>

            {/* Loading indicator */}
            {isLoading && (
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center backdrop-blur-sm rounded-2xl">
                    <div className="flex items-center gap-3 text-sm text-white/70">
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
                        <span>Loading orders...</span>
                    </div>
                </div>
            )}
        </div>
    );
}