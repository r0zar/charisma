// src/app/docs/page.tsx
import Link from "next/link";
import { CopyButton } from "@/components/ui/copy-button";

export const metadata = {
    title: "Charisma Metadata – Developer Guide",
    description:
        "Flat-file JSON hosting for fungible-token and NFT metadata on Stacks.",
};

/* ——— reusable code block ——— */
const Code = ({ code, lang = "" }: { code: string; lang?: string }) => (
    <div className="group relative my-6 overflow-hidden rounded-lg border border-border bg-muted/5">
        <pre className="overflow-x-auto whitespace-pre-wrap p-4 text-sm leading-6">
            <code className={`language-${lang}`}>{code.trim()}</code>
        </pre>
        <CopyButton textToCopy={code.trim()} />
    </div>
);

/* ——— helper ——— */
const H2 = ({ id, children }: { id: string; children: React.ReactNode }) => (
    <h2 id={id} className="scroll-mt-24 text-2xl font-bold mt-10 mb-4 border-b border-border pb-2">
        {children}
    </h2>
);

export default function DocsPage() {
    /* snippets */
    const schemaFT = `
{
  "name": "B-CHA LP Token",
  "symbol": "B-CHA-LP",
  "decimals": 6,
  "identifier": "B-CHA-LP",
  "description": "Liquidity pool token for the B-CHA pair",
  "image": "https://kghatiwehgh3dclz.public.blob.vercel-storage.com/SP2ZNGJ85ENDY6...",
  "properties": {
    "tokenAContract": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.beri",
    "tokenBContract": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token",
    "swapFeePercent": 1
  }
}`;
    const schemaNFT = `
{
  "name":  "Wizard #123",
  "symbol": "WZRD",
  "description": "Hand-drawn pixel wizard.",
  "image": "ipfs://bafy.../wizard-123.png",
  "attributes": [
    { "trait_type": "Hat", "value": "Moonstone" },
    { "trait_type": "Staff", "value": "Oak" }
  ]
}`;
    const curlUpload = `
curl -X POST \
  https://charisma.app/api/v1/metadata/SP2...XYZ.stkr \
  -H 'content-type: application/json' \
  -H 'x-signature: SIGNATURE' \
  -H 'x-public-key: PUBKEY' \
  --data '${schemaFT}'`;
    const curlUploadApiKey = `
curl -X POST \
  https://charisma.app/api/v1/metadata/SP2...XYZ.stkr \
  -H 'content-type: application/json' \
  -H 'x-api-key: YOUR_API_KEY' \
  --data '${schemaFT}'`;
    const curlFetch =
        "curl https://charisma.app/api/v1/metadata/SP2...XYZ.stkr";

    return (
        <div className="container grid max-w-6xl grid-cols-1 gap-12 py-12 lg:grid-cols-[220px_1fr]">
            {/* TOC */}
            <aside className="sticky top-24 hidden h-[calc(100vh-6rem)] lg:block">
                <ul className="space-y-2 text-sm">
                    {[
                        ["why", "Why Charisma Metadata?"],
                        ["quick", "Quick-start"],
                        ["schema", "Metadata Schema"],
                        ["api", "REST API"],
                        ["security", "Signature Security"],
                        ["tips", "Tips & Limits"],
                    ].map(([id, label]) => (
                        <li key={id}>
                            <a
                                href={`#${id}`}
                                className="block rounded px-2 py-1 hover:bg-accent transition-colors"
                            >
                                {label}
                            </a>
                        </li>
                    ))}
                </ul>
            </aside>

            {/* content */}
            <article className="prose prose-lg max-w-none dark:prose-invert prose-headings:font-semibold prose-p:leading-relaxed prose-li:my-1">
                <h1 className="text-4xl font-bold mb-6">Charisma Metadata</h1>
                <p className="lead text-xl mb-8 text-muted-foreground">
                    A dead-simple JSON host for fungible-token and NFT metadata on the
                    Stacks blockchain. No IPFS pinning, no SQL—just flat files served from
                    our CDN.
                </p>

                {/* why */}
                <H2 id="why">Why Charisma Metadata?</H2>
                <ul className="space-y-2 my-6">
                    <li className="flex items-baseline gap-2">
                        <strong className="text-primary">Flat-file speed</strong>
                        <span className="text-muted-foreground">→ served straight from edge storage.</span>
                    </li>
                    <li className="flex items-baseline gap-2">
                        <strong className="text-primary">Wallet-signed writes</strong>
                        <span className="text-muted-foreground">→ only the contract owner can mutate records.</span>
                    </li>
                    <li className="flex items-baseline gap-2">
                        <strong className="text-primary">Schema-light</strong>
                        <span className="text-muted-foreground">→ any JSON keys are accepted; we surface common ones in UI.</span>
                    </li>
                    <li className="flex items-baseline gap-2">
                        <strong className="text-primary">No gas</strong>
                        <span className="text-muted-foreground">→ metadata lives off-chain; your on-chain contract stores only a URL.</span>
                    </li>
                </ul>

                {/* quick */}
                <H2 id="quick">Quick-start</H2>
                <ol className="list-decimal pl-5 space-y-2 my-6">
                    <li className="text-base leading-relaxed">
                        Connect your wallet in the{" "}
                        <Link href="/tokens" className="text-primary hover:underline">
                            Token Dashboard
                        </Link>
                        .
                    </li>
                    <li className="text-base leading-relaxed">Create or select a token entry.</li>
                    <li className="text-base leading-relaxed">Edit the JSON; press Save → sign the message.</li>
                    <li className="text-base leading-relaxed">
                        Your metadata is now reachable at
                        <code className="px-1 bg-muted rounded text-sm"> /api/v1/metadata/&lt;contractId&gt;</code>
                    </li>
                </ol>

                {/* schema */}
                <H2 id="schema">Metadata Schema</H2>
                <p className="my-4">
                    We store raw JSON. Two informal shapes are recognised for nicer UI:
                </p>

                <h3 className="text-xl font-semibold mt-8 mb-4">Fungible Token (FT)</h3>
                <Code code={schemaFT} lang="json" />

                <h3 className="text-xl font-semibold mt-8 mb-4">NFT</h3>
                <Code code={schemaNFT} lang="json" />

                {/* api */}
                <H2 id="api">REST API</H2>
                <p className="my-4">
                    Base URL :{" "}
                    <code className="px-1 bg-muted rounded text-sm">https://charisma.app/api/v1/metadata/&#123;contractId&#125;</code>
                </p>

                <table className="w-full my-6 border-collapse">
                    <thead>
                        <tr className="border-b border-border">
                            <th className="py-3 px-4 text-left font-semibold">Method</th>
                            <th className="py-3 px-4 text-left font-semibold">Purpose</th>
                            <th className="py-3 px-4 text-left font-semibold">Headers</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-border/50">
                            <td className="py-3 px-4"><code className="px-1 bg-muted rounded text-sm">GET</code></td>
                            <td className="py-3 px-4">Fetch metadata JSON</td>
                            <td className="py-3 px-4">None</td>
                        </tr>
                        <tr className="border-b border-border/50">
                            <td className="py-3 px-4"><code className="px-1 bg-muted rounded text-sm">POST</code></td>
                            <td className="py-3 px-4">Create / replace JSON</td>
                            <td className="py-3 px-4"><code className="px-1 bg-muted rounded text-sm">x-signature</code>, <code className="px-1 bg-muted rounded text-sm">x-public-key</code> <br /> or <code className="px-1 bg-muted rounded text-sm">x-api-key</code></td>
                        </tr>
                        <tr className="border-b border-border/50">
                            <td className="py-3 px-4"><code className="px-1 bg-muted rounded text-sm">DELETE</code></td>
                            <td className="py-3 px-4">Delete record</td>
                            <td className="py-3 px-4"><code className="px-1 bg-muted rounded text-sm">x-signature</code>, <code className="px-1 bg-muted rounded text-sm">x-public-key</code></td>
                        </tr>
                    </tbody>
                </table>

                <h4 className="text-lg font-semibold mt-8 mb-4">Example POST (with Signature)</h4>
                <Code code={curlUpload} lang="bash" />

                <h4 className="text-lg font-semibold mt-8 mb-4">Example POST (with API Key)</h4>
                <Code code={curlUploadApiKey} lang="bash" />

                <h4 className="text-lg font-semibold mt-8 mb-4">Example GET</h4>
                <Code code={curlFetch} lang="bash" />

                {/* security */}
                <H2 id="security">Signature Security</H2>
                <p className="my-4">
                    Every mutating request (POST, DELETE) must be authenticated. There are two methods:
                </p>
                <h3 className="text-xl font-semibold mt-6 mb-3">1. Wallet Signature (Preferred for dApp Integrations)</h3>
                <p className="my-4">
                    Include an{" "}
                    <code className="px-1 bg-muted rounded text-sm">x-signature</code> header—an RSV signature of the{" "}
                    <em>contractId</em> string—plus <code className="px-1 bg-muted rounded text-sm">x-public-key</code>. On the
                    server we:
                </p>
                <ol className="list-decimal pl-5 space-y-2 my-6">
                    <li className="text-base leading-relaxed">Verify the signature.</li>
                    <li className="text-base leading-relaxed">Derive the Stacks address from the public key.</li>
                    <li className="text-base leading-relaxed">
                        Ensure it matches the <strong>contract address</strong>{" "}
                        (<code className="px-1 bg-muted rounded text-sm">SP…</code> prefix before the dot).
                    </li>
                </ol>
                <p className="my-4">If any step fails → <code className="px-1 bg-muted rounded text-sm">401 Unauthorized</code>.</p>

                <h3 className="text-xl font-semibold mt-6 mb-3">2. API Key (Convenient for Server-to-Server)</h3>
                <p className="my-4">
                    Alternatively, for POST requests, you can use an API key. Include an{" "}
                    <code className="px-1 bg-muted rounded text-sm">x-api-key</code> header with your provisioned API key.
                    If this header is present and the key is valid, the signature and ownership verification steps are bypassed.
                    This method is useful for backend services or scripts where managing wallet signatures is cumbersome.
                    The API key is configured via the <code className="px-1 bg-muted rounded text-sm">METADATA_API_KEY</code> environment variable on the server.
                </p>

                {/* tips */}
                <H2 id="tips">Tips & Limits</H2>
                <ul className="space-y-2 my-6">
                    <li className="flex items-baseline gap-2">
                        Max body size: <strong>32 KB</strong>
                    </li>
                    <li className="flex items-baseline gap-2">
                        Images: <strong>uploaded and hosted</strong> directly by this app—no need for external hosting.
                    </li>
                    <li className="flex items-baseline gap-2">
                        Write cache: propagation to edge nodes ≤{" "}
                        <strong>2&nbsp;seconds</strong>.
                    </li>
                    <li className="flex items-baseline gap-2">
                        Versioning: coming soon (immutable URL per commit).
                    </li>
                </ul>
            </article>
        </div>
    );
}
