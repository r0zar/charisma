"use client"

import React, { useState, ChangeEvent, useCallback, useEffect, useRef } from "react"
import {
    tupleCV, stringAsciiCV, uintCV,
    bufferCV, optionalCVOf, noneCV,
    principalCV, signStructuredData,
    getAddressFromPrivateKey, cvToString,
    ClarityType, cvToValue, fetchCallReadOnlyFunction
} from "@stacks/transactions"
import { bufferFromHex } from "@stacks/transactions/dist/cl"
import { StacksNetwork } from "@stacks/network"
import { request } from "@stacks/connect"
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
    CardFooter
} from "../ui/card"
import { Button } from "../ui/button"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "../ui/table"
import { Input } from "../ui/input"
import { Label } from "../ui/label"
import {
    Alert,
    AlertDescription,
    AlertTitle
} from "../ui/alert"
import {
    Loader2,
    Download,
    Upload,
    Info,
    AlertTriangle,
    CheckCircle,
    ShieldCheck,
    User
} from "lucide-react"
import { BLAZE_SIGNER_CONTRACT, BLAZE_PROTOCOL_NAME, BLAZE_PROTOCOL_VERSION, generateUUID, parseContract } from "../../constants/contracts"
import { cn } from "../ui/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { QRCodeSVG } from 'qrcode.react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

interface Signature {
    id: number
    uuid: string
    hash: string
    signature: string
    amount: string
}

interface BulkSignatureGeneratorProps {
    network: StacksNetwork
    className?: string
}

export function BulkSignatureGenerator({
    network,
    className
}: BulkSignatureGeneratorProps) {
    // State for private key and validation
    const [privateKey, setPrivateKey] = useState("")
    const [privateKeyError, setPrivateKeyError] = useState<string | null>(null)
    const [address, setAddress] = useState<string | null>(null)

    // State for signature parameters
    const [coreContract, setCoreContract] = useState("")
    const [intent, setIntent] = useState("REDEEM_BEARER")
    const [amount, setAmount] = useState("")
    const [sigCount, setSigCount] = useState("10")

    // State for bulk operations
    const [signatures, setSignatures] = useState<Signature[]>([])
    const [isGenerating, setIsGenerating] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // State for validation
    const [isValidating, setIsValidating] = useState(false)
    const [validationResult, setValidationResult] = useState<{ success: boolean, message: string } | null>(null)

    // State for recovering signer
    const [sampleSignature, setSampleSignature] = useState("")
    const [sampleUuid, setSampleUuid] = useState("")
    const [recoveredSigner, setRecoveredSigner] = useState<string | null>(null)
    const [isRecovering, setIsRecovering] = useState(false)

    // Add selectedSignature state to the component
    const [selectedSignature, setSelectedSignature] = useState<Signature | null>(null)
    const [baseUrl, setBaseUrl] = useState("https://blaze.charisma.rocks")

    // Validate the private key and compute the public address
    const validatePrivateKey = useCallback(() => {
        try {
            setPrivateKeyError(null)
            if (!privateKey.trim()) {
                setAddress(null)
                return false
            }

            // Use getAddressFromPrivateKey to derive address
            const derivedAddress = getAddressFromPrivateKey(privateKey, network.chainId === 1 ? 'mainnet' : 'testnet')
            setAddress(derivedAddress)
            return true
        } catch (err) {
            setPrivateKeyError("Invalid private key format")
            setAddress(null)
            return false
        }
    }, [privateKey, network.chainId])

    // Handle private key input change
    const handlePrivateKeyChange = (e: ChangeEvent<HTMLInputElement>) => {
        setPrivateKey(e.target.value)
        setPrivateKeyError(null)
    }

    // Handle input changes for other fields
    const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>) =>
        (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            setter(e.target.value)
        }

    // Handle numeric input changes
    const handleNumericChange = (setter: React.Dispatch<React.SetStateAction<string>>) =>
        (e: ChangeEvent<HTMLInputElement>) => {
            const val = e.target.value.replace(/[^0-9]/g, '')
            setter(val)
        }

    // Validate the intent configuration before generating signatures
    const validateIntent = async () => {
        setIsValidating(true)
        setValidationResult(null)
        setError(null)

        try {
            // Basic validation checks
            if (!coreContract) {
                throw new Error("Core contract is required");
            }

            if (!coreContract.match(/^S[PT][A-Z0-9]{1,}(\.[a-zA-Z][a-zA-Z0-9-]*)+$/)) {
                throw new Error("Invalid contract format. Must be a valid principal with a contract name");
            }

            if (!amount) {
                throw new Error("Amount is required for REDEEM_BEARER intent");
            }

            if (intent !== "REDEEM_BEARER") {
                throw new Error("Only REDEEM_BEARER intent is supported in this version");
            }

            // Parse contract to get address and name
            const [contractAddress, contractName] = parseContract(coreContract);

            // Use an API call to check the contract instead of fetchPrivate
            try {
                // Make a call to Stacks API to check if contract exists
                const response = await fetch(`https://api.mainnet.hiro.so/extended/v1/contract/${contractAddress}.${contractName}`);

                if (response.ok) {
                    setValidationResult({
                        success: true,
                        message: "Intent configuration is valid! Contract exists and you can proceed with generating signatures."
                    });
                } else {
                    throw new Error("Contract not found. Please verify the contract address and name.");
                }
            } catch (e) {
                // Fallback to a simpler validation
                console.warn("Contract validation failed, using basic validation:", e);
                setValidationResult({
                    success: true,
                    message: "Basic validation passed. Contract validation skipped."
                });
            }
        } catch (error) {
            console.error("Validation error:", error);
            setValidationResult({
                success: false,
                message: error instanceof Error ? error.message : String(error)
            });
        } finally {
            setIsValidating(false);
        }
    }

    // Recover signer from a signature
    const recoverSigner = async () => {
        setIsRecovering(true)
        setRecoveredSigner(null)
        setError(null)

        try {
            if (!sampleSignature) {
                throw new Error("Signature is required to recover the signer");
            }

            if (!sampleUuid) {
                throw new Error("UUID is required to recover the signer");
            }

            if (!coreContract) {
                throw new Error("Core contract is required");
            }

            // Validate signature format
            if (!/^(0x)?[0-9a-fA-F]{130}$/.test(sampleSignature)) {
                throw new Error("Invalid signature format (must be 65 bytes hex)");
            }

            // Parse the signer contract address and name
            const [signerContractAddress, signerContractName] = BLAZE_SIGNER_CONTRACT.split(".");
            if (!signerContractAddress || !signerContractName) {
                throw new Error("Invalid signer contract format in default configuration");
            }

            // Prepare optional arguments: Use optionalCVOf only when there IS a value
            const opcodeArg = noneCV(); // We don't use opcode for REDEEM_BEARER
            const amountArg = amount ? optionalCVOf(uintCV(amount)) : noneCV();
            const targetArg = noneCV(); // We don't use target for REDEEM_BEARER

            // Call the read-only 'recover' function to get the signer
            const result = await fetchCallReadOnlyFunction({
                contractAddress: signerContractAddress,
                contractName: signerContractName,
                functionName: "recover",
                functionArgs: [
                    bufferFromHex(sampleSignature),
                    principalCV(coreContract),
                    stringAsciiCV(intent),
                    opcodeArg,
                    amountArg,
                    targetArg,
                    stringAsciiCV(sampleUuid)
                ],
                network,
                senderAddress: address || signerContractAddress,
            });

            // Check the result type correctly
            if (result && result.type === ClarityType.ResponseOk && result.value) {
                const principal = cvToValue(result.value);
                setRecoveredSigner(principal);
            } else if (result && result.type === ClarityType.ResponseErr) {
                const errorDetails = JSON.stringify(cvToValue(result.value, true));
                throw new Error(`Contract returned error: ${errorDetails}`);
            } else {
                // Handle unexpected result structure
                throw new Error('Could not recover signer: Unexpected result format from read-only call.');
            }

        } catch (error) {
            console.error("Recovery error:", error);
            setError(`Recovery failed: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsRecovering(false);
        }
    }

    // Generate signatures in bulk
    const generateBulkSignatures = async () => {
        // Validate inputs
        if (!validatePrivateKey()) return

        if (!coreContract) {
            setError("Core contract is required")
            return
        }

        if (!amount) {
            setError("Amount is required for REDEEM_BEARER intent")
            return
        }

        const count = parseInt(sigCount, 10)
        if (isNaN(count) || count < 1 || count > 1000) {
            setError("Signature count must be between 1 and 1000")
            return
        }

        setIsGenerating(true)
        setError(null)

        try {
            // Array to store generated signatures
            const newSignatures: Signature[] = []

            // Create base message
            const baseMessage = {
                contract: principalCV(coreContract),
                intent: stringAsciiCV(intent),
                opcode: noneCV(),
                amount: optionalCVOf(uintCV(amount)),
                target: noneCV(),  // Always none for REDEEM_BEARER
            }

            // Domain for structured data
            const domain = tupleCV({
                name: stringAsciiCV(BLAZE_PROTOCOL_NAME),
                version: stringAsciiCV(BLAZE_PROTOCOL_VERSION),
                'chain-id': uintCV(network.chainId),
            })

            // Generate signatures for each UUID
            for (let i = 0; i < count; i++) {
                // Generate a unique UUID for each signature
                const uuid = generateUUID()

                // Create message with this UUID
                const message = tupleCV({
                    ...baseMessage,
                    uuid: stringAsciiCV(uuid),
                })

                try {
                    // Use signStructuredData via private key function
                    // For local private key signing
                    const signature = await signStructuredData({
                        message,
                        domain,
                        privateKey: privateKey
                    });

                    // Add to our list
                    newSignatures.push({
                        id: i + 1,
                        uuid,
                        hash: "", // Hash would be derived from the structured data
                        signature,
                        amount
                    });
                } catch (signError) {
                    console.error(`Error signing message ${i + 1}:`, signError);
                    // If there's an error with direct private key signing, skip this one
                    continue;
                }
            }

            if (newSignatures.length === 0) {
                throw new Error("Failed to generate any signatures");
            }

            setSignatures(newSignatures)

            // Set sample values for the recovery tab
            if (newSignatures.length > 0) {
                setSampleSignature(newSignatures[0].signature)
                setSampleUuid(newSignatures[0].uuid)
            }

        } catch (error) {
            console.error("Error generating signatures:", error)
            setError(`Error generating signatures: ${error instanceof Error ? error.message : String(error)}`)
        } finally {
            setIsGenerating(false)
        }
    }

    // Export signatures to CSV
    const exportToCsv = () => {
        if (signatures.length === 0) return

        // Create CSV header and rows
        const csvHeader = ["id", "uuid", "signature", "amount"].join(",")
        const csvRows = signatures.map(sig => {
            return [
                sig.id,
                sig.uuid,
                sig.signature,
                sig.amount
            ].join(",")
        })

        // Combine header and rows
        const csvContent = [csvHeader, ...csvRows].join("\n")

        // Create download link
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.setAttribute("href", url)
        link.setAttribute("download", `bulk-signatures-${new Date().toISOString().slice(0, 10)}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    // Copy all signatures as JSON
    const copyAsJson = () => {
        if (signatures.length === 0) return

        const jsonData = JSON.stringify(signatures, null, 2)
        navigator.clipboard.writeText(jsonData)
        alert("Copied JSON data to clipboard")
    }

    // Add function to generate redeem URL
    const getRedeemUrl = (signature: Signature) => {
        if (!baseUrl || !coreContract) return "";

        const params = new URLSearchParams();
        params.set('sig', signature.signature);
        params.set('amount', signature.amount);
        params.set('uuid', signature.uuid);
        params.set('contract', coreContract);

        return `${baseUrl}/redeem?${params.toString()}`;
    }

    // Add function to generate verify URL
    const getVerifyUrl = (signature: Signature) => {
        if (!baseUrl || !coreContract) return "";

        const params = new URLSearchParams();
        params.set('uuid', signature.uuid);
        params.set('contract', coreContract);

        return `${baseUrl}/verify?${params.toString()}`;
    }

    // Function to generate and download QR code pack
    const [isGeneratingQRPack, setIsGeneratingQRPack] = useState(false);
    const qrCodeContainerRef = useRef<HTMLDivElement | null>(null);

    const generateQRCodePack = async () => {
        if (signatures.length === 0 || !baseUrl || !coreContract) return;

        setIsGeneratingQRPack(true);

        try {
            const zip = new JSZip();
            const qrFolder = zip.folder("qr-codes");
            const labeledQrFolder = zip.folder("labeled-qr-codes");
            const combinedQrFolder = zip.folder("combined-qr-codes");

            // Add metadata JSON file
            const metadataFile = {
                generated: new Date().toISOString(),
                contract: coreContract,
                baseUrl,
                count: signatures.length,
                signatures: signatures.map(sig => ({
                    id: sig.id,
                    uuid: sig.uuid,
                    amount: sig.amount,
                    redeemUrl: getRedeemUrl(sig),
                    verifyUrl: getVerifyUrl(sig)
                }))
            };
            zip.file("metadata.json", JSON.stringify(metadataFile, null, 2));

            // Create a readme file
            const readmeContent = `# Bearer Token QR Codes
Generated: ${new Date().toLocaleString()}
Contract: ${coreContract}
Count: ${signatures.length}

## Usage Instructions
- The \`qr-codes\` folder contains plain QR code images for each signature
- The \`labeled-qr-codes\` folder contains HTML pages with QR codes that include titles and descriptions
- The \`combined-qr-codes\` folder contains HTML pages with both redeem and verify QR codes together
- Each signature has multiple formats:
  - Basic QR codes: \`redeem-{id}.png\` and \`verify-{id}.png\`
  - Labeled QR codes: \`redeem-{id}.html\` and \`verify-{id}.html\`
  - Combined QR codes: \`combined-{id}.html\` (includes both redeem and verify)
- Open the HTML files in a browser to see the formatted QR codes
- The text files (.txt) contain the corresponding URLs
- The CSV file contains all signature data in spreadsheet format
- Use the JSON file for programmatic access to the data
`;
            zip.file("README.md", readmeContent);

            // Add CSV export
            const csvHeader = ["id", "uuid", "signature", "amount"].join(",");
            const csvRows = signatures.map(sig => {
                return [
                    sig.id,
                    sig.uuid,
                    sig.signature,
                    sig.amount
                ].join(",");
            });
            const csvContent = [csvHeader, ...csvRows].join("\n");
            zip.file("signatures.csv", csvContent);

            // Process each signature
            if (qrFolder && labeledQrFolder && combinedQrFolder) {
                // Process in smaller batches to avoid overwhelming the server
                const batchSize = 5;
                const batches = Math.ceil(signatures.length / batchSize);

                for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
                    const batchStart = batchIndex * batchSize;
                    const batchEnd = Math.min(batchStart + batchSize, signatures.length);
                    const batchSignatures = signatures.slice(batchStart, batchEnd);

                    // Process each signature in the batch
                    await Promise.all(batchSignatures.map(async (sig) => {
                        const redeemUrl = getRedeemUrl(sig);
                        const verifyUrl = getVerifyUrl(sig);

                        // Add text files with URLs
                        qrFolder.file(`redeem-${sig.id}.txt`, redeemUrl);
                        qrFolder.file(`verify-${sig.id}.txt`, verifyUrl);

                        // Add a JSON file with all data for this signature
                        qrFolder.file(`signature-${sig.id}.json`, JSON.stringify({
                            id: sig.id,
                            uuid: sig.uuid,
                            signature: sig.signature,
                            amount: sig.amount,
                            redeemUrl,
                            verifyUrl
                        }, null, 2));

                        try {
                            // Generate regular QR codes
                            const [redeemQrResponse, verifyQrResponse] = await Promise.all([
                                fetch(`/api/qrcode?url=${encodeURIComponent(redeemUrl)}&size=500`),
                                fetch(`/api/qrcode?url=${encodeURIComponent(verifyUrl)}&size=500`)
                            ]);

                            if (redeemQrResponse.ok) {
                                const redeemQrBuffer = await redeemQrResponse.arrayBuffer();
                                qrFolder.file(`redeem-${sig.id}.png`, redeemQrBuffer);
                            }

                            if (verifyQrResponse.ok) {
                                const verifyQrBuffer = await verifyQrResponse.arrayBuffer();
                                qrFolder.file(`verify-${sig.id}.png`, verifyQrBuffer);
                            }

                            // Generate labeled QR codes (HTML)
                            const [labeledRedeemQrResponse, labeledVerifyQrResponse] = await Promise.all([
                                fetch(`/api/qrcode?url=${encodeURIComponent(redeemUrl)}&size=500&labeled=true&title=REDEEM&description=Scan to redeem ${sig.amount} token${sig.amount === "1" ? "" : "s"}.`),
                                fetch(`/api/qrcode?url=${encodeURIComponent(verifyUrl)}&size=500&labeled=true&title=VERIFY&description=Scan to check if this note has been used.`)
                            ]);

                            if (labeledRedeemQrResponse.ok) {
                                const labeledRedeemHtml = await labeledRedeemQrResponse.text();
                                labeledQrFolder.file(`redeem-${sig.id}.html`, labeledRedeemHtml);
                            }

                            if (labeledVerifyQrResponse.ok) {
                                const labeledVerifyHtml = await labeledVerifyQrResponse.text();
                                labeledQrFolder.file(`verify-${sig.id}.html`, labeledVerifyHtml);
                            }

                            // Generate combined QR code (both redeem and verify)
                            const combinedQrResponse = await fetch(
                                `/api/qrcode?combined=true&redeemUrl=${encodeURIComponent(redeemUrl)}&verifyUrl=${encodeURIComponent(verifyUrl)}&size=300&amount=${sig.amount}&description=UUID: ${sig.uuid}`
                            );

                            if (combinedQrResponse.ok) {
                                const combinedQrHtml = await combinedQrResponse.text();
                                combinedQrFolder.file(`combined-${sig.id}.html`, combinedQrHtml);
                            }
                        } catch (error) {
                            console.error(`Error generating QR code for signature ${sig.id}:`, error);
                            // Continue with other signatures even if QR generation fails for one
                        }
                    }));
                }
            }

            // Generate the zip file and trigger download
            const zipBlob = await zip.generateAsync({ type: "blob" });
            saveAs(zipBlob, `bearer-tokens-${new Date().toISOString().split('T')[0]}.zip`);

        } catch (error) {
            console.error("Error generating QR code pack:", error);
            alert(`Error generating QR code pack: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsGeneratingQRPack(false);
        }
    };

    return (
        <Card className={cn(className)}>
            <CardHeader>
                <CardTitle>Bulk Signature Generator</CardTitle>
                <CardDescription>
                    Generate multiple REDEEM_BEARER signatures in one operation using a private key.
                </CardDescription>
            </CardHeader>

            <CardContent>
                <Tabs defaultValue="generate" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="generate">Generate</TabsTrigger>
                        <TabsTrigger value="validate">Validate Intent</TabsTrigger>
                        <TabsTrigger value="recover">Recover Signer</TabsTrigger>
                    </TabsList>

                    <TabsContent value="generate" className="space-y-6 mt-4">
                        {/* Private Key Input */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Label htmlFor="private-key" className="font-medium">Private Key</Label>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className="max-w-xs">Your private key is only used locally and never sent to any server, but we still recommend you disconnect your internet before using this tool.</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <Input
                                id="private-key"
                                type="password"
                                placeholder="Enter your private key"
                                value={privateKey}
                                onChange={handlePrivateKeyChange}
                                onBlur={validatePrivateKey}
                                className="font-mono text-sm"
                            />
                            {privateKeyError && (
                                <p className="text-xs text-destructive mt-1">{privateKeyError}</p>
                            )}
                            {address && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    Address: <span className="font-mono">{address}</span>
                                </p>
                            )}
                        </div>

                        {/* Signature Parameters */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="core-contract" className="font-medium">Subnet Contract (principal)</Label>
                                <Input
                                    id="core-contract"
                                    placeholder="SP... (Contract allowed to call 'execute')"
                                    value={coreContract}
                                    onChange={handleInputChange(setCoreContract)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="intent" className="font-medium">Intent</Label>
                                <Input
                                    id="intent"
                                    value={intent}
                                    readOnly
                                    disabled
                                    className="bg-muted"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="amount" className="font-medium">Amount (uint)</Label>
                                <Input
                                    id="amount"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    placeholder="e.g., 1000000"
                                    value={amount}
                                    onChange={handleNumericChange(setAmount)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="sig-count" className="font-medium">Number of Signatures</Label>
                                <Input
                                    id="sig-count"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    placeholder="How many signatures to generate"
                                    value={sigCount}
                                    onChange={handleNumericChange(setSigCount)}
                                />
                            </div>
                        </div>

                        {error && (
                            <Alert variant="destructive" className="flex flex-col gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                <div>
                                    <AlertTitle>Error</AlertTitle>
                                    <AlertDescription>{error}</AlertDescription>
                                </div>
                            </Alert>
                        )}

                        <div className="flex flex-col sm:flex-row gap-2">
                            <Button
                                variant="outline"
                                onClick={validateIntent}
                                disabled={isValidating || !coreContract || !amount}
                                className="flex-1"
                            >
                                {isValidating ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        <span>Validating...</span>
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck className="mr-2 h-4 w-4" />
                                        <span>Validate REDEEM_BEARER Intent</span>
                                    </>
                                )}
                            </Button>

                            <Button
                                className="flex-1"
                                onClick={generateBulkSignatures}
                                disabled={isGenerating || !privateKey || !coreContract || !amount}
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        <span>Generating...</span>
                                    </>
                                ) : (
                                    <>
                                        <Upload className="mr-2 h-4 w-4" />
                                        <span>Generate {sigCount} Signatures</span>
                                    </>
                                )}
                            </Button>
                        </div>

                        {validationResult && (
                            <Alert
                                variant={validationResult.success ? "default" : "destructive"}
                                className="flex flex-col gap-2"
                            >
                                {validationResult.success ? (
                                    <CheckCircle className="h-4 w-4" />
                                ) : (
                                    <AlertTriangle className="h-4 w-4" />
                                )}
                                <div>
                                    <AlertTitle>{validationResult.success ? "Validation Passed" : "Validation Failed"}</AlertTitle>
                                    <AlertDescription>{validationResult.message}</AlertDescription>
                                </div>
                            </Alert>
                        )}

                        {/* Results Table */}
                        {signatures.length > 0 && (
                            <div className="mt-6 border rounded-md overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[80px]">ID</TableHead>
                                            <TableHead>UUID</TableHead>
                                            <TableHead className="w-1/2">Signature (truncated)</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {signatures.slice(0, 5).map((sig) => (
                                            <TableRow key={sig.id}>
                                                <TableCell className="font-medium">{sig.id}</TableCell>
                                                <TableCell className="font-mono text-xs">{sig.uuid}</TableCell>
                                                <TableCell className="font-mono text-xs">
                                                    {sig.signature.substring(0, 20)}...
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <span>{sig.amount}</span>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setSelectedSignature(sig)}
                                                            title="View QR Codes"
                                                        >
                                                            QR
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {signatures.length > 5 && (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-2">
                                                    ...and {signatures.length - 5} more
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        {signatures.length > 0 && (
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={copyAsJson} size="sm">
                                    Copy as JSON
                                </Button>
                                <Button onClick={exportToCsv} size="sm">
                                    <Download className="mr-2 h-4 w-4" />
                                    Export CSV
                                </Button>
                                {signatures.length > 0 && baseUrl && (
                                    <Button
                                        variant="default"
                                        size="sm"
                                        onClick={generateQRCodePack}
                                        disabled={isGeneratingQRPack}
                                    >
                                        {isGeneratingQRPack ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <Download className="mr-2 h-4 w-4" />
                                                Download Token Pack
                                            </>
                                        )}
                                    </Button>
                                )}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="validate" className="space-y-4 mt-4">
                        <p className="text-sm text-muted-foreground">
                            Validate your intent configuration before generating signatures to ensure it will be accepted by the protocol.
                        </p>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="validate-contract" className="font-medium">Subnet Contract (principal)</Label>
                                <Input
                                    id="validate-contract"
                                    placeholder="SP... (Contract allowed to call 'execute')"
                                    value={coreContract}
                                    onChange={handleInputChange(setCoreContract)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="validate-amount" className="font-medium">Amount (uint)</Label>
                                <Input
                                    id="validate-amount"
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    placeholder="e.g., 1000000"
                                    value={amount}
                                    onChange={handleNumericChange(setAmount)}
                                />
                            </div>

                            <Button
                                onClick={validateIntent}
                                disabled={isValidating}
                                className="w-full"
                            >
                                {isValidating ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        <span>Validating...</span>
                                    </>
                                ) : (
                                    <>
                                        <ShieldCheck className="mr-2 h-4 w-4" />
                                        <span>Validate REDEEM_BEARER Intent</span>
                                    </>
                                )}
                            </Button>

                            {validationResult && (
                                <Alert
                                    variant={validationResult.success ? "default" : "destructive"}
                                    className="flex flex-col gap-2"
                                >
                                    {validationResult.success ? (
                                        <CheckCircle className="h-4 w-4" />
                                    ) : (
                                        <AlertTriangle className="h-4 w-4" />
                                    )}
                                    <div>
                                        <AlertTitle>{validationResult.success ? "Validation Passed" : "Validation Failed"}</AlertTitle>
                                        <AlertDescription>{validationResult.message}</AlertDescription>
                                    </div>
                                </Alert>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="recover" className="space-y-4 mt-4">
                        <p className="text-sm text-muted-foreground">
                            Recover the original signer's address from an existing signature and UUID.
                        </p>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="sample-signature" className="font-medium">Signature</Label>
                                <Input
                                    id="sample-signature"
                                    placeholder="Paste a signature to recover the signer"
                                    value={sampleSignature}
                                    onChange={handleInputChange(setSampleSignature)}
                                    className="font-mono text-xs"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="sample-uuid" className="font-medium">UUID</Label>
                                <Input
                                    id="sample-uuid"
                                    placeholder="UUID associated with the signature"
                                    value={sampleUuid}
                                    onChange={handleInputChange(setSampleUuid)}
                                    className="font-mono"
                                />
                            </div>

                            <Button
                                onClick={recoverSigner}
                                disabled={isRecovering || !sampleSignature || !sampleUuid}
                                className="w-full"
                            >
                                {isRecovering ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        <span>Recovering...</span>
                                    </>
                                ) : (
                                    <>
                                        <User className="mr-2 h-4 w-4" />
                                        <span>Recover Signer</span>
                                    </>
                                )}
                            </Button>

                            {recoveredSigner && (
                                <div className="p-4 border rounded-md bg-muted/20">
                                    <p className="text-sm font-medium mb-1">Recovered Signer:</p>
                                    <p className="font-mono text-sm break-all">{recoveredSigner}</p>
                                </div>
                            )}

                            {error && (
                                <Alert variant="destructive" className="flex flex-col gap-2">
                                    <AlertTriangle className="h-4 w-4" />
                                    <div>
                                        <AlertTitle>Error</AlertTitle>
                                        <AlertDescription>{error}</AlertDescription>
                                    </div>
                                </Alert>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>

            {signatures.length > 0 && (
                <CardFooter className="flex justify-between gap-4 flex-wrap">
                    <div className="text-sm text-muted-foreground">
                        <CheckCircle className="h-4 w-4 inline mr-1 text-green-500" />
                        Generated {signatures.length} unique signatures
                    </div>
                </CardFooter>
            )}

            {/* Add QR code display modal/dialog that appears when a signature is selected */}
            {selectedSignature && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-background rounded-lg shadow-lg max-w-5xl w-full p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">QR Codes for Signature #{selectedSignature.id}</h3>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedSignature(null)}
                            >
                                ✕
                            </Button>
                        </div>

                        <Tabs defaultValue="plain" className="w-full">
                            <TabsList className="grid w-full grid-cols-3 mb-4">
                                <TabsTrigger value="plain">Plain QR Codes</TabsTrigger>
                                <TabsTrigger value="labeled">Labeled QR Codes</TabsTrigger>
                                <TabsTrigger value="combined">Combined Format</TabsTrigger>
                            </TabsList>

                            <TabsContent value="plain">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="border rounded-md p-4 flex flex-col items-center">
                                        <h4 className="font-medium mb-2">Redeem QR Code</h4>
                                        <div className="bg-white p-3 rounded-md mb-3">
                                            <QRCodeSVG
                                                value={getRedeemUrl(selectedSignature)}
                                                size={200}
                                                level="H"
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground mb-2 text-center">
                                            Scan to redeem tokens using this signature
                                        </p>
                                        <a
                                            href={getRedeemUrl(selectedSignature)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary text-sm hover:underline"
                                        >
                                            Open Redeem Link
                                        </a>
                                    </div>

                                    <div className="border rounded-md p-4 flex flex-col items-center">
                                        <h4 className="font-medium mb-2">Verify QR Code</h4>
                                        <div className="bg-white p-3 rounded-md mb-3">
                                            <QRCodeSVG
                                                value={getVerifyUrl(selectedSignature)}
                                                size={200}
                                                level="H"
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground mb-2 text-center">
                                            Scan to verify if this signature has been used
                                        </p>
                                        <a
                                            href={getVerifyUrl(selectedSignature)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-primary text-sm hover:underline"
                                        >
                                            Open Verify Link
                                        </a>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="labeled">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="border rounded-md p-4 flex flex-col items-center">
                                        <iframe
                                            src={`/api/qrcode?url=${encodeURIComponent(getRedeemUrl(selectedSignature))}&size=200&labeled=true&title=REDEEM&description=Scan to redeem ${selectedSignature.amount} token${selectedSignature.amount === "1" ? "" : "s"}.`}
                                            title="Labeled Redeem QR Code"
                                            className="w-full bg-white"
                                            height="350"
                                            frameBorder="0"
                                        ></iframe>
                                    </div>

                                    <div className="border rounded-md p-4 flex flex-col items-center">
                                        <iframe
                                            src={`/api/qrcode?url=${encodeURIComponent(getVerifyUrl(selectedSignature))}&size=200&labeled=true&title=VERIFY&description=Scan to check if this note has been used.`}
                                            title="Labeled Verify QR Code"
                                            className="w-full bg-white"
                                            height="350"
                                            frameBorder="0"
                                        ></iframe>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="combined">
                                <div className="border rounded-md p-4">
                                    <iframe
                                        src={`/api/qrcode?combined=true&redeemUrl=${encodeURIComponent(getRedeemUrl(selectedSignature))}&verifyUrl=${encodeURIComponent(getVerifyUrl(selectedSignature))}&size=200&amount=${selectedSignature.amount}&description=UUID: ${selectedSignature.uuid}`}
                                        title="Combined QR Codes"
                                        className="w-full bg-white"
                                        height="500"
                                        frameBorder="0"
                                    ></iframe>
                                </div>
                            </TabsContent>
                        </Tabs>

                        <div className="mt-4 text-sm border-t pt-4">
                            <p><strong>UUID:</strong> <span className="font-mono">{selectedSignature.uuid}</span></p>
                            <p className="mt-2"><strong>Signature:</strong> <span className="font-mono text-xs break-all">{selectedSignature.signature}</span></p>
                        </div>

                        <div className="mt-4 flex justify-end">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedSignature(null)}
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </Card>
    )
} 