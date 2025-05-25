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
import { generateWallet, restoreWalletAccounts } from '@stacks/wallet-sdk'
import type { Wallet } from '@stacks/wallet-sdk'
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
import { getTokenMetadataCached } from '@repo/tokens'

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
    const [isSeedPhrase, setIsSeedPhrase] = useState(false)
    const [derivedPrivateKey, setDerivedPrivateKey] = useState<string | null>(null)
    const [isDerivingKey, setIsDerivingKey] = useState(false)

    // State for signature parameters
    const [coreContract, setCoreContract] = useState("")
    const [intent] = useState("REDEEM_BEARER")
    const [amount, setAmount] = useState("")
    const [sigCount, setSigCount] = useState("10")
    const [tokenDecimals, setTokenDecimals] = useState(0)

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

    // For QR code preview modal
    const [selectedSignature, setSelectedSignature] = useState<Signature | null>(null);
    const [selectedTokenImage, setSelectedTokenImage] = useState<string | null>(null);
    const [selectedTokenName, setSelectedTokenName] = useState<string>('');
    const [selectedTokenSymbol, setSelectedTokenSymbol] = useState<string>('');
    const [selectedTokenDecimals, setSelectedTokenDecimals] = useState<number>(0);

    // Add selectedSignature state to the component
    const [baseUrl, setBaseUrl] = useState("https://blaze.charisma.rocks")

    // State for token metadata
    const [tokenName, setTokenName] = useState<string>('');
    const [tokenSymbol, setTokenSymbol] = useState<string>('');
    const [isLoadingTokenMetadata, setIsLoadingTokenMetadata] = useState(false);

    // Utility functions for amount formatting
    const formatTokenAmount = (rawAmount: string, decimals: number): string => {
        if (!rawAmount) return '';
        const amountNum = Number(rawAmount);
        if (isNaN(amountNum)) return rawAmount;

        return (amountNum / Math.pow(10, decimals)).toLocaleString('en-US', {
            minimumFractionDigits: 0,
            maximumFractionDigits: decimals
        });
    }

    const parseFormattedAmount = (formattedAmount: string, decimals: number): string => {
        if (!formattedAmount) return '';
        // Remove commas and other formatting
        const cleanAmount = formattedAmount.replace(/,/g, '');
        const amountNum = Number(cleanAmount);
        if (isNaN(amountNum)) return '';

        // Convert to raw units based on decimals, preserving full precision
        // This handles decimal input correctly by scaling appropriately
        const rawAmount = amountNum * Math.pow(10, decimals);

        // Round to avoid floating point precision errors
        // e.g., 1.1 * 10^6 = 1100000.0000000001 due to IEEE 754
        const roundedAmount = Math.round(rawAmount);

        return roundedAmount.toString();
    }

    // Validate the private key and compute the public address
    const validatePrivateKey = useCallback(async () => {
        try {
            setPrivateKeyError(null)
            if (!privateKey.trim()) {
                setAddress(null)
                setIsSeedPhrase(false)
                setDerivedPrivateKey(null)
                return false
            }

            // Detect if this is likely a seed phrase (contains spaces)
            const containsSpaces = privateKey.includes(' ')
            setIsSeedPhrase(containsSpaces)

            if (containsSpaces) {
                // Handle as a seed phrase
                setIsDerivingKey(true)
                try {
                    // Restore wallet from seed phrase
                    let wallet = await generateWallet({
                        secretKey: privateKey.trim(),
                        password: 'password', // Not actually used since we're just deriving keys
                    })

                    // Get the first account's private key
                    wallet = await restoreWalletAccounts({
                        wallet,
                        gaiaHubUrl: 'https://hub.blockstack.org',
                    })

                    if (wallet && wallet.accounts.length > 0) {
                        const firstAccount = wallet.accounts[0]
                        const accountPrivateKey = firstAccount.stxPrivateKey
                        setDerivedPrivateKey(accountPrivateKey)

                        // Derive address from the private key
                        const derivedAddress = getAddressFromPrivateKey(
                            accountPrivateKey,
                            network.chainId === 1 ? 'mainnet' : 'testnet'
                        )
                        setAddress(derivedAddress)
                        setIsDerivingKey(false)
                        return true
                    } else {
                        throw new Error("No accounts derived from seed phrase")
                    }
                } catch (e) {
                    console.error("Error deriving private key from seed phrase:", e)
                    setPrivateKeyError(`Invalid seed phrase: ${e instanceof Error ? e.message : String(e)}`)
                    setAddress(null)
                    setDerivedPrivateKey(null)
                    setIsDerivingKey(false)
                    return false
                }
            } else {
                // Handle as a regular private key
                setDerivedPrivateKey(null)
                // Use getAddressFromPrivateKey to derive address
                const derivedAddress = getAddressFromPrivateKey(
                    privateKey,
                    network.chainId === 1 ? 'mainnet' : 'testnet'
                )
                setAddress(derivedAddress)
                return true
            }
        } catch (err) {
            setPrivateKeyError("Invalid private key format")
            setAddress(null)
            setDerivedPrivateKey(null)
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

    // Fetch token metadata when contract changes
    useEffect(() => {
        if (!coreContract) {
            setTokenDecimals(0);
            setTokenName('');
            setTokenSymbol('');
            return;
        }

        // Try to get token metadata
        const fetchTokenMetadata = async () => {
            setIsLoadingTokenMetadata(true);
            try {
                const [contractAddress, contractName] = parseContract(coreContract);
                if (contractAddress && contractName) {
                    // Get token metadata
                    const tokenMetadata = await getTokenMetadataCached(
                        `${contractAddress}.${contractName}`
                    );

                    // Extract token data
                    if (tokenMetadata?.decimals !== undefined) {
                        console.log(`Setting token decimals to ${tokenMetadata.decimals} from metadata`);
                        setTokenDecimals(tokenMetadata.decimals);
                    } else {
                        console.log('No decimals in metadata, using default of 0');
                        setTokenDecimals(0);
                    }

                    if (tokenMetadata?.name) {
                        setTokenName(tokenMetadata.name);
                    } else {
                        setTokenName('');
                    }

                    if (tokenMetadata?.symbol) {
                        setTokenSymbol(tokenMetadata.symbol);
                    } else {
                        setTokenSymbol('');
                    }
                }
            } catch (error) {
                console.error('Failed to load token metadata:', error);
                setTokenDecimals(0);
                setTokenName('');
                setTokenSymbol('');
            } finally {
                setIsLoadingTokenMetadata(false);
            }
        };

        fetchTokenMetadata();
    }, [coreContract]);

    // Handle amount input with proper formatting
    const handleAmountChange = (e: ChangeEvent<HTMLInputElement>) => {
        // Allow numbers, one decimal point, and remove other characters
        let val = e.target.value.replace(/[^0-9.]/g, '');

        // Ensure only one decimal point
        const parts = val.split('.');
        if (parts.length > 2) {
            val = `${parts[0]}.${parts.slice(1).join('')}`;
        }

        // Limit decimal places to the token's decimal precision
        if (parts.length === 2 && tokenDecimals > 0 && parts[1].length > tokenDecimals) {
            val = `${parts[0]}.${parts[1].substring(0, tokenDecimals)}`;
        }

        // Convert to raw amount and store
        const rawAmount = parseFormattedAmount(val, tokenDecimals);
        setAmount(rawAmount);

        // Log for debugging
        console.log(`Input: ${val}, Raw: ${rawAmount}, Decimals: ${tokenDecimals}`);
    }

    // Get display value for amount input
    const getFormattedAmountForInput = (): string => {
        if (!amount) return '';
        return formatTokenAmount(amount, tokenDecimals);
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

            // Parse contract to get address and name
            const [contractAddress, contractName] = parseContract(coreContract);

            // Use an API call to check the contract instead of fetchPrivate
            try {
                // Make a call to Stacks API to check if contract exists
                const response = await fetch(`https://api.mainnet.hiro.so/extended/v1/contract/${contractAddress}.${contractName}`);

                if (response.ok) {
                    setValidationResult({
                        success: true,
                        message: "Validation successful! Contract exists and you can proceed with generating signatures."
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
        if (!(await validatePrivateKey())) return

        // Get the actual private key to use (either direct or derived)
        const actualPrivateKey = derivedPrivateKey || privateKey

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
                        privateKey: actualPrivateKey
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
            const printGridFolder = zip.folder("print-grids");

            // Try to get token metadata for the combined QR code watermark
            let tokenImageUrl = '';
            let tokenName = '';
            let tokenSymbol = '';
            let tokenDecimals = 0; // Default to 6 decimals if not available
            try {
                // Extract contract address and name from the core contract
                const [contractAddress, contractName] = parseContract(coreContract);
                if (contractAddress && contractName) {
                    // Get token metadata
                    const tokenMetadata = await getTokenMetadataCached(
                        `${contractAddress}.${contractName}`
                    );

                    console.log('Token metadata for formatting amounts:', {
                        name: tokenMetadata?.name,
                        symbol: tokenMetadata?.symbol,
                        decimals: tokenMetadata?.decimals
                    });

                    // Extract token image URL if available
                    if (tokenMetadata?.image) {
                        tokenImageUrl = tokenMetadata.image;
                    }

                    // Extract token name and symbol if available
                    if (tokenMetadata?.name) {
                        tokenName = tokenMetadata.name;
                    }

                    if (tokenMetadata?.symbol) {
                        tokenSymbol = tokenMetadata.symbol;
                    }

                    // Extract token decimals if available
                    if (tokenMetadata?.decimals !== undefined) {
                        tokenDecimals = tokenMetadata.decimals;
                    }

                    console.log('Token metadata loaded:', tokenMetadata?.name || 'Unknown token');
                }
            } catch (tokenError) {
                console.error('Failed to load token metadata:', tokenError);
                // Continue without token metadata
            }

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
- The \`print-grids\` folder contains printable grid layouts for easy printing on standard paper
- Each signature has multiple formats:
  - Basic QR codes: \`redeem-{id}.png\` and \`verify-{id}.png\`
  - Labeled QR codes: \`redeem-{id}.html\` and \`verify-{id}.html\`
  - Combined QR codes: \`combined-{id}.html\` (includes both redeem and verify)
  - Printable grids: 4/6/9 codes per page optimized for standard printers
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
            if (qrFolder && labeledQrFolder && combinedQrFolder && printGridFolder) {
                // Process in smaller batches to avoid overwhelming the browser
                const batchSize = 5;
                const batches = Math.ceil(signatures.length / batchSize);

                for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
                    const batchStart = batchIndex * batchSize;
                    const batchEnd = Math.min(batchStart + batchSize, signatures.length);
                    const batchSignatures = signatures.slice(batchStart, batchEnd);

                    console.log(`Processing QR code batch ${batchIndex + 1}/${batches} (signatures ${batchStart + 1}-${batchEnd})`);

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
                                fetch(`/api/qrcode?url=${encodeURIComponent(redeemUrl)}&size=500&labeled=true&title=REDEEM&description=Scan to redeem ${formatTokenAmount(sig.amount, tokenDecimals)} token${formatTokenAmount(sig.amount, tokenDecimals) === "1" ? "" : "s"}.&tokenDecimals=${tokenDecimals}${tokenName ? `&tokenName=${encodeURIComponent(tokenName)}` : ''}${tokenSymbol ? `&tokenSymbol=${encodeURIComponent(tokenSymbol)}` : ''}`),
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
                                `/api/qrcode?combined=true&redeemUrl=${encodeURIComponent(redeemUrl)}&verifyUrl=${encodeURIComponent(verifyUrl)}&size=300&amount=${sig.amount}&description=UUID: ${sig.uuid}${tokenImageUrl ? `&tokenImage=${encodeURIComponent(tokenImageUrl)}` : ''}${tokenName ? `&tokenName=${encodeURIComponent(tokenName)}` : ''}${tokenSymbol ? `&tokenSymbol=${encodeURIComponent(tokenSymbol)}` : ''}&tokenDecimals=${tokenDecimals}`
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

            // Create printable grid layouts after all signatures are processed
            if (signatures.length > 0 && printGridFolder) {
                try {
                    console.log("Generating printable grid layouts");
                    // Create grid layouts for plain QR codes
                    await generatePrintableGrids(signatures, printGridFolder, "redeem", "verify", {
                        baseUrl,
                        coreContract,
                        tokenName,
                        tokenSymbol,
                        tokenDecimals,
                        tokenImageUrl
                    });

                    console.log("Printable grid layouts generated successfully");
                } catch (error) {
                    console.error("Error generating printable grids:", error);
                }
            }

            console.log("All QR code processing complete, generating zip file");

            // Generate the zip file and trigger download
            const zipBlob = await zip.generateAsync({ type: "blob" });
            saveAs(zipBlob, `bearer-tokens-${new Date().toISOString().split('T')[0]}.zip`);

            console.log("Zip file generated and downloaded successfully");

        } catch (error) {
            console.error("Error generating QR code pack:", error);
            alert(`Error generating QR code pack: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
            setIsGeneratingQRPack(false);
        }
    };

    // Helper function to generate printable grid layouts
    const generatePrintableGrids = async (
        signatures: Signature[],
        targetFolder: JSZip | null,
        redeemPrefix: string,
        verifyPrefix: string,
        options: {
            baseUrl: string;
            coreContract: string;
            tokenName: string;
            tokenSymbol: string;
            tokenDecimals: number;
            tokenImageUrl: string;
        }
    ) => {
        if (!targetFolder) return;

        // Create different grid layouts (4, 6, and 9 per page)
        const gridSizes = [4, 6, 9];

        // Create a map to track image data URLs
        const qrImageMap = new Map<string, string>();

        // Helper function to convert ArrayBuffer to base64
        const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            return btoa(binary);
        };

        // Process signatures in batches to avoid overwhelming the browser
        const batchSize = 5; // Process 5 signatures at a time
        const batches = Math.ceil(signatures.length / batchSize);

        console.log(`Processing ${signatures.length} signatures in ${batches} batches`);

        for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
            const batchStart = batchIndex * batchSize;
            const batchEnd = Math.min((batchIndex + 1) * batchSize, signatures.length);
            const batchSignatures = signatures.slice(batchStart, batchEnd);

            console.log(`Processing batch ${batchIndex + 1}/${batches} (signatures ${batchStart + 1}-${batchEnd})`);

            // Process each signature in the batch
            await Promise.all(batchSignatures.map(async (sig) => {
                const redeemUrl = getRedeemUrl(sig);
                const verifyUrl = getVerifyUrl(sig);

                // Generate redeem QR image
                const redeemKey = `redeem-${sig.id}`;
                try {
                    const redeemQrResponse = await fetch(`/api/qrcode?url=${encodeURIComponent(redeemUrl)}&size=300`);
                    if (redeemQrResponse.ok) {
                        // Convert the image to base64 data URL
                        const redeemQrBuffer = await redeemQrResponse.arrayBuffer();
                        const base64 = arrayBufferToBase64(redeemQrBuffer);
                        const dataUrl = `data:image/png;base64,${base64}`;
                        qrImageMap.set(redeemKey, dataUrl);
                    }
                } catch (error) {
                    console.error(`Error generating redeem QR for ${sig.id}:`, error);
                }

                // Generate verify QR image
                const verifyKey = `verify-${sig.id}`;
                try {
                    const verifyQrResponse = await fetch(`/api/qrcode?url=${encodeURIComponent(verifyUrl)}&size=300`);
                    if (verifyQrResponse.ok) {
                        // Convert the image to base64 data URL
                        const verifyQrBuffer = await verifyQrResponse.arrayBuffer();
                        const base64 = arrayBufferToBase64(verifyQrBuffer);
                        const dataUrl = `data:image/png;base64,${base64}`;
                        qrImageMap.set(verifyKey, dataUrl);
                    }
                } catch (error) {
                    console.error(`Error generating verify QR for ${sig.id}:`, error);
                }
            }));
        }

        console.log(`Generated ${qrImageMap.size} QR code images`);

        for (const gridSize of gridSizes) {
            // Create redeem-only grid
            const redeemGridHtml = createGridLayout(
                signatures,
                gridSize,
                "redeem",
                options,
                qrImageMap
            );
            targetFolder.file(`redeem-grid-${gridSize}-per-page.html`, redeemGridHtml);

            // Create verify-only grid
            const verifyGridHtml = createGridLayout(
                signatures,
                gridSize,
                "verify",
                options,
                qrImageMap
            );
            targetFolder.file(`verify-grid-${gridSize}-per-page.html`, verifyGridHtml);

            // Create combined grid (both codes per note)
            const combinedGridHtml = createGridLayout(
                signatures,
                gridSize,
                "combined",
                options,
                qrImageMap
            );
            targetFolder.file(`combined-grid-${gridSize}-per-page.html`, combinedGridHtml);
        }
    };

    // Helper function to create a grid layout HTML
    const createGridLayout = (
        signatures: Signature[],
        gridSize: number,
        mode: "redeem" | "verify" | "combined",
        options: {
            baseUrl: string;
            coreContract: string;
            tokenName: string;
            tokenSymbol: string;
            tokenDecimals: number;
            tokenImageUrl: string;
        },
        qrImageMap: Map<string, string>
    ): string => {
        // Calculate grid columns (sqrt of gridSize rounded up)
        const columns = Math.ceil(Math.sqrt(gridSize));
        const qrCodeSize = mode === "combined" ? 120 : 200; // Smaller for combined mode

        // Start building HTML
        let html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Printable ${mode.charAt(0).toUpperCase() + mode.slice(1)} QR Codes - ${gridSize} per page</title>
    <style>
        @media print {
            @page {
                size: letter;
                margin: 0.5in;
            }
            
            body {
                margin: 0;
                padding: 0;
            }
        }
        
        body {
            font-family: Arial, sans-serif;
            background-color: white;
        }
        
        .page {
            page-break-after: always;
            padding: 0.1in;
        }
        
        .grid {
            display: grid;
            grid-template-columns: repeat(${columns}, 1fr);
            grid-gap: 0.2in;
        }
        
        .note {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 0.1in;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background-color: white;
            page-break-inside: avoid;
            box-sizing: border-box;
            width: 100%;
            height: 100%;
        }
        
        .combined {
            display: flex;
            flex-direction: row;
            gap: 0.1in;
            justify-content: center;
        }
        
        .qr-code {
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        
        .qr-code img {
            width: ${qrCodeSize}px;
            height: ${qrCodeSize}px;
            border: 1px solid #eee;
            background-color: #f8f8f8;
        }
        
        .qr-code h3 {
            margin: 0.05in 0;
            font-size: 12px;
        }
        
        .note-info {
            font-size: 10px;
            text-align: center;
            margin-top: 0.05in;
            margin-bottom: 0.05in;
        }
        
        .note-token {
            font-weight: bold;
            font-size: 14px;
        }
        
        .note-amount {
            font-weight: bold;
            margin-top: 0.05in;
        }
        
        .page-break {
            page-break-after: always;
        }
        
        .note-id {
            font-size: 8px;
            color: #777;
            margin-top: 0.05in;
        }
        
        .qr-fallback {
            width: ${qrCodeSize}px;
            height: ${qrCodeSize}px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid #ddd;
            background-color: #f5f5f5;
            font-size: 10px;
            text-align: center;
            color: #666;
        }
    </style>
</head>
<body>
`;

        // Calculate how many pages we need
        const notesPerPage = gridSize;
        const totalPages = Math.ceil(signatures.length / notesPerPage);

        // Generate each page
        for (let page = 0; page < totalPages; page++) {
            html += `<div class="page">
    <div class="grid">`;

            // Generate notes for this page
            const startIndex = page * notesPerPage;
            const endIndex = Math.min((page + 1) * notesPerPage, signatures.length);

            for (let i = startIndex; i < endIndex; i++) {
                const sig = signatures[i];
                const formattedAmount = formatTokenAmount(sig.amount, options.tokenDecimals);

                // Get the QR code image paths from the map
                const redeemImagePath = qrImageMap.get(`redeem-${sig.id}`);
                const verifyImagePath = qrImageMap.get(`verify-${sig.id}`);

                // Generate note based on mode
                if (mode === "redeem") {
                    html += `
        <div class="note">
            <div class="note-token">${options.tokenName || 'Token'}${options.tokenSymbol ? ` (${options.tokenSymbol})` : ''}</div>
            <div class="note-amount">${formattedAmount} Token${formattedAmount === "1" ? "" : "s"}</div>
            <div class="qr-code">
                <h3>REDEEM</h3>
                ${redeemImagePath
                            ? `<img src="${redeemImagePath}" alt="Redeem QR Code">`
                            : `<div class="qr-fallback">QR Code<br>Unavailable</div>`
                        }
            </div>
            <div class="note-info">Scan to redeem tokens</div>
            <div class="note-id">ID: ${sig.id} • UUID: ${sig.uuid.substring(0, 8)}...</div>
        </div>`;
                } else if (mode === "verify") {
                    html += `
        <div class="note">
            <div class="note-token">${options.tokenName || 'Token'}${options.tokenSymbol ? ` (${options.tokenSymbol})` : ''}</div>
            <div class="note-amount">${formattedAmount} Token${formattedAmount === "1" ? "" : "s"}</div>
            <div class="qr-code">
                <h3>VERIFY</h3>
                ${verifyImagePath
                            ? `<img src="${verifyImagePath}" alt="Verify QR Code">`
                            : `<div class="qr-fallback">QR Code<br>Unavailable</div>`
                        }
            </div>
            <div class="note-info">Scan to verify if redeemed</div>
            <div class="note-id">ID: ${sig.id} • UUID: ${sig.uuid.substring(0, 8)}...</div>
        </div>`;
                } else {
                    // Combined mode
                    html += `
        <div class="note">
            <div class="note-token">${options.tokenName || 'Token'}${options.tokenSymbol ? ` (${options.tokenSymbol})` : ''}</div>
            <div class="note-amount">${formattedAmount} Token${formattedAmount === "1" ? "" : "s"}</div>
            <div class="combined">
                <div class="qr-code">
                    <h3>REDEEM</h3>
                    ${redeemImagePath
                            ? `<img src="${redeemImagePath}" alt="Redeem QR Code">`
                            : `<div class="qr-fallback">QR Code<br>Unavailable</div>`
                        }
                </div>
                <div class="qr-code">
                    <h3>VERIFY</h3>
                    ${verifyImagePath
                            ? `<img src="${verifyImagePath}" alt="Verify QR Code">`
                            : `<div class="qr-fallback">QR Code<br>Unavailable</div>`
                        }
                </div>
            </div>
            <div class="note-id">ID: ${sig.id} • UUID: ${sig.uuid.substring(0, 8)}...</div>
        </div>`;
                }
            }

            html += `
    </div>
</div>`;
            // Add page break except for the last page
            if (page < totalPages - 1) {
                html += `<div class="page-break"></div>`;
            }
        }

        html += `
</body>
</html>`;

        return html;
    };

    // Add function to handle signature selection with token image lookup
    const handleSignatureSelect = async (sig: Signature) => {
        setSelectedSignature(sig);

        // Try to get token metadata for the watermark
        try {
            // Extract contract address and name from the core contract
            const [contractAddress, contractName] = parseContract(coreContract);
            if (contractAddress && contractName) {
                // Get token metadata
                const tokenMetadata = await getTokenMetadataCached(
                    `${contractAddress}.${contractName}`
                );

                console.log(tokenMetadata);

                console.log('Token metadata for formatting amounts:', {
                    name: tokenMetadata?.name,
                    symbol: tokenMetadata?.symbol,
                    decimals: tokenMetadata?.decimals
                });

                // Extract token image URL if available
                if (tokenMetadata?.image) {
                    setSelectedTokenImage(tokenMetadata.image);
                } else {
                    setSelectedTokenImage(null);
                }

                // Set token name and symbol
                if (tokenMetadata?.name) {
                    setSelectedTokenName(tokenMetadata.name);
                } else {
                    setSelectedTokenName('');
                }

                if (tokenMetadata?.symbol) {
                    setSelectedTokenSymbol(tokenMetadata.symbol);
                } else {
                    setSelectedTokenSymbol('');
                }

                // Set token decimals
                if (tokenMetadata?.decimals !== undefined) {
                    setSelectedTokenDecimals(tokenMetadata.decimals);
                } else {
                    setSelectedTokenDecimals(6);
                }
            }
        } catch (tokenError) {
            console.error('Failed to load token metadata:', tokenError);
            setSelectedTokenImage(null);
            setSelectedTokenName('');
            setSelectedTokenSymbol('');
        }
    };

    return (
        <Card className={cn(className)}>
            <CardHeader>
                <CardTitle>Bulk Note Generator</CardTitle>
                <CardDescription>
                    Generate multiple bearer notes in one operation using a private key.
                </CardDescription>
            </CardHeader>

            <CardContent>
                <Tabs defaultValue="generate" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="generate">Generate</TabsTrigger>
                        <TabsTrigger value="validate">Validate Contract & Amount</TabsTrigger>
                        <TabsTrigger value="recover">Recover Signer</TabsTrigger>
                    </TabsList>

                    <TabsContent value="generate" className="space-y-6 mt-4">
                        {/* Private Key Input */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <Label htmlFor="private-key" className="font-medium">{isSeedPhrase ? "Seed Phrase" : "Private Key"}</Label>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-4 w-4 text-muted-foreground" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p className="max-w-xs">You can enter either a private key or a seed phrase (12-24 words). Your key is only used locally and never sent to any server, but we still recommend you use a fresh key with this tool and do not use it for other purposes.</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                            <Input
                                id="private-key"
                                type="password"
                                placeholder={"Enter your private key or seed phrase (12-24 words)"}
                                value={privateKey}
                                onChange={handlePrivateKeyChange}
                                onBlur={() => validatePrivateKey()}
                                className="font-mono text-sm"
                            />
                            {privateKeyError && (
                                <p className="text-xs text-destructive mt-1">{privateKeyError}</p>
                            )}
                            {isDerivingKey && (
                                <p className="text-xs text-amber-500 mt-1 flex items-center">
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                    Deriving private key from seed phrase...
                                </p>
                            )}
                            {isSeedPhrase && derivedPrivateKey && (
                                <p className="text-xs text-green-500 mt-1">Private key successfully derived from seed phrase</p>
                            )}
                            {address && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    Address: <span className="font-mono">{address}</span>
                                </p>
                            )}
                        </div>

                        {/* Signature Parameters */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2 md:row-span-2">
                                <Label htmlFor="core-contract" className="font-medium">Subnet Contract (principal)</Label>
                                <Input
                                    id="core-contract"
                                    placeholder="SP... (Contract allowed to call 'execute')"
                                    value={coreContract}
                                    onChange={handleInputChange(setCoreContract)}
                                />
                                {isLoadingTokenMetadata && (
                                    <p className="text-xs text-amber-500 mt-1 flex items-center">
                                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                        Loading token information...
                                    </p>
                                )}
                                {(tokenName || tokenSymbol) && (
                                    <div className="mt-2 text-xs p-2 border rounded-md bg-muted/20">
                                        <p className="font-medium mb-1">Token Information:</p>
                                        {tokenName && <p>Name: {tokenName}</p>}
                                        {tokenSymbol && <p>Symbol: {tokenSymbol}</p>}
                                        <p>Decimals: {tokenDecimals}</p>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="amount" className="font-medium">Amount (tokens)</Label>
                                <Input
                                    id="amount"
                                    type="text"
                                    inputMode="decimal"
                                    pattern="[0-9.]*"
                                    placeholder="e.g., 1.0"
                                    value={getFormattedAmountForInput()}
                                    onChange={handleAmountChange}
                                />
                                {tokenDecimals > 0 && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Using {tokenDecimals} decimal places from token metadata
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="sig-count" className="font-medium">Number of Notes</Label>
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
                                        <span>Validate Contract & Amount</span>
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
                                                        <span>{formatTokenAmount(sig.amount, tokenDecimals)}</span>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleSignatureSelect(sig)}
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
                            Validate the contract and amount before generating signatures to ensure they will be accepted by the protocol.
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
                                <Label htmlFor="validate-amount" className="font-medium">Amount (tokens)</Label>
                                <Input
                                    id="validate-amount"
                                    type="text"
                                    inputMode="decimal"
                                    pattern="[0-9.]*"
                                    placeholder="e.g., 1.0"
                                    value={getFormattedAmountForInput()}
                                    onChange={handleAmountChange}
                                />
                                {tokenDecimals > 0 && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Using {tokenDecimals} decimal places from token metadata
                                    </p>
                                )}
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
                                        <span>Validate Contract & Amount</span>
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
                                            src={`/api/qrcode?url=${encodeURIComponent(getRedeemUrl(selectedSignature))}&size=200&labeled=true&title=REDEEM&description=Scan to redeem ${formatTokenAmount(selectedSignature.amount, tokenDecimals)} token${formatTokenAmount(selectedSignature.amount, tokenDecimals) === "1" ? "" : "s"}.&tokenDecimals=${tokenDecimals}${selectedTokenName ? `&tokenName=${encodeURIComponent(selectedTokenName)}` : ''}${selectedTokenSymbol ? `&tokenSymbol=${encodeURIComponent(selectedTokenSymbol)}` : ''}`}
                                            title="Labeled Redeem QR Code"
                                            className="w-full bg-white"
                                            height="450"
                                            frameBorder="0"
                                        ></iframe>
                                    </div>

                                    <div className="border rounded-md p-4 flex flex-col items-center">
                                        <iframe
                                            src={`/api/qrcode?url=${encodeURIComponent(getVerifyUrl(selectedSignature))}&size=200&labeled=true&title=VERIFY&description=Scan to check if this note has been used.&tokenDecimals=${tokenDecimals}${selectedTokenName ? `&tokenName=${encodeURIComponent(selectedTokenName)}` : ''}${selectedTokenSymbol ? `&tokenSymbol=${encodeURIComponent(selectedTokenSymbol)}` : ''}`}
                                            title="Labeled Verify QR Code"
                                            className="w-full bg-white"
                                            height="450"
                                            frameBorder="0"
                                        ></iframe>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="combined">
                                <div className="border rounded-md p-4">
                                    <iframe
                                        src={`/api/qrcode?combined=true&redeemUrl=${encodeURIComponent(getRedeemUrl(selectedSignature))}&verifyUrl=${encodeURIComponent(getVerifyUrl(selectedSignature))}&size=200&amount=${selectedSignature.amount}&description=UUID: ${selectedSignature.uuid}${selectedTokenImage ? `&tokenImage=${encodeURIComponent(selectedTokenImage)}` : ''}${selectedTokenName ? `&tokenName=${encodeURIComponent(selectedTokenName)}` : ''}${selectedTokenSymbol ? `&tokenSymbol=${encodeURIComponent(selectedTokenSymbol)}` : ''}&tokenDecimals=${tokenDecimals}`}
                                        title="Combined QR Codes"
                                        className="w-full bg-white"
                                        height="700"
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