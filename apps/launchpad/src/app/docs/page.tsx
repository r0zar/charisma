// src/app/docs/page.tsx
import Link from "next/link";
import { CopyButton } from "@/components/ui/copy-button";

export const metadata = {
    title: "Charisma Launchpad – Developer Guide",
    description:
        "Deploy and manage Clarity smart contracts on the Stacks blockchain with ease.",
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
    const sip10TokenExample = `
(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.sip-010-trait-ft-standard.sip-010-trait)

(define-fungible-token example-token)

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-token-owner (err u101))

;; Read-only functions
(define-read-only (get-name)
  (ok "Example Token"))

(define-read-only (get-symbol)
  (ok "EXT"))

(define-read-only (get-decimals)
  (ok u6))

(define-read-only (get-balance (who principal))
  (ok (ft-get-balance example-token who)))

(define-read-only (get-total-supply)
  (ok (ft-get-supply example-token)))

(define-read-only (get-token-uri)
  (ok (some "https://charisma.app/api/v1/metadata/SP123...ABC.example-token")))

;; Minting and transferring
(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq tx-sender sender) err-not-token-owner)
    (try! (ft-transfer? example-token amount sender recipient))
    (match memo to-print (print to-print) 0x)
    (ok true)
  ))

(define-public (mint (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (ft-mint? example-token amount recipient)
  ))`;

    const liquidityPoolExample = `
;; Simple AMM Liquidity Pool
;; This is a simplified liquidity pool contract for illustration

(impl-trait 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.pool-trait.pool-trait)

(define-constant token-x-contract 'SP123...ABC.token-x)
(define-constant token-y-contract 'SP123...ABC.token-y)
(define-constant fee-bps u30) ;; 0.3% fee
(define-constant contract-owner tx-sender)

;; State management
(define-data-var token-x-balance uint u0)
(define-data-var token-y-balance uint u0)

;; Read-only functions
(define-read-only (get-info)
  (ok {
    token-x: token-x-contract,
    token-y: token-y-contract,
    balance-x: (var-get token-x-balance),
    balance-y: (var-get token-y-balance),
    fee-bps: fee-bps,
    owner: contract-owner
  })
)

;; Add liquidity
(define-public (add-liquidity (x-amount uint) (y-amount uint))
  (let (
    (x-balance (var-get token-x-balance))
    (y-balance (var-get token-y-balance))
  )
    ;; Transfer tokens to pool
    (try! (contract-call? token-x-contract transfer x-amount tx-sender (as-contract tx-sender) none))
    (try! (contract-call? token-y-contract transfer y-amount tx-sender (as-contract tx-sender) none))
    
    ;; Update balances
    (var-set token-x-balance (+ x-balance x-amount))
    (var-set token-y-balance (+ y-balance y-amount))
    
    (ok true)
  ))`;

    const deployExampleCurl = `
curl -X POST \\
  https://stacks-node-api.mainnet.stacks.co/v2/transactions \\
  -H 'Content-Type: application/json' \\
  -d '{
    "version": 0,
    "chain_id": 1,
    "auth": {
      "type": 2,
      "spent_condition": []
    },
    "anchor_mode": 3,
    "post_condition_mode": 2,
    "post_conditions": [],
    "payload": {
      "type": 2,
      "contract_name": "my-token",
      "code_body": "..."
    }
  }'`;

    return (
        <div className="container grid max-w-6xl grid-cols-1 gap-12 py-12 lg:grid-cols-[220px_1fr]">
            {/* TOC */}
            <aside className="sticky top-24 hidden h-[calc(100vh-6rem)] lg:block">
                <ul className="space-y-2 text-sm">
                    {[
                        ["why", "Why Charisma Launchpad?"],
                        ["quick", "Quick-start"],
                        ["templates", "Contract Templates"],
                        ["deploy", "Deploying Contracts"],
                        ["interact", "Interacting with Contracts"],
                        ["tips", "Tips & Best Practices"],
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
                <h1 className="text-4xl font-bold mb-6">Charisma Launchpad</h1>
                <p className="lead text-xl mb-8 text-muted-foreground">
                    A powerful platform for deploying and managing Clarity smart contracts on the Stacks blockchain. Create, deploy, and interact with fungible tokens, NFTs, and AMM pools with just a few clicks.
                </p>

                {/* why */}
                <H2 id="why">Why Charisma Launchpad?</H2>
                <ul className="space-y-2 my-6">
                    <li className="flex items-baseline gap-2">
                        <strong className="text-primary">No-code deployment</strong>
                        <span className="text-muted-foreground">→ deploy smart contracts without writing any code.</span>
                    </li>
                    <li className="flex items-baseline gap-2">
                        <strong className="text-primary">Pre-built templates</strong>
                        <span className="text-muted-foreground">→ standardized contracts for tokens, NFTs, and AMM pools.</span>
                    </li>
                    <li className="flex items-baseline gap-2">
                        <strong className="text-primary">Contract management</strong>
                        <span className="text-muted-foreground">→ easily interact with your deployed contracts through a simple UI.</span>
                    </li>
                    <li className="flex items-baseline gap-2">
                        <strong className="text-primary">Gas optimization</strong>
                        <span className="text-muted-foreground">→ our templates are optimized for minimal gas consumption.</span>
                    </li>
                </ul>

                {/* quick */}
                <H2 id="quick">Quick-start</H2>
                <ol className="list-decimal pl-5 space-y-2 my-6">
                    <li className="text-base leading-relaxed">
                        Connect your wallet in the{" "}
                        <Link href="/contracts" className="text-primary hover:underline">
                            Contracts Dashboard
                        </Link>
                        .
                    </li>
                    <li className="text-base leading-relaxed">Select a contract template (SIP-10 Token, NFT, or AMM Pool).</li>
                    <li className="text-base leading-relaxed">Configure the contract parameters.</li>
                    <li className="text-base leading-relaxed">Review and deploy your contract → sign the transaction.</li>
                    <li className="text-base leading-relaxed">
                        Your contract will be deployed to the Stacks blockchain and will appear in your dashboard.
                    </li>
                </ol>

                {/* templates */}
                <H2 id="templates">Contract Templates</H2>
                <p className="my-4">
                    We provide several pre-built templates to simplify your smart contract deployment:
                </p>

                <h3 className="text-xl font-semibold mt-8 mb-4">SIP-10 Fungible Token</h3>
                <p className="my-4">
                    Standard-compliant fungible tokens with customizable parameters:
                </p>
                <ul className="space-y-1 my-4 list-disc pl-5">
                    <li>Token name, symbol, and decimals</li>
                    <li>Initial supply and distribution</li>
                    <li>Minting and burning permissions</li>
                    <li>Metadata URI configuration</li>
                </ul>
                <Code code={sip10TokenExample} lang="clarity" />

                <h3 className="text-xl font-semibold mt-8 mb-4">Liquidity Pool (AMM)</h3>
                <p className="my-4">
                    Automated Market Maker pools for token swapping:
                </p>
                <ul className="space-y-1 my-4 list-disc pl-5">
                    <li>Constant product AMM (x * y = k)</li>
                    <li>Customizable fee structure</li>
                    <li>Liquidity provider token issuance</li>
                    <li>Swap, add liquidity, and remove liquidity functions</li>
                </ul>
                <Code code={liquidityPoolExample} lang="clarity" />

                {/* deploy */}
                <H2 id="deploy">Deploying Contracts</H2>
                <p className="my-4">
                    Our platform simplifies the deployment process with a user-friendly interface. Behind the scenes, we use the Stacks blockchain API to broadcast your contract deployment transaction.
                </p>

                <h3 className="text-xl font-semibold mt-8 mb-4">Deployment Process</h3>
                <ol className="list-decimal pl-5 space-y-2 my-6">
                    <li className="text-base leading-relaxed">Select a template and configure parameters</li>
                    <li className="text-base leading-relaxed">Review the generated contract code</li>
                    <li className="text-base leading-relaxed">Confirm deployment and sign the transaction</li>
                    <li className="text-base leading-relaxed">Wait for confirmation (typically 5-10 minutes)</li>
                </ol>

                <h3 className="text-xl font-semibold mt-8 mb-4">Advanced: API Integration</h3>
                <p className="my-4">
                    For developers who want to integrate with our platform programmatically:
                </p>
                <Code code={deployExampleCurl} lang="bash" />

                {/* interact */}
                <H2 id="interact">Interacting with Contracts</H2>
                <p className="my-4">
                    Once deployed, you can interact with your contracts directly from our dashboard:
                </p>
                <ul className="space-y-2 my-6">
                    <li className="flex items-baseline gap-2">
                        <strong className="text-primary">Call read-only functions</strong>
                        <span className="text-muted-foreground">→ check balances, token info, pool statistics.</span>
                    </li>
                    <li className="flex items-baseline gap-2">
                        <strong className="text-primary">Execute public functions</strong>
                        <span className="text-muted-foreground">→ transfer tokens, add liquidity, swap tokens.</span>
                    </li>
                    <li className="flex items-baseline gap-2">
                        <strong className="text-primary">Monitor transactions</strong>
                        <span className="text-muted-foreground">→ view transaction history and status.</span>
                    </li>
                    <li className="flex items-baseline gap-2">
                        <strong className="text-primary">View contract details</strong>
                        <span className="text-muted-foreground">→ see contract interface, source code, and deployment info.</span>
                    </li>
                </ul>

                {/* tips */}
                <H2 id="tips">Tips & Best Practices</H2>
                <ul className="space-y-2 my-6">
                    <li className="flex items-baseline gap-2">
                        <strong className="text-primary">Test on Testnet First</strong>
                        <span className="text-muted-foreground">→ Always deploy to testnet before mainnet to verify functionality.</span>
                    </li>
                    <li className="flex items-baseline gap-2">
                        <strong className="text-primary">Secure Owner Keys</strong>
                        <span className="text-muted-foreground">→ Contract owner privileges are tied to the deploying wallet.</span>
                    </li>
                    <li className="flex items-baseline gap-2">
                        <strong className="text-primary">Check Gas Requirements</strong>
                        <span className="text-muted-foreground">→ Ensure you have enough STX to cover deployment costs.</span>
                    </li>
                    <li className="flex items-baseline gap-2">
                        <strong className="text-primary">Set Appropriate Access Controls</strong>
                        <span className="text-muted-foreground">→ Carefully configure who can mint, burn, or modify your tokens.</span>
                    </li>
                </ul>
            </article>
        </div>
    );
}
