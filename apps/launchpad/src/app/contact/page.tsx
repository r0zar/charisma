"use client"

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { useToast } from '@/components/ui/use-toast';
import { motion } from 'framer-motion';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';

const ContactPage = () => {
    const searchParams = useSearchParams();
    const service = searchParams.get('service');
    const name = searchParams.get('name');
    const [formData, setFormData] = useState({
        name: name || '',
        email: '',
        projectName: '',
        description: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));

            toast({
                title: "Request submitted successfully",
                description: "Our team will contact you shortly to discuss your requirements.",
            });

            // Reset form
            setFormData({
                name: '',
                email: '',
                projectName: '',
                description: '',
            });
        } catch (error) {
            toast({
                title: "Submission failed",
                description: "There was an error submitting your request. Please try again.",
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

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="container px-4 py-8 mx-auto max-w-3xl"
        >
            <PageHeader title={serviceTitle} description={serviceDescription} />

            <Card className="mt-8">
                <CardHeader className="pb-4">
                    <h2 className="text-xl font-semibold">Request Information</h2>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Your Name</Label>
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
                            <Label htmlFor="email">Email Address</Label>
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

                        <div className="space-y-2">
                            <Label htmlFor="projectName">Project Name</Label>
                            <Input
                                id="projectName"
                                name="projectName"
                                value={formData.projectName}
                                onChange={handleChange}
                                placeholder="Your project name"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">Project Requirements</Label>
                            <Textarea
                                id="description"
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                placeholder="Please describe your requirements in detail..."
                                className="min-h-[120px]"
                                required
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="flex justify-end">
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Submitting...' : 'Submit Request'}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </motion.div>
    );
};

export default ContactPage; 