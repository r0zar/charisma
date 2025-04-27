import React from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

// This component might be deprecated or refactored further.
// It no longer needs props if the state is managed by the Dialog in InstructionsButton.
const InstructionsOverlayContent = () => {
    return (
        <>
            {/* Close button logic would be handled by DialogClose in InstructionsButton */}
            <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none">
                {/* Content remains the same */}
                <h2 className="text-2xl md:text-3xl font-bold text-center mb-6 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/80">Welcome to the Group Token Pumper!</h2>
                <p className="text-center mb-6">
                    Get ready for a collective meme coin pump! Join everyone in committing <span className="font-semibold text-primary numeric">CHA</span> to influence which token gets the big buy. Here's the plan:
                </p>
                <ol className="list-decimal space-y-6 pl-5">
                    <li className="glass-card p-4 rounded-xl">
                        <strong className="text-primary">Commit Your CHA:</strong> Use your <span className="font-semibold text-primary numeric">CHA</span> balance to back the meme tokens you want to see pumped. The more <span className="font-semibold text-primary numeric">CHA</span> collectively committed to a token, the higher its chance of being selected for the pump!
                    </li>
                    <li className="glass-card p-4 rounded-xl">
                        <strong className="text-primary">The Selection:</strong> When the timer hits zero, the voting phase locks. A token is then chosen based on the total <span className="font-semibold text-primary numeric">CHA</span> committed to each one – more commitment means better odds.
                    </li>
                    <li className="glass-card p-4 rounded-xl animate-pulse-glow">
                        <strong className="text-primary">The Group Pump:</strong> ALL <span className="font-semibold text-primary numeric">CHA</span> committed by everyone this round is automatically used to market-buy the WINNING token! Everyone who committed receives the winning token equivalent to their committed <span className="font-semibold text-primary numeric">CHA</span> amount (executed based on commitment time order).
                    </li>
                </ol>
                <p className="text-center mt-8 font-semibold text-lg">
                    <span className="text-glow animate-pulse-medium">Rally together!</span> Which meme will get the pump? Commit your <span className="font-semibold text-primary numeric">CHA</span> and boost the odds!
                </p>
            </div>
            {/* Footer button logic is handled by DialogClose in InstructionsButton */}
        </>
    );
};

// Exporting the content might be useful if needed elsewhere, but the original
// InstructionsOverlay component is likely no longer needed as a standalone overlay.
// export default InstructionsOverlay; // Comment out or remove default export

export { InstructionsOverlayContent }; // Export the content part if potentially needed 