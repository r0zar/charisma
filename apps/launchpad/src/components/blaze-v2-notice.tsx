import { Sparkles } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

/** Tells subnet makers that new subnets are Blaze v2, and that a v1 subnet needs a fresh deploy to move over */
export function BlazeV2Notice({ className }: { className?: string }) {
    return (
        <Alert variant="info" className={className}>
            <AlertTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> We&apos;ve upgraded to Blaze v2
            </AlertTitle>
            <AlertDescription className="text-foreground/80">
                New subnets now use Blaze v2: safer signatures, cancel for good, and bearer notes. Made a subnet before
                Oct 2, 2026? It keeps working on v1. To move your token to v2, deploy a new subnet and a new sublink
                for it here.{' '}
                <a href="https://docs.charisma.rocks/docs/blaze-api/blaze-v2" target="_blank" rel="noreferrer" className="underline text-accent-text">
                    What changed
                </a>
            </AlertDescription>
        </Alert>
    );
}
