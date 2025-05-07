"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useWallet } from "@/context/wallet-context"
import { generateUUID, BLAZE_PROTOCOL_NAME, BLAZE_PROTOCOL_VERSION, WELSH_CREDITS_CONTRACT, WELSHCORGICOIN_CONTRACT } from "@/constants/contracts"
import { STACKS_MAINNET, type StacksNetwork } from "@stacks/network"
import {
    uintCV,
    principalCV,
    stringAsciiCV,
    tupleCV,
    optionalCVOf,
    noneCV,
    TupleCV,
    TupleData,
    ClarityValue,
} from "@stacks/transactions"
import { request, SignatureData } from "@stacks/connect"
import { Loader2 } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { getTokenMetadataCached } from "@repo/tokens"
import { StatCard } from "@/components/ui/stat-card"
import { Alert } from "@/components/ui/alert"

export default function StablecoinPage() {
    const { connected, address: walletAddr } = useWallet()
    const network: StacksNetwork = STACKS_MAINNET

    const [usdAmount, setUsdAmount] = useState(100) // User inputs USD value
    const [boundTokens, setBoundTokens] = useState(0)
    const [marginPct, setMarginPct] = useState(10) // user-selected margin percentage
    const [tokensNeededAtomic, setTokensNeededAtomic] = useState<number>(0)
    const [price, setPrice] = useState<number | null>(null)
    const [decimals, setDecimals] = useState<number>(6)
    const [depositSig, setDepositSig] = useState<string | null>(null)
    const [depositUuid, setDepositUuid] = useState<string | null>(null)
    const [withdrawSig, setWithdrawSig] = useState<string | null>(null)
    const [withdrawUuid, setWithdrawUuid] = useState<string | null>(null)
    const [isSigning, setIsSigning] = useState(false)
    const [status, setStatus] = useState<string | null>(null)
    const [balance, setBalance] = useState<number | null>(null)
    const [supply, setSupply] = useState<number | null>(null)
    const [stableBal, setStableBal] = useState<number | null>(null)
    const [stableSupply, setStableSupply] = useState<number | null>(null)
    const [feeTokens, setFeeTokens] = useState<number>(0)
    const [feePoolToken, setFeePoolToken] = useState<number>(0)
    const [feePoolUsd, setFeePoolUsd] = useState<number>(0)
    const [collateralInput, setCollateralInput] = useState<string>("1000000") // human tokens

    // Helper – converts token integer (6 decimals) into uintCV
    const toUintCV = (val: number) => uintCV(BigInt(Math.floor(val)))

    // Fetch WELSH price from server action API
    React.useEffect(() => {
        async function fetchPrice() {
            try {
                const res = await fetch(`/api/prices/${WELSHCORGICOIN_CONTRACT}`)
                const json = await res.json()
                if (res.ok && json.price) {
                    setPrice(json.price as number)
                }
            } catch (err) {
                console.error('Price fetch error', err)
            }
        }

        async function fetchMeta() {
            try {
                const meta = await getTokenMetadataCached(WELSH_CREDITS_CONTRACT)
                if (typeof meta.decimals === 'number') setDecimals(meta.decimals)
            } catch (err) { console.error('Meta fetch error', err) }
        }
        fetchPrice(); fetchMeta()
    }, [])

    const factor = React.useMemo(() => 10 ** decimals, [decimals])
    const collateralUsd = (supply != null ? (supply + feePoolToken) * (price || 0) / factor : 0)
    const stableUsd = stableSupply != null ? stableSupply / 100 : 0
    const collateralRatioPercent = stableUsd > 0 ? (collateralUsd / stableUsd) * 100 : 0
    const bufferPercent = stableUsd > 0 ? (stableUsd / collateralUsd) * 100 : 0 - 250

    // Auto-calculate boundTokens when price or usdAmount changes
    React.useEffect(() => {
        if (!price || usdAmount <= 0) return
        const tokensNeeded = (usdAmount / price) * factor
        const fee = Math.ceil(tokensNeeded * 0.01)
        const totalTokens = tokensNeeded + fee
        const withMargin = Math.ceil(totalTokens * (1 + marginPct / 100))
        setBoundTokens(withMargin)
        setTokensNeededAtomic(Math.ceil(tokensNeeded))
        setFeeTokens(Math.ceil(fee))
    }, [price, usdAmount, marginPct, factor])

    // Fetch balances whenever wallet connected or after actions
    const refreshBalances = React.useCallback(async () => {
        if (!walletAddr) return
        try {
            const res = await fetch(`/api/stablecoin/balance?address=${walletAddr}`)
            const json = await res.json()
            if (res.ok) {
                setBalance(json.balance)
                setSupply(json.totalSupply)
                setStableBal(json.stableBalance)
                setStableSupply(json.stableSupply)
                setFeePoolUsd(json.usdFeePool)
            }
        } catch (err) { console.error('balance fetch error', err) }
    }, [walletAddr])

    React.useEffect(() => { refreshBalances() }, [refreshBalances])

    const generateDepositSignature = async (): Promise<boolean> => {
        if (!connected) {
            setStatus("Connect wallet first")
            return false
        }
        if (!boundTokens || boundTokens <= 0) {
            setStatus("Provide an upper bound of tokens")
            return false
        }

        setIsSigning(true)
        setStatus("Requesting wallet signature…")

        try {
            const newUuid = generateUUID()

            // SIP-018 domain
            const domain = tupleCV({
                name: stringAsciiCV(BLAZE_PROTOCOL_NAME),
                version: stringAsciiCV(BLAZE_PROTOCOL_VERSION),
                "chain-id": uintCV(network.chainId),
            })

            // Message payload for TRANSFER_TOKENS
            const message = tupleCV({
                contract: principalCV(WELSH_CREDITS_CONTRACT),
                intent: stringAsciiCV("TRANSFER_TOKENS"),
                opcode: noneCV(),
                amount: optionalCVOf(uintCV(BigInt(boundTokens))),
                target: optionalCVOf(principalCV("SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.stable-welsh-vault-rc1")), // recipient is caller
                uuid: stringAsciiCV(newUuid),
            })

            const signResp: SignatureData = await request("stx_signStructuredMessage", {
                domain: domain as TupleCV<TupleData<ClarityValue>>,
                message: message as TupleCV<TupleData<ClarityValue>>,
            })

            if (!signResp || !signResp.signature) throw new Error("No signature returned")

            setDepositSig(`0x${signResp.signature}`)
            setDepositUuid(newUuid)
            setStatus("Deposit signature generated ✅")
            return true
        } catch (err) {
            console.error(err)
            setStatus(err instanceof Error ? err.message : String(err))
        } finally {
            setIsSigning(false)
        }
        return false
    }

    const handleDeposit = async () => {
        if (!walletAddr) {
            setStatus("Connect wallet")
            return
        }
        if (!depositSig || !depositUuid) {
            const ok = await generateDepositSignature()
            if (!ok) return
        }

        try {
            setStatus("Submitting deposit…")
            const res = await fetch('/api/stablecoin/deposit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    usdAmount, boundTokens,
                    sender: walletAddr,
                    signatureHex: depositSig,
                    uuid: depositUuid,
                    tokenContractId: WELSHCORGICOIN_CONTRACT
                }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Deposit failed')
            setStatus(`Deposited ${(json.tokensDeposited / factor).toLocaleString(undefined, { maximumFractionDigits: decimals })} WELSH. New balance: ${(json.newBalance / factor).toLocaleString(undefined, { maximumFractionDigits: decimals })} WELSH`)
            setDepositSig(null); setDepositUuid(null)
            await refreshBalances()
        } catch (err) {
            setStatus(err instanceof Error ? err.message : String(err))
        }
    }

    const generateWithdrawSignature = async (): Promise<boolean> => {
        if (!connected) {
            setStatus("Connect wallet first")
            return false
        }
        if (!usdAmount || usdAmount <= 0) {
            setStatus("Provide a USD amount")
            return false
        }

        setIsSigning(true)
        setStatus("Requesting wallet signature…")

        try {
            const newUuid = generateUUID()

            const domain = tupleCV({
                name: stringAsciiCV(BLAZE_PROTOCOL_NAME),
                version: stringAsciiCV(BLAZE_PROTOCOL_VERSION),
                "chain-id": uintCV(network.chainId),
            })

            const message = tupleCV({
                contract: principalCV("SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.stable-welsh-rc1"),
                intent: stringAsciiCV("TRANSFER_TOKENS"),
                opcode: noneCV(),
                amount: optionalCVOf(uintCV(BigInt(tokensNeededAtomic))),
                target: optionalCVOf(principalCV("SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.stable-welsh-vault-rc1")),
                uuid: stringAsciiCV(newUuid),
            })

            const signResp: SignatureData = await request("stx_signStructuredMessage", {
                domain: domain as TupleCV<TupleData<ClarityValue>>, message: message as TupleCV<TupleData<ClarityValue>>,
            })

            if (!signResp || !signResp.signature) throw new Error('No signature returned')

            setWithdrawSig(`0x${signResp.signature}`)
            setWithdrawUuid(newUuid)
            setStatus('Withdraw signature generated ✅')
            return true
        } catch (err) {
            console.error(err)
            setStatus(err instanceof Error ? err.message : String(err))
        } finally {
            setIsSigning(false)
        }
        return false
    }

    const handleWithdraw = async () => {
        if (!walletAddr) { setStatus('Connect wallet'); return }
        if (!withdrawSig || !withdrawUuid) {
            const ok = await generateWithdrawSignature()
            if (!ok) return
        }
        try {
            setStatus('Submitting withdraw…')
            const res = await fetch('/api/stablecoin/withdraw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    usdAmount, sender: walletAddr,
                    withdrawSig, withdrawUuid,
                    tokenContractId: WELSHCORGICOIN_CONTRACT
                }),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Withdraw failed')
            setStatus(`Withdrew ${(json.tokensWithdrawn / factor).toLocaleString(undefined, { maximumFractionDigits: decimals })} WELSH. New balance: ${(json.newBalance / factor).toLocaleString(undefined, { maximumFractionDigits: decimals })} WELSH`)
            setWithdrawSig(null); setWithdrawUuid(null)
            await refreshBalances()
        } catch (err) {
            setStatus(err instanceof Error ? err.message : String(err))
        }
    }

    const handleCollateralDeposit = async () => {
        if (!walletAddr) { setStatus('Connect wallet'); return }
        const amt = parseFloat(collateralInput)
        if (!amt || amt <= 0) { setStatus('Invalid amount'); return }
        const atomic = Math.floor(amt * factor)
        try {
            setStatus('Depositing collateral…')
            const res = await fetch('/api/stablecoin/collateral/deposit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tokenContractId: WELSHCORGICOIN_CONTRACT, amountTokens: atomic, sender: walletAddr })
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Deposit fail')
            setStatus(`Collateral deposited. New balance ${(json.newBalance / factor).toLocaleString()}`)
            setCollateralInput("")
            await refreshBalances()
        } catch (err) { setStatus(err instanceof Error ? err.message : String(err)) }
    }

    const handleCollateralWithdraw = async () => {
        if (!walletAddr) { setStatus('Connect wallet'); return }
        const amt = parseFloat(collateralInput)
        if (!amt || amt <= 0) { setStatus('Invalid amount'); return }
        const atomic = Math.floor(amt * factor)
        try {
            setStatus('Withdrawing collateral…')
            const res = await fetch('/api/stablecoin/collateral/withdraw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tokenContractId: WELSHCORGICOIN_CONTRACT, amountTokens: atomic, sender: walletAddr })
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || 'Withdraw fail')
            setStatus(`Collateral withdrawn. New balance ${(json.newBalance / factor).toLocaleString()}`)
            setCollateralInput("")
            await refreshBalances()
        } catch (err) { setStatus(err instanceof Error ? err.message : String(err)) }
    }

    return (
        <div className="container py-8 max-w-2xl">
            <h1 className="text-3xl font-bold mb-6">Blaze Stablecoins</h1>

            <div className="mb-6 rounded-md border p-4 text-sm bg-muted/10">
                <p className="mb-2 font-medium">How it works</p>
                <ul className="list-disc pl-5 space-y-1">
                    <li><span className="font-semibold">Permissionless collateral:</span> anyone can deposit WELSH into the vault at any time (see "Provide / Withdraw WELSH" below) and instantly boost the system collateral ratio.</li>
                    <li>When you supply collateral you keep ownership – your personal WELSH balance increases and can be withdrawn whenever the system remains above the 250&nbsp;% requirement.</li>
                    <li>Every USD stable that is minted must leave the vault at <span className="font-semibold">≥ 250&nbsp;%</span> collateral.  If a mint would drop below this level it is rejected automatically.</li>
                    <li>A <span className="font-semibold">1 % fee</span> is collected on every mint (in WELSH) and every redeem (in USD).</li>
                    <li>Mint-fees are <span className="font-semibold">rebated</span> to all WELSH providers automatically, proportional to the amount of collateral they have supplied – watch your "Your WELSH" card grow when new USD is minted.</li>
                    <li>USD redeem-fees accumulate in a pool that is periodically used to <span className="font-semibold">market-buy WELSH on the DEX</span>; the purchased WELSH is sent to the vault and automatically distributed to all collateral providers.</li>
                </ul>
            </div>

            {status && (
                <Alert variant={/(error|failed|insufficient|rejected)/i.test(status) ? 'destructive' : 'default'} className="mb-6">
                    {status}
                </Alert>
            )}

            {walletAddr && (
                <div className="space-y-6 mb-6">
                    {/* User balances */}
                    <div>
                        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Your Balances</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <StatCard title="Your Deposited Collateral" icon="coins" value={balance != null ? (balance / factor).toLocaleString(undefined, { maximumFractionDigits: decimals }) + ' WELSH' : '…'} />
                            <StatCard title="Your USD Stablecoins" icon="dollar" value={stableBal != null ? (stableBal / 100).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 }) + ' USD' : '…'} />
                        </div>
                    </div>

                    {/* Platform metrics */}
                    <div>
                        <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Platform Metrics</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard title="WELSH Supply" icon="database" value={supply != null ? (supply / factor).toLocaleString(undefined, { maximumFractionDigits: decimals }) : '…'} />
                            <StatCard title="WELSH Supply USD" icon="dollar" value={price && supply != null ? collateralUsd.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' USD' : '…'} />
                            <StatCard title="Stable Supply" icon="bank" value={stableSupply != null ? (stableSupply / 100).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 }) + ' USD' : '…'} />
                            <StatCard title="USD Fees" icon="dollar" value={feePoolUsd != null ? (feePoolUsd / 100).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 }) : '…'} />
                            <StatCard title="Collateral Ratio" icon="shield" value={stableUsd ? collateralRatioPercent.toFixed(1) + '%' : '…'} />
                            <StatCard title="Current / Maximum" icon="alert" value={stableUsd ? bufferPercent.toFixed(1) + '% / 250%' : '…'} />
                        </div>
                    </div>
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Mint USD Stablecoins</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <label htmlFor="usd-amount" className="block text-sm font-medium mb-1">
                            USD Amount ($)
                        </label>
                        <Input
                            id="usd-amount"
                            type="number"
                            min={0}
                            step="0.01"
                            value={usdAmount}
                            onChange={(e) => setUsdAmount(Number(e.target.value))}
                            placeholder="1.00"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="marginSlider">Slippage / Margin (%)</Label>
                        <Slider
                            id="marginSlider"
                            min={0}
                            max={20}
                            step={1}
                            value={[marginPct]}
                            onValueChange={(val) => setMarginPct(val[0])}
                        />
                        <p className="text-sm text-muted-foreground">Current margin: {marginPct}%</p>

                        {price && usdAmount > 0 && (
                            <div className="mt-4 p-2 rounded bg-muted/10 border text-sm">
                                <p>
                                    Estimated tokens needed: {(tokensNeededAtomic / factor).toLocaleString(undefined, { maximumFractionDigits: decimals })} WELSH
                                </p>
                                <p>
                                    Fee (1%): {(feeTokens / factor).toLocaleString(undefined, { maximumFractionDigits: decimals })} WELSH
                                </p>
                                <p>
                                    Upper bound with margin ({marginPct}%): {(boundTokens / factor).toLocaleString(undefined, { maximumFractionDigits: decimals })} WELSH
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">(1 WELSH ≈ ${price?.toFixed(4)})</p>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <Button onClick={handleDeposit} disabled={isSigning || !usdAmount || !price}>
                            Mint
                        </Button>
                        <Button variant="secondary" onClick={handleWithdraw} disabled={isSigning || !usdAmount || !price}>
                            Redeem
                        </Button>
                    </div>

                    {(depositSig && depositUuid) && (
                        <div className="mt-4 space-y-1 text-xs bg-muted/10 p-2 rounded border">
                            <p className="text-muted-foreground">Signature (hex):</p>
                            <code className="break-all block">{depositSig}</code>
                            <p className="text-muted-foreground mt-1">UUID:</p>
                            <code className="break-all block">{depositUuid}</code>
                        </div>
                    )}

                    {withdrawSig && withdrawUuid && (
                        <div className="mt-4 space-y-1 text-xs bg-muted/10 p-2 rounded border">
                            <p className="text-muted-foreground">Signature (hex):</p>
                            <code className="break-all block">{withdrawSig}</code>
                            <p className="text-muted-foreground mt-1">UUID:</p>
                            <code className="break-all block">{withdrawUuid}</code>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Collateral management */}
            <Card className="mt-8">
                <CardHeader>
                    <CardTitle>Provide / Withdraw WELSH Collateral</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Input
                        type="number"
                        min={0}
                        step="0.000001"
                        placeholder="100.0 WELSH"
                        value={collateralInput}
                        onChange={(e) => setCollateralInput(e.target.value)}
                    />
                    <div className="flex gap-4">
                        <Button onClick={handleCollateralDeposit} disabled={!collateralInput}>Deposit WELSH</Button>
                        <Button variant="secondary" onClick={handleCollateralWithdraw} disabled={!collateralInput}>Withdraw WELSH</Button>
                    </div>
                </CardContent>
            </Card>

            {walletAddr && (
                <p className="text-xs text-muted-foreground text-right mt-4">
                    <button className="underline hover:text-primary" onClick={async () => { await fetch('/api/stablecoin/reset', { method: 'POST' }); refreshBalances(); setStatus('All balances reset') }}>
                        Admin reset
                    </button>
                </p>
            )}
        </div>
    )
} 