"use client"

import { useState } from 'react';
import { Rocket, Layers, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContractType } from '@/components/contracts/contracts-list';
import { useApp } from '@/lib/context/app-context';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";

// Set this to dynamic to ensure we always get fresh data
export const dynamic = 'force-dynamic';

const TemplatesPage = () => {
    const { authenticated } = useApp();
    const { toast } = useToast();
    const router = useRouter();

    const handleDeployClick = (type: ContractType) => {
        if (!authenticated) {
            toast({
                title: "Wallet not connected",
                description: "Please connect your wallet to deploy a contract",
                variant: "destructive",
            });
            return;
        }

        // Navigate directly to the template page
        if (type === 'sip10') {
            router.push(`/templates/sip10`);
        } else if (type === 'liquidity-pool') {
            router.push(`/templates/liquidity-pool`);
        } else if (type === 'custom' || type === 'audit') {
            router.push(`/contact?service=${type}`);
        }
    };

    const templates = [
        {
            group: 'SIP-10 Token Templates',
            items: [
                {
                    id: 'sip10-basic',
                    title: 'Basic SIP-10 Token',
                    description: 'A simple token contract that implements the SIP-10 specification with basic functionality. Ideal for creating a standard fungible token.',
                    icon: <Rocket className="h-6 w-6" />,
                    type: 'sip10' as ContractType,
                    features: [
                        'SIP-10 compliant',
                        'Minting and burning functions',
                        'Transfer and approve functionality',
                        'Metadata support'
                    ],
                    enabled: true
                }
            ]
        },
        {
            group: 'Liquidity Pool Templates',
            items: [
                {
                    id: 'liquidity-pool-basic',
                    title: 'AMM Liquidity Pool',
                    description: 'A simple two-token liquidity pool that enables trading between the pair with minimal fees.',
                    icon: <Layers className="h-6 w-6" />,
                    type: 'liquidity-pool' as ContractType,
                    features: [
                        'Two-token pool',
                        'Constant product formula',
                        'Add/Remove liquidity',
                        'Swap functionality',
                        'Flexible rebates'
                    ],
                    enabled: true
                }
            ]
        }
    ];

    // Flatten templates to display in a single grid
    const allTemplates = templates.flatMap(group => group.items);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="container px-4 py-8 mx-auto max-w-7xl"
        >
            <PageHeader
                title="Contract Templates"
                description="Choose a template to quickly deploy your contract. We offer various templates for different use cases."
            />

            <div className="mt-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {allTemplates.map((template, itemIndex) => (
                        <motion.div
                            key={template.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: itemIndex * 0.1 }}
                        >
                            <Card className="h-full overflow-hidden hover:shadow-md transition-shadow duration-200">
                                <CardHeader className="pb-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                            {template.icon}
                                        </div>
                                        <CardTitle>{template.title}</CardTitle>
                                    </div>
                                    <CardDescription>{template.description}</CardDescription>
                                </CardHeader>
                                <CardContent className="pb-2">
                                    <h4 className="text-sm font-medium mb-2">Features:</h4>
                                    <ul className="space-y-1">
                                        {template.features.map((feature, featureIndex) => (
                                            <li key={featureIndex} className="text-sm text-muted-foreground flex items-start">
                                                <span className="mr-2 text-primary">•</span>
                                                {feature}
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                                <CardFooter className="pt-4">
                                    <Button
                                        onClick={() => handleDeployClick(template.type)}
                                        className="w-full"
                                        disabled={!template.enabled}
                                    >
                                        Deploy Contract
                                        <ArrowRight className="w-4 h-4 ml-2" />
                                    </Button>
                                </CardFooter>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            </div>

            <div className="space-y-8 mt-16 border-t pt-12">
                <h2 className="text-2xl font-semibold mb-8">Additional Services</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Custom Contract Development CTA */}
                    <Card className="overflow-hidden">
                        <CardHeader className="pb-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                    <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                    </svg>
                                </div>
                                <CardTitle>Custom Contract Development</CardTitle>
                            </div>
                            <CardDescription>Need something specific? Our team can develop a custom smart contract tailored to your unique requirements.</CardDescription>
                        </CardHeader>
                        <CardContent className="pb-2">
                            <p className="text-sm text-muted-foreground">
                                Our expert developers can build complex smart contracts with your specific business logic and requirements.
                                From custom tokens to advanced governance systems, we've got you covered.
                            </p>
                        </CardContent>
                        <CardFooter className="pt-4">
                            <Button
                                variant="ghost"
                                onClick={() => router.push('/contact?service=custom')}
                                className="w-full"
                            >
                                Request Custom Development
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </CardFooter>
                    </Card>

                    {/* Smart Contract Audit CTA */}
                    <Card className="overflow-hidden">
                        <CardHeader className="pb-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                    <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                </div>
                                <CardTitle>Smart Contract Audit</CardTitle>
                            </div>
                            <CardDescription>Ensure your smart contract is secure and free from vulnerabilities with our professional auditing service.</CardDescription>
                        </CardHeader>
                        <CardContent className="pb-2">
                            <p className="text-sm text-muted-foreground">
                                Security is paramount in blockchain applications. Our auditing service performs comprehensive
                                code reviews and vulnerability assessments to ensure your smart contracts are secure and reliable.
                            </p>
                        </CardContent>
                        <CardFooter className="pt-4">
                            <Button
                                variant="ghost"
                                onClick={() => router.push('/contact?service=audit')}
                                className="w-full"
                            >
                                Request Audit Service
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>
        </motion.div>
    );
};

export default TemplatesPage; 