import ContactPageClient from './ContactPageClient';

export default function ContactPage({
    searchParams,
}: {
    searchParams: { service?: string, name?: string };
}) {
    return (
        <div suppressHydrationWarning>
            <ContactPageClient
                initialService={searchParams.service || null}
                initialName={searchParams.name || null}
            />
        </div>
    );
} 