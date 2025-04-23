import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
    return (
        <div className="container flex flex-col items-center justify-center min-h-[70vh] text-center px-4 py-16">
            <h2 className="text-4xl font-bold mb-4">404</h2>
            <p className="text-xl mb-8">Page not found</p>
            <p className="text-muted-foreground mb-8 max-w-md">
                Sorry, we couldn't find the page you're looking for.
            </p>
            <Button asChild>
                <Link href="/">
                    Return to Home
                </Link>
            </Button>
        </div>
    );
} 