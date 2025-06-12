"use client";

import React, { useState } from 'react';
import { Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Button } from '../ui/button';
import { useProModeContext } from '../../contexts/pro-mode-context';
import SingleOrderPreview from './SingleOrderPreview';
import DCAOrderPreview from './DCAOrderPreview';
import SandwichOrderPreview from './SandwichOrderPreview';
import PerpetualOrderPreview from './PerpetualOrderPreview';

function OrderPreviewContent() {
    const { selectedOrderType } = useProModeContext();

    switch (selectedOrderType) {
        case 'single':
            return <SingleOrderPreview />;
        case 'dca':
            return <DCAOrderPreview />;
        case 'sandwich':
            return <SandwichOrderPreview />;
        case 'perpetual':
            return <PerpetualOrderPreview />;
        default:
            return <SingleOrderPreview />;
    }
}

function OrderPreviewContentMobile() {
    const { selectedOrderType } = useProModeContext();

    // For mobile dialog, we need to adapt the content to be full-width without fixed widths
    const mobileClass = "[&>div]:w-full [&>div]:max-w-none";

    switch (selectedOrderType) {
        case 'single':
            return <div className={mobileClass}><SingleOrderPreview /></div>;
        case 'dca':
            return <div className={mobileClass}><DCAOrderPreview /></div>;
        case 'sandwich':
            return <div className={mobileClass}><SandwichOrderPreview /></div>;
        case 'perpetual':
            return <div className={mobileClass}><PerpetualOrderPreview /></div>;
        default:
            return <div className={mobileClass}><SingleOrderPreview /></div>;
    }
}

export default function OrderPreview() {
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const { selectedOrderType } = useProModeContext();

    const getOrderTypeLabel = () => {
        switch (selectedOrderType) {
            case 'single':
                return 'Order Preview';
            case 'dca':
                return 'DCA Strategy Preview';
            case 'sandwich':
                return 'Sandwich Order Preview';
            case 'perpetual':
                return 'Position Preview';
            default:
                return 'Order Preview';
        }
    };

    return (
        <>
            {/* Desktop View - Shows normally on extra large screens */}
            <div className="hidden xl:block">
                <OrderPreviewContent />
            </div>

            {/* Mobile View - Info icon that opens dialog */}
            <div className="xl:hidden">
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full flex items-center justify-center gap-2 h-10"
                        >
                            <Info className="w-4 h-4" />
                            <span className="text-sm">View {getOrderTypeLabel()}</span>
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[90vw] max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Info className="w-5 h-5" />
                                {getOrderTypeLabel()}
                            </DialogTitle>
                        </DialogHeader>
                        <div className="py-4">
                            <OrderPreviewContentMobile />
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
} 