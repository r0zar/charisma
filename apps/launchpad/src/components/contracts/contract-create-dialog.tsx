"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { ContractType } from "@/components/contracts/contracts-list"

export interface ContractCreateDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    initialType: ContractType
}

export function ContractCreateDialog({
    open,
    onOpenChange,
    initialType
}: ContractCreateDialogProps) {
    const router = useRouter()
    const { toast } = useToast()
    const [name, setName] = useState("")
    const [isDeploying, setIsDeploying] = useState(false)

    const handleDeploy = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!name.trim()) {
            toast({
                title: "Name is required",
                description: "Please provide a name for your contract",
                variant: "destructive"
            })
            return
        }

        setIsDeploying(true)

        try {
            // Placeholder for actual deployment logic
            // This would connect to a blockchain service in a real implementation
            await new Promise(resolve => setTimeout(resolve, 1500))

            // Success notification
            toast({
                title: "Contract initiated",
                description: "Your contract deployment has been initiated successfully",
            })

            // Redirect to the proper deployment page based on type
            if (initialType === 'sip10') {
                router.push(`/templates/sip10?name=${encodeURIComponent(name)}`)
            } else if (initialType === 'liquidity-pool') {
                router.push(`/templates/liquidity-pool?name=${encodeURIComponent(name)}`)
            } else if (initialType === 'custom' || initialType === 'audit') {
                // For custom contracts and audits, we'll redirect to a contact form
                router.push(`/contact?service=${initialType}&name=${encodeURIComponent(name)}`)
                toast({
                    title: "Request submitted",
                    description: `Your ${initialType === 'custom' ? 'custom contract' : 'audit'} request has been recorded. Our team will contact you shortly.`,
                })
            }

            onOpenChange(false)
        } catch (error) {
            toast({
                title: "Deployment failed",
                description: "There was an error initiating your contract. Please try again.",
                variant: "destructive"
            })
        } finally {
            setIsDeploying(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create New Contract</DialogTitle>
                    <DialogDescription>
                        Provide basic information to start deploying your contract
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleDeploy}>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Contract Name</Label>
                            <Input
                                id="name"
                                placeholder="My Token"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>Contract Type</Label>
                            <div className="px-3 py-2 border rounded-md bg-muted/50">
                                {initialType === 'sip10' ? 'SIP-10 Token' :
                                    initialType === 'liquidity-pool' ? 'AMM Liquidity Pool' :
                                        initialType === 'custom' ? 'Custom Smart Contract' : 'Smart Contract Audit'}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            type="button"
                            onClick={() => onOpenChange(false)}
                            disabled={isDeploying}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={isDeploying}
                        >
                            {isDeploying ? "Initializing..." : "Deploy Contract"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
} 