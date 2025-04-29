"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context/app-context'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Code, ArrowRight, Loader2, Check, Rocket } from 'lucide-react'
import { toast } from 'sonner'
import type { ChangeEvent } from 'react'

// Generate a random contract name with a prefix
const generateRandomName = () => {
    const prefix = 'yeet'
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let randomStr = ''
    for (let i = 0; i < 3; i++) {
        randomStr += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return `${prefix}-${randomStr}`
}

export default function YeetContractDeployment() {
    const router = useRouter()
    const { authenticated, deployContract, stxAddress } = useApp()
    const [contractName, setContractName] = useState('')
    const [contractCode, setContractCode] = useState('')
    const [isDeploying, setIsDeploying] = useState(false)
    const [txid, setTxid] = useState<string | null>(null)

    // Generate random name on component mount
    useEffect(() => {
        setContractName(generateRandomName())
    }, [])

    const handleDeploy = async () => {
        if (!authenticated) {
            toast.error('Wallet not connected', {
                description: 'Please connect your wallet to deploy a contract',
            })
            return
        }

        if (!contractCode.trim()) {
            toast.error('Contract code required', {
                description: 'Please paste your Clarity contract code',
            })
            return
        }

        try {
            setIsDeploying(true)
            toast.info('Deploying contract', {
                description: 'Please confirm the transaction in your wallet',
            })

            const result = await deployContract(contractCode, contractName)
            setTxid(result.txid)

            toast.success('Deployment initiated', {
                description: `Transaction ID: ${result.txid.substring(0, 10)}...`,
            })

            // Open the contracts page in a new tab
            window.open(`/contracts?txid=${result.txid}`, '_blank')
        } catch (error) {
            console.error('Deployment error:', error)
            toast.error('Deployment failed', {
                description: error instanceof Error ? error.message : 'There was an error deploying your contract',
            })
        } finally {
            setIsDeploying(false)
        }
    }

    // Generate a new random name
    const regenerateName = () => {
        setContractName(generateRandomName())
        toast.info('New contract name generated')
    }

    if (!authenticated) {
        return (
            <div className="container py-12 max-w-4xl">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Rocket className="h-5 w-5 text-primary" />
                            YOLO Contract Deployer
                        </CardTitle>
                        <CardDescription>
                            Quickly deploy any Clarity contract
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center py-10">
                        <div className="rounded-full bg-primary/10 p-4 mb-4">
                            <Code className="h-8 w-8 text-primary" />
                        </div>
                        <h3 className="text-xl font-medium mb-2">Wallet Not Connected</h3>
                        <p className="text-muted-foreground text-center max-w-md mb-6">
                            Please connect your wallet to deploy contracts.
                        </p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="container py-12 max-w-4xl">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Rocket className="h-5 w-5 text-primary" />
                        YOLO Contract Deployer
                    </CardTitle>
                    <CardDescription>
                        Quickly deploy any Clarity contract directly from source
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="contract-code">Clarity Contract Code</Label>
                        <Textarea
                            id="contract-code"
                            placeholder=";; Paste your Clarity contract code here..."
                            className="min-h-[300px] font-mono text-sm"
                            value={contractCode}
                            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setContractCode(e.target.value)}
                        />
                    </div>

                    {stxAddress && (
                        <div className="p-3 bg-muted/50 rounded-md space-y-2">
                            <div className="flex justify-between items-center">
                                <p className="text-sm text-muted-foreground">
                                    Contract will be deployed as: <span className="font-mono">{stxAddress}.{contractName}</span>
                                </p>
                                <Button variant="ghost" size="sm" onClick={regenerateName} className="h-8 px-2">
                                    <ArrowRight className="h-3 w-3 mr-1" /> New name
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                A random contract name is automatically generated for you. You can generate a new one if needed.
                            </p>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex justify-between">
                    <Button variant="outline" onClick={() => router.push('/contracts')}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDeploy}
                        disabled={isDeploying || !contractCode.trim()}
                    >
                        {isDeploying ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Deploying...
                            </>
                        ) : txid ? (
                            <>
                                <Check className="mr-2 h-4 w-4" />
                                Deployed
                            </>
                        ) : (
                            <>
                                Deploy Contract
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                        )}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    )
}
