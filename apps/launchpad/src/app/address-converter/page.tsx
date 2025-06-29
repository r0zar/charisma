"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { callReadOnlyFunction } from '@repo/polyglot'
import {
    principalCV,
    stringAsciiCV,
    bufferCV,
    uintCV,
    listCV,
    trueCV,
    falseCV
} from '@stacks/transactions'
import { ClarityValue } from '@stacks/connect/dist/types/methods'
import dynamic from 'next/dynamic'

// Import icons with dynamic loading to prevent hydration issues
const ArrowDown = dynamic(() => import('lucide-react').then(mod => mod.ArrowDown), { ssr: false })
const RotateCcw = dynamic(() => import('lucide-react').then(mod => mod.RotateCcw), { ssr: false })
const FileCode = dynamic(() => import('lucide-react').then(mod => mod.FileCode), { ssr: false })
const Code = dynamic(() => import('lucide-react').then(mod => mod.Code), { ssr: false })
const CheckCircle = dynamic(() => import('lucide-react').then(mod => mod.CheckCircle), { ssr: false })
const AlertTriangle = dynamic(() => import('lucide-react').then(mod => mod.AlertTriangle), { ssr: false })

// Contract details
const CONTRACT_ADDRESS = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS'
const CONTRACT_NAME = 'yeet-bs0'

// Helper to convert hex string to Uint8Array
const hexToUint8Array = (hex: string): Uint8Array => {
    const hexString = hex.startsWith('0x') ? hex.slice(2) : hex
    const len = hexString.length
    const uint8Array = new Uint8Array(len / 2)

    for (let i = 0; i < len; i += 2) {
        uint8Array[i / 2] = parseInt(hexString.substring(i, i + 2), 16)
    }

    return uint8Array
}

// Custom JSON replacer for handling BigInt
const customJSONReplacer = (key: string, value: any): any => {
    if (typeof value === 'bigint') {
        return value.toString()
    }
    return value
}

// Safe JSON stringify
const safeStringify = (value: any): string => {
    try {
        return JSON.stringify(value, customJSONReplacer)
    } catch (error) {
        return `[Complex Value: ${typeof value}]`
    }
}

// Add a list parser helper function to convert text input to list of items
const parseListInput = (input: string, itemType: string): any[] => {
    // Handle empty string
    if (!input.trim()) return []

    // Split by commas, remove whitespace
    const items = input.split(',').map(item => item.trim())

    // Convert each item based on type
    return items.map(item => {
        switch (itemType) {
            case 'uint':
                return uintCV(parseInt(item))
            case 'string':
                return stringAsciiCV(item)
            case 'boolean':
                return item.toLowerCase() === 'true' ? trueCV() : falseCV()
            case 'hex':
                return bufferCV(hexToUint8Array(item))
            case 'principal':
                return principalCV(item)
            default:
                return stringAsciiCV(item)
        }
    })
}

export default function AddressConverterPage() {
    // State for main conversion
    const [stxAddress, setStxAddress] = useState<string>('SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE')
    const [btcAddress, setBtcAddress] = useState<string>('')
    const [isConverting, setIsConverting] = useState<boolean>(false)
    const [logs, setLogs] = useState<string[]>([])
    const [error, setError] = useState<string | null>(null)
    const [rawResponse, setRawResponse] = useState<any>(null)

    // State for helper function testing
    const [selectedFunction, setSelectedFunction] = useState<string>('convert')
    const [inputs, setInputs] = useState<Record<string, string>>({
        'principal': 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE',
        'uint': '0',
        'hex': '0x00',
        'string': '',
        'buff': '0x0000000000000000000000000000000000000000',
        'list': '',
        'list-type': 'uint'
    })
    const [helperResult, setHelperResult] = useState<any>(null)
    const [isTestingHelper, setIsTestingHelper] = useState<boolean>(false)

    // Sample STX addresses
    const sampleAddresses = [
        { stx: 'SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE', description: 'Sample Address 1' },
        { stx: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS', description: 'Contract Owner' },
        { stx: 'SP1P72Z3704VMT3DMHPP2CB8TGQWGDBHD3RPR9GZS', description: 'Sample Address 2' }
    ]

    // Helper functions available in the contract
    const helperFunctions = [
        { id: 'convert', name: 'convert', params: ['principal'], description: 'Convert STX to BTC address' },
        { id: 'outer-loop', name: 'outer-loop', params: ['uint', 'list'], description: 'Process a byte in base58 encoding' },
        { id: 'update-out', name: 'update-out', params: ['uint', 'list'], description: 'Update the output buffer during encoding' },
        { id: 'carry-push', name: 'carry-push', params: ['buff', 'list'], description: 'Handle carries during base58 encoding' },
        { id: 'convert-to-base58-string', name: 'convert-to-base58-string', params: ['uint', 'string'], description: 'Convert uint to base58 char & concatenate' },
        { id: 'hex-to-uint', name: 'hex-to-uint', params: ['hex'], description: 'Convert hex byte to uint' },
        { id: 'is-zero', name: 'is-zero', params: ['uint'], description: 'Check if uint is zero' }
    ]

    // Pretty print function
    const prettyPrint = (obj: any): string => {
        try {
            return JSON.stringify(obj, customJSONReplacer, 2)
        } catch (e) {
            return String(obj)
        }
    }

    // Handle input change for helper function testing
    const handleInputChange = (param: string, value: string) => {
        setInputs(prev => ({
            ...prev,
            [param]: value
        }))
    }

    // Convert STX to BTC
    const convertStxToBtc = async () => {
        if (!stxAddress.trim()) {
            toast.error('Please enter a STX address')
            return
        }

        setIsConverting(true)
        setError(null)
        setLogs(['Starting conversion from STX to BTC...'])
        setRawResponse(null)

        try {
            setLogs(prev => [...prev, `Calling contract function convert with principal: ${stxAddress}`])

            const result = await callReadOnlyFunction(
                CONTRACT_ADDRESS,
                CONTRACT_NAME,
                'convert',
                [principalCV(stxAddress)]
            )

            setRawResponse(result)
            setLogs(prev => [...prev, 'Received response from contract'])

            if (result && result.value) {
                // Assuming result.value contains the BTC address (remove 'ok' wrapper if present)
                let btcAddr = result.value
                if (typeof btcAddr === 'string' && btcAddr.startsWith('(ok ')) {
                    btcAddr = btcAddr.substring(4, btcAddr.length - 1)
                    // Remove quotes if present
                    if (btcAddr.startsWith('"') && btcAddr.endsWith('"')) {
                        btcAddr = btcAddr.substring(1, btcAddr.length - 1)
                    }
                }

                setBtcAddress(btcAddr)
                setLogs(prev => [...prev, `Conversion successful: ${btcAddr}`])
                toast.success('Conversion successful')
            } else {
                setError('Invalid response from contract')
                toast.error('Invalid response format')
            }
        } catch (error) {
            console.error('Conversion error:', error)
            setError(error instanceof Error ? error.message : 'Failed to convert address')
            toast.error('Conversion error', {
                description: error instanceof Error ? error.message : 'Failed to convert address'
            })
        } finally {
            setIsConverting(false)
        }
    }

    // Test a helper function
    const testHelperFunction = async () => {
        const helper = helperFunctions.find(h => h.id === selectedFunction)
        if (!helper) return

        setIsTestingHelper(true)
        setHelperResult(null)
        setError(null)
        setLogs([`Testing helper function: ${helper.name}...`])

        try {
            // Prepare arguments based on the function's parameters
            const args: ClarityValue[] = helper.params.map(param => {
                const value = inputs[param] || ''

                switch (param) {
                    case 'principal':
                        return principalCV(value)
                    case 'uint':
                        return uintCV(parseInt(value))
                    case 'hex':
                        return bufferCV(hexToUint8Array(value))
                    case 'buff':
                        return bufferCV(hexToUint8Array(value))
                    case 'string':
                        return stringAsciiCV(value)
                    case 'list':
                        // Process the list based on the selected item type
                        const listType = inputs['list-type'] || 'uint'
                        const listItems = parseListInput(value, listType)
                        return listCV(listItems)
                    default:
                        return stringAsciiCV(value)
                }
            })

            setLogs(prev => [
                ...prev,
                `Calling ${helper.name} with arguments: ${args.map(arg => safeStringify(arg)).join(', ')}`
            ])

            const result = await callReadOnlyFunction(
                CONTRACT_ADDRESS,
                CONTRACT_NAME,
                helper.name,
                args
            )

            setHelperResult(result)
            setLogs(prev => [...prev, 'Raw response:'])
            setLogs(prev => [...prev, prettyPrint(result)])

        } catch (error) {
            console.error(`Error testing helper function ${helper.name}:`, error)
            setError(error instanceof Error ? error.message : `Failed to test ${helper.name}`)
            toast.error(`Error testing ${helper.name}`, {
                description: error instanceof Error ? error.message : 'Unknown error'
            })
        } finally {
            setIsTestingHelper(false)
        }
    }

    // Use a sample address
    const useSampleAddress = (sample: typeof sampleAddresses[0]) => {
        setStxAddress(sample.stx)
        toast.info(`Loaded sample address: ${sample.description}`)
    }

    return (
        <div className="container py-12">
            <div className="max-w-4xl mx-auto">
                <div className="flex flex-col items-center mb-8 text-center">
                    <h1 className="text-3xl font-bold mb-2">STX to BTC Address Converter</h1>
                    <p className="text-muted-foreground max-w-2xl">
                        Test the Clarity smart contract that converts Stacks addresses to Bitcoin format using Base58 encoding
                    </p>
                    <div className="mt-2">
                        <Badge variant="outline" className="font-mono">
                            Contract: {CONTRACT_ADDRESS}.{CONTRACT_NAME}
                        </Badge>
                    </div>
                </div>

                <Tabs defaultValue="converter" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="converter">Main Converter</TabsTrigger>
                        <TabsTrigger value="helpers">Helper Functions</TabsTrigger>
                    </TabsList>

                    {/* Main Converter Tab */}
                    <TabsContent value="converter">
                        <Card>
                            <CardHeader>
                                <CardTitle>STX to BTC Address Converter</CardTitle>
                                <CardDescription>Convert a Stacks address to Bitcoin format</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-6">
                                    {/* Input Section */}
                                    <div>
                                        <label className="text-sm font-medium mb-2 block">Stacks (STX) Address</label>
                                        <div className="flex gap-3">
                                            <Input
                                                placeholder="Enter STX address (e.g., SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE)"
                                                value={stxAddress}
                                                onChange={(e) => setStxAddress(e.target.value)}
                                                className="flex-1"
                                            />
                                            <Button
                                                onClick={convertStxToBtc}
                                                disabled={isConverting}
                                            >
                                                {isConverting ? (
                                                    <RotateCcw className="mr-2 h-4 w-4 animate-spin" />
                                                ) : (
                                                    <ArrowDown className="mr-2 h-4 w-4" />
                                                )}
                                                Convert
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Sample Addresses */}
                                    <div>
                                        <h3 className="text-sm font-medium mb-2">Sample Addresses</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {sampleAddresses.map((sample, index) => (
                                                <Button
                                                    key={index}
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => useSampleAddress(sample)}
                                                >
                                                    {sample.description}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Result Section */}
                                    <div>
                                        <h3 className="text-sm font-medium mb-2">Bitcoin (BTC) Address</h3>
                                        <div className="p-3 bg-muted rounded-md font-mono break-all">
                                            {btcAddress || 'Conversion result will appear here'}
                                        </div>
                                    </div>

                                    {/* Logs */}
                                    {logs.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-medium mb-2">Execution Log</h3>
                                            <div className="p-3 bg-black text-green-400 font-mono text-xs rounded-lg h-40 overflow-y-auto">
                                                {logs.map((log, index) => (
                                                    <div key={index} className="py-0.5 whitespace-pre-wrap">
                                                        &gt; {log}
                                                    </div>
                                                ))}
                                                {isConverting && (
                                                    <div className="py-0.5 animate-pulse">
                                                        &gt; _
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Error Display */}
                                    {error && (
                                        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md">
                                            <div className="flex items-start">
                                                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mr-2 flex-shrink-0 mt-0.5" />
                                                <div>
                                                    <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Error</h3>
                                                    <p className="text-xs text-red-700 dark:text-red-400 mt-1">{error}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Raw Response */}
                                    {rawResponse && (
                                        <Accordion type="single" collapsible>
                                            <AccordionItem value="raw-response">
                                                <AccordionTrigger className="text-sm">
                                                    Raw Contract Response
                                                </AccordionTrigger>
                                                <AccordionContent>
                                                    <div className="p-3 bg-muted/80 rounded-md overflow-auto">
                                                        <pre className="text-xs font-mono whitespace-pre-wrap">
                                                            {prettyPrint(rawResponse)}
                                                        </pre>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        </Accordion>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Helper Functions Tab */}
                    <TabsContent value="helpers">
                        <Card>
                            <CardHeader>
                                <CardTitle>Test Contract Helper Functions</CardTitle>
                                <CardDescription>Test individual helper functions from the contract</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-6">
                                    {/* Helper Function Selection */}
                                    <div>
                                        <label className="text-sm font-medium block mb-2">Select Helper Function</label>
                                        <Select
                                            value={selectedFunction}
                                            onValueChange={(value: string) => setSelectedFunction(value)}
                                        >
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Select Helper Function" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-background">
                                                {helperFunctions.map(helper => (
                                                    <SelectItem key={helper.id} value={helper.id}>
                                                        {helper.name} - {helper.description}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Function Parameters */}
                                    <div className="space-y-4 p-4 border rounded-lg">
                                        {helperFunctions.find(h => h.id === selectedFunction)?.params.map(param => (
                                            <div key={param} className="mb-3">
                                                <label className="text-sm font-medium block mb-1">
                                                    {param} {param === 'hex' && '(0x format)'}
                                                    {param === 'buff' && '(0x format)'}
                                                </label>

                                                {param === 'list' ? (
                                                    <div className="space-y-2">
                                                        <div className="flex gap-2">
                                                            <Select
                                                                value={inputs['list-type']}
                                                                onValueChange={(value: string) => handleInputChange('list-type', value)}
                                                            >
                                                                <SelectTrigger className="w-[150px]">
                                                                    <SelectValue placeholder="List Item Type" />
                                                                </SelectTrigger>
                                                                <SelectContent className="bg-background">
                                                                    <SelectItem value="uint">uint</SelectItem>
                                                                    <SelectItem value="string">string</SelectItem>
                                                                    <SelectItem value="boolean">boolean</SelectItem>
                                                                    <SelectItem value="hex">hex</SelectItem>
                                                                    <SelectItem value="principal">principal</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <Input
                                                                placeholder={`Enter comma-separated ${inputs['list-type'] || 'uint'} values`}
                                                                value={inputs[param] || ''}
                                                                onChange={(e) => handleInputChange(param, e.target.value)}
                                                                className="flex-1"
                                                            />
                                                        </div>
                                                        <p className="text-xs text-muted-foreground">
                                                            Enter comma-separated values (e.g., 1,2,3 for uints, or "foo","bar" for strings)
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <Input
                                                        placeholder={`Enter ${param}`}
                                                        value={inputs[param] || ''}
                                                        onChange={(e) => handleInputChange(param, e.target.value)}
                                                    />
                                                )}
                                            </div>
                                        ))}

                                        <Button
                                            onClick={testHelperFunction}
                                            disabled={isTestingHelper}
                                            className="w-full mt-3"
                                        >
                                            {isTestingHelper ? (
                                                <RotateCcw className="mr-2 h-4 w-4 animate-spin" />
                                            ) : (
                                                <Code className="mr-2 h-4 w-4" />
                                            )}
                                            Test Function
                                        </Button>
                                    </div>

                                    {/* Helper Result */}
                                    {helperResult && (
                                        <div>
                                            <h3 className="text-sm font-medium mb-2">Function Result</h3>
                                            <div className="p-3 bg-muted/50 rounded-md overflow-auto">
                                                <pre className="text-xs font-mono whitespace-pre-wrap">
                                                    {prettyPrint(helperResult)}
                                                </pre>
                                            </div>
                                        </div>
                                    )}

                                    {/* Helper Logs */}
                                    {logs.length > 0 && isTestingHelper && (
                                        <div>
                                            <h3 className="text-sm font-medium mb-2">Execution Log</h3>
                                            <div className="p-3 bg-black text-green-400 font-mono text-xs rounded-lg h-40 overflow-y-auto">
                                                {logs.map((log, index) => (
                                                    <div key={index} className="py-0.5 whitespace-pre-wrap">
                                                        &gt; {log}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Contract Details Section */}
                <div className="mt-8">
                    <Accordion type="single" collapsible>
                        <AccordionItem value="contract-code">
                            <AccordionTrigger className="text-sm">
                                <div className="flex items-center">
                                    <FileCode className="mr-2 h-4 w-4" />
                                    View Contract Code
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <div className="p-3 bg-muted/80 rounded-md overflow-auto">
                                    <pre className="text-xs font-mono whitespace-pre-wrap">
                                        {`(define-constant ALL_HEX 0x000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F202122232425262728292A2B2C2D2E2F303132333435363738393A3B3C3D3E3F404142434445464748494A4B4C4D4E4F505152535455565758595A5B5C5D5E5F606162636465666768696A6B6C6D6E6F707172737475767778797A7B7C7D7E7F808182838485868788898A8B8C8D8E8F909192939495969798999A9B9C9D9E9FA0A1A2A3A4A5A6A7A8A9AAABACADAEAFB0B1B2B3B4B5B6B7B8B9BABBBCBDBEBFC0C1C2C3C4C5C6C7C8C9CACBCCCDCECFD0D1D2D3D4D5D6D7D8D9DADBDCDDDEDFE0E1E2E3E4E5E6E7E8E9EAEBECEDEEEFF0F1F2F3F4F5F6F7F8F9FAFBFCFDFEFF)
(define-constant BASE58_CHARS "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz")
(define-constant STX_VER 0x16141a15)
(define-constant BTC_VER 0x00056fc4)
(define-constant LST (list))
(define-constant ERR_INVALID_ADDR (err u1))

(define-read-only (convert (addr principal))
    (match (principal-destruct? addr) 
        ;; if version byte match the network (ie. mainnet principal on mainnet, or testnet principal on testnet)
        network-match-data (convert-inner network-match-data)
        ;; if versin byte does not match the network
        network-not-match-data (convert-inner network-not-match-data)
    )
)

(define-private (convert-inner (data {hash-bytes: (buff 20), name: (optional (string-ascii 40)), version:(buff 1)}))
    (let (
        ;; exit early if contract principal
        (t1 (asserts! (is-none (get name data)) ERR_INVALID_ADDR))
        ;; convert STX version byte to BTC version
        (version (unwrap-panic (element-at? BTC_VER (unwrap-panic (index-of? STX_VER (get version data))))))
        ;; concat BTC version & hash160 
        (versioned-hash-bytes (concat version (get hash-bytes data)))
        ;; concat hash-bytes & 4 bytes checksum, and convert hext to uint
        (to-encode (map hex-to-uint (concat 
            versioned-hash-bytes 
            ;; checksum = encode versionded-hash-bytes 2x with sha256, and then extract first 4 bytes
            ;; we can use unwrap-panic twice, because sha256 of empty buff will alwasy return value
            (unwrap-panic (as-max-len? (unwrap-panic (slice? (sha256 (sha256 versioned-hash-bytes)) u0 u4)) u4))
        )))
        ;; "cut" leading zeros leveraging index-of? property
        (leading-zeros (unwrap-panic (slice? to-encode u0 (default-to u0 (index-of? (map is-zero to-encode) false)))))
    )
        (ok 
            (fold 
                convert-to-base58-string 
                (concat (fold outer-loop (unwrap-panic (slice? to-encode (len leading-zeros) u25)) LST) leading-zeros) 
                ""
            )
        )
    )
)

(define-read-only (outer-loop (x uint) (out (list 44 uint)))
    (let (
        (new-out (fold update-out out (list x)))
        (push (fold carry-push 0x0000 (list (unwrap-panic (element-at? new-out u0)))))
    )
        (concat 
            (default-to LST (slice? new-out u1 (len new-out)))
            (default-to LST (slice? push u1 (len push)))
        )
    )
)

(define-read-only (update-out (x uint) (out (list 35 uint)))
    (let (
        ;; first byte of out is always a carry from previous iteration
        (carry (+ (unwrap-panic (element-at? out u0)) (* x u256)))
    )
        (unwrap-panic (as-max-len? (concat  
            (list (/ carry u58)) ;; new carry
            (concat 
                (default-to LST (slice? out u1 (len out))) ;; existing list
                (list (mod carry u58)) ;; new value we want to append
            )
        ) u35))
    )
)

(define-read-only (carry-push (x (buff 1)) (out (list 9 uint)))
    (let (
        ;; first byte of out is always a carry from previous iteration
        (carry (unwrap-panic (element-at? out u0)))
    )
        (if (> carry u0)
            ;; we only change out if cary is > u0
            (unwrap-panic (as-max-len? (concat 
                (list (/ carry u58)) ;; new carry
                (concat
                    (default-to LST (slice? out u1 (len out))) ;; existing list
                    (list (mod carry u58)) ;; new value we want to append
                )
            ) u9))
            ;; do nothing
            out
        )
    )
)

;; converts uint to base58 caracter and concatenate in reverse order
(define-read-only (convert-to-base58-string (x uint) (out (string-ascii 44)))
    (unwrap-panic (as-max-len? (concat (unwrap-panic (element-at? BASE58_CHARS x)) out) u44))
)

(define-read-only (hex-to-uint (x (buff 1))) (unwrap-panic (index-of? ALL_HEX x)))
(define-read-only (is-zero (i uint)) (<= i u0))`}
                                    </pre>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
            </div>
        </div>
    )
} 