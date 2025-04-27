import React from 'react';
import { Lock } from 'lucide-react';

const LockOverlay = () => {
    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="text-center text-white p-8 bg-card/80 rounded-lg shadow-lg max-w-sm mx-4">
                <Lock className="h-12 w-12 mx-auto mb-4 text-yellow-400" strokeWidth={1.5} />
                <h2 className="text-2xl font-bold mb-2 text-card-foreground">Entries Locked</h2>
                <p className="text-muted-foreground">
                    The current round is closing soon. Ticket purchases are temporarily disabled.
                </p>
            </div>
        </div>
    );
};

export default LockOverlay;
