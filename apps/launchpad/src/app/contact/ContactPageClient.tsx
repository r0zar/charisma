// apps/launchpad/src/app/contact/ContactPageClient.tsx
"use client"

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2 } from 'lucide-react';

interface ContactPageClientProps {
    initialService: string | null;
    initialName: string | null;
}

export default function ContactPageClient({ initialService, initialName }: ContactPageClientProps) {
    const service = initialService;
    const name = initialName;
    const [formData, setFormData] = useState({
        name: name || '',
        email: '',
        projectName: '',
        description: '',
        serviceType: service || 'custom',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const { toast } = useToast();
    const router = useRouter();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: string, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const response = await fetch('/api/v1/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: formData.name,
                    email: formData.email,
                    projectName: formData.projectName,
                    description: formData.description,
                    serviceType: formData.serviceType,
                }),
            });

            const result = await response.json();

            if (result.success) {
                setSubmitted(true);

                toast({
                    title: "Request submitted successfully",
                    description: result.message,
                });
            } else {
                throw new Error(result.error || 'Failed to submit request');
            }
        } catch (error) {
            console.error('Submission error:', error);
            toast({
                title: "Submission failed",
                description: error instanceof Error ? error.message : "Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const serviceTitle = service === 'custom' ? 'Custom Smart Contract Development' :
        service === 'audit' ? 'Smart Contract Audit Service' :
            'Contact Us';

    const serviceDescription = service === 'custom' ?
        'Our team of experts will develop a custom smart contract tailored to your unique requirements.' :
        service === 'audit' ?
            'Ensure your smart contract is secure and free from vulnerabilities with our professional auditing service.' :
            'Get in touch with our team for any inquiries or services.';

    if (submitted) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="container px-4 py-8 mx-auto max-w-3xl"
            >
                <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20">
                    <CardHeader className="text-center">
                        <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-4">
                            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                        </div>
                        <h2 className="text-2xl font-bold">Request Submitted Successfully!</h2>
                        <p className="text-muted-foreground">
                            Thank you for your interest in our {formData.serviceType === 'custom' ? 'development' : 'audit'} services.
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-3">
                            <h3 className="font-semibold">What happens next?</h3>
                            <div className="space-y-2 text-sm text-muted-foreground">
                                <div className="flex items-start gap-2">
                                    <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                                    <span>Our team will review your request and project requirements</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                                    <span>We'll contact you at {formData.email} within 1-2 business days</span>
                                </div>
                                <div className="flex items-start gap-2">
                                    <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                                    <span>You'll receive a detailed proposal with scope, timeline, and pricing</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-muted/50 rounded-lg p-4">
                            <p className="text-sm text-muted-foreground">
                                <strong>Need immediate assistance?</strong> You can reach out to us directly on our community Discord or Telegram channels.
                            </p>
                        </div>
                    </CardContent>
                    <CardFooter className="flex gap-3">
                        <Button
                            variant="outline"
                            onClick={() => router.push('/templates')}
                            className="flex-1"
                        >
                            Browse Templates
                        </Button>
                        <Button
                            onClick={() => {
                                setSubmitted(false);
                                setFormData({
                                    name: '',
                                    email: '',
                                    projectName: '',
                                    description: '',
                                    serviceType: 'custom',
                                });
                            }}
                            className="flex-1"
                        >
                            Submit Another Request
                        </Button>
                    </CardFooter>
                </Card>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="container px-4 py-8 mx-auto max-w-3xl"
        >
            <PageHeader title={serviceTitle} description={serviceDescription} />

            <Card className="mt-8">
                <CardHeader>
                    <h2 className="text-xl font-semibold">Request Information</h2>
                    <p className="text-sm text-muted-foreground">
                        Please provide detailed information about your project so we can give you the most accurate quote and timeline.
                    </p>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Your Name *</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="John Doe"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email Address *</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    placeholder="your@email.com"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="serviceType">Service Type *</Label>
                            <Select
                                value={formData.serviceType}
                                onValueChange={(value: string) => handleSelectChange('serviceType', value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select service type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="custom">Custom Smart Contract Development</SelectItem>
                                    <SelectItem value="audit">Smart Contract Security Audit</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="projectName">Project Name *</Label>
                            <Input
                                id="projectName"
                                name="projectName"
                                value={formData.projectName}
                                onChange={handleChange}
                                placeholder="DeFi Protocol, NFT Marketplace, etc."
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Project Description *</Label>
                            <Textarea
                                id="description"
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                placeholder={
                                    formData.serviceType === 'audit'
                                        ? "Describe your smart contract(s) that need auditing. Include contract complexity, any specific security concerns, and audit scope requirements..."
                                        : "Describe your project requirements in detail. What functionality do you need? What blockchain features? Any specific compliance requirements?..."
                                }
                                className="min-h-[120px]"
                                required
                            />
                            <p className="text-xs text-muted-foreground">
                                Be as detailed as possible. This helps us provide accurate estimates.
                            </p>
                        </div>
                    </CardContent>
                    <CardFooter>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                                    Submitting Request...
                                </>
                            ) : (
                                'Submit Request'
                            )}
                        </Button>
                    </CardFooter>
                </form>
            </Card>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                <Card>
                    <CardHeader>
                        <h3 className="text-lg font-semibold">What We Offer</h3>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="space-y-2">
                            <h4 className="font-medium text-sm">Custom Development</h4>
                            <ul className="text-sm text-muted-foreground space-y-1">
                                <li>• SIP-010 token contracts</li>
                                <li>• DeFi protocols & AMM pools</li>
                                <li>• NFT marketplaces</li>
                                <li>• DAO governance systems</li>
                                <li>• Cross-chain integrations</li>
                            </ul>
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-medium text-sm">Security Audits</h4>
                            <ul className="text-sm text-muted-foreground space-y-1">
                                <li>• Comprehensive code review</li>
                                <li>• Vulnerability assessment</li>
                                <li>• Gas optimization analysis</li>
                                <li>• Security best practices</li>
                                <li>• Detailed audit report</li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <h3 className="text-lg font-semibold">Our Process</h3>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="space-y-3 text-sm">
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="text-xs font-medium text-primary">1</span>
                                </div>
                                <div>
                                    <p className="font-medium">Requirements Analysis</p>
                                    <p className="text-muted-foreground text-xs">We review your needs and create a detailed scope</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="text-xs font-medium text-primary">2</span>
                                </div>
                                <div>
                                    <p className="font-medium">Proposal & Timeline</p>
                                    <p className="text-muted-foreground text-xs">Fixed-price quote with clear deliverables</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="text-xs font-medium text-primary">3</span>
                                </div>
                                <div>
                                    <p className="font-medium">Development & Testing</p>
                                    <p className="text-muted-foreground text-xs">Built with security and efficiency in mind</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    <span className="text-xs font-medium text-primary">4</span>
                                </div>
                                <div>
                                    <p className="font-medium">Delivery & Support</p>
                                    <p className="text-muted-foreground text-xs">Deployment assistance and documentation</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </motion.div>
    );
}