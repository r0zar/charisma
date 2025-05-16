import TokenPageClient from "./TokenPageClient";

export default function Page({
    searchParams,
}: {
    searchParams: { tokenId?: string };
}) {
    // pass the query down so the client side has it immediately
    return (
        <div suppressHydrationWarning>
            <TokenPageClient initialTokenId={searchParams.tokenId ?? ""} />
        </div>
    );
} 