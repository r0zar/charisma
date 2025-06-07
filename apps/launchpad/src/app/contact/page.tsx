import ContactPageClient from './ContactPageClient';

export default async function ContactPage({
    searchParams,
}: {
    searchParams: Promise<{ service?: string, name?: string }>;
}) {
    // Await the searchParams
    const params = await searchParams;

    return (
        <div suppressHydrationWarning>
            <ContactPageClient
                initialService={params.service || null}
                initialName={params.name || null}
            />
        </div>
    );
}