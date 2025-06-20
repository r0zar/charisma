'use client';

import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { ADMIN_CONFIG } from '@/lib/admin-config';
import ChartDataDiagnostics from '@/components/admin/ChartDataDiagnostics';

function ChartDiagnosticsContent() {
    return (
        <div className={`mx-auto px-4 py-8 ${ADMIN_CONFIG.MAX_WIDTH.ADMIN_MAIN} w-full`}>
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-foreground mb-2">
                    Chart Data Diagnostics
                </h1>
                <p className="text-muted-foreground">
                    Diagnose and test conditional token chart data loading and display issues
                </p>
            </div>

            <ChartDataDiagnostics />
        </div>
    );
}

function ChartDiagnosticsFallback() {
    return (
        <div className={`mx-auto px-4 py-8 ${ADMIN_CONFIG.MAX_WIDTH.ADMIN_MAIN} w-full`}>
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-foreground mb-2">
                    Chart Data Diagnostics
                </h1>
                <p className="text-muted-foreground">
                    Loading diagnostics tools...
                </p>
            </div>
            <div className="flex justify-center items-center py-12">
                <div className="h-8 w-8 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            </div>
        </div>
    );
}

export default function ChartDiagnosticsPage() {
    return (
        <Suspense fallback={<ChartDiagnosticsFallback />}>
            <ChartDiagnosticsContent />
        </Suspense>
    );
}