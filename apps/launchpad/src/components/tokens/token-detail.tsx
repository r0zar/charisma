"use client"

import { useEffect, useState, useRef } from 'react';
import { useApp } from '@/lib/context/app-context';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { TokenMetadata } from '@/lib/metadata-service';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, Layers, Save, ArrowLeft, RefreshCcw, Loader2, PencilLine, Check, X, Upload, ImageIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface TokenDetailProps {
    contractId: string;
}

export function TokenDetail({ contractId: initialContractId }: TokenDetailProps) {
    const { authenticated, stxAddress, signMessage, loading: contextLoading } = useApp();
    const [token, setToken] = useState<TokenMetadata | null>(null);
    const [initializing, setInitializing] = useState(true);
    const [loading, setLoading] = useState(true);
    const [imageUrl, setImageUrl] = useState('');
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [activeTab, setActiveTab] = useState('basic'); // basic or advanced
    const [activeImageTab, setActiveImageTab] = useState('generate'); // generate or upload
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Contract ID editing
    const [contractId, setContractId] = useState(initialContractId);
    const [editingContractId, setEditingContractId] = useState(false);
    const [tokenIdentifier, setTokenIdentifier] = useState('');
    const [idEditError, setIdEditError] = useState('');
    const editInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        name: '',
        symbol: '',
        decimals: 6,
        identifier: '',
        description: '',
        imagePrompt: '',
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const router = useRouter();

    // Extract principal address and token identifier from contract ID
    useEffect(() => {
        if (contractId && contractId.includes('.')) {
            const parts = contractId.split('.');
            const principal = parts[0];
            const identifier = parts.slice(1).join('.');
            setTokenIdentifier(identifier);
        }
    }, [contractId]);

    useEffect(() => {
        async function fetchToken() {
            console.log("TokenDetail: useEffect triggered. contractId:", contractId);
            if (!contractId) {
                console.log("TokenDetail: No contractId provided.");
                setLoading(false); // Ensure loading stops if no ID
                return;
            }

            try {
                console.log(`TokenDetail: Fetching data for ${contractId}...`);
                setLoading(true);
                const response = await fetch(`/api/v1/metadata/${contractId}`);
                console.log(`TokenDetail: API response status for ${contractId}:`, response.status);

                if (response.ok) {
                    const { metadata: data } = await response.json();
                    console.log(`TokenDetail: API data received for ${contractId}:`, data);
                    setToken(data);
                    setFormData({
                        name: data.name || '',
                        symbol: data.symbol || '',
                        decimals: data.decimals || 6,
                        identifier: data.identifier || '',
                        description: data.description || '',
                        imagePrompt: '', // Reset prompt on load
                    });
                    if (data.image) {
                        setImageUrl(data.image);
                    } else {
                        setImageUrl(''); // Clear image if none exists
                    }
                    console.log(`TokenDetail: State updated for ${contractId}.`);
                } else if (response.status === 404) {
                    console.log(`TokenDetail: Token ${contractId} not found (404). Setting defaults.`);
                    // New token
                    const defaultSymbol = tokenIdentifier?.toUpperCase() || 'TOKEN';
                    setToken(null); // Ensure token state is null for new
                    setImageUrl(''); // Clear image url
                    setFormData({
                        name: 'New Token',
                        symbol: defaultSymbol,
                        decimals: 6,
                        identifier: defaultSymbol,
                        description: '',
                        imagePrompt: '',
                    });
                } else {
                    // Handle other non-OK responses
                    console.error(`TokenDetail: API error for ${contractId}. Status: ${response.status}`);
                    setError(`Failed to load token data (Status: ${response.status})`);
                }
            } catch (error) {
                console.error(`TokenDetail: Failed to fetch token ${contractId}:`, error);
                setError('An error occurred while fetching token data.');
            } finally {
                setLoading(false);
                console.log(`TokenDetail: Fetch process finished for ${contractId}. Loading set to false.`);
            }
        }

        fetchToken();
        // Consider removing tokenIdentifier if it causes issues, but it's needed for defaultSymbol on 404
    }, [contractId, tokenIdentifier]); // Runs when contractId or tokenIdentifier changes

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'decimals' ? parseInt(value, 10) : value
        }));
    };

    // Start editing the contract ID
    const startEditingContractId = () => {
        setEditingContractId(true);
        setIdEditError('');
        // Focus the input after rendering
        setTimeout(() => {
            if (editInputRef.current) {
                editInputRef.current.focus();
            }
        }, 0);
    };

    // Cancel editing the contract ID
    const cancelEditingContractId = () => {
        setEditingContractId(false);
        setIdEditError('');
    };

    // Save the edited contract ID
    const saveEditedContractId = () => {
        // Validation
        if (!/^[a-z0-9\-]+$/.test(tokenIdentifier)) {
            setIdEditError('Token identifier can only contain lowercase letters, numbers, and hyphens');
            return;
        }

        if (tokenIdentifier.trim() === '') {
            setIdEditError('Token identifier cannot be empty');
            return;
        }

        // Extract the principal address part from the current contractId
        const principalAddress = contractId.split('.')[0];
        const newContractId = `${principalAddress}.${tokenIdentifier}`;

        // If changed, navigate to the new contract ID
        if (newContractId !== contractId) {
            router.push(`/tokens/${encodeURIComponent(newContractId)}`);
        }

        setEditingContractId(false);
        setIdEditError('');
    };

    // Handle file selection for image upload
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setError('Image size should be less than 5MB');
            return;
        }

        try {
            setUploading(true);
            setError('');

            // Create FormData and append the file
            const formData = new FormData();
            formData.append('image', file);
            formData.append('contractId', contractId);

            // Sign the message to authenticate
            let signature, publicKey;
            try {
                const signResult = await signMessage(contractId);
                signature = signResult.signature;
                publicKey = signResult.publicKey;

                if (!signature || !publicKey) {
                    throw new Error('Failed to sign message with wallet');
                }
            } catch (signError) {
                console.error('Error signing message:', signError);
                setError('Please sign the message with your wallet to authenticate the request.');
                setUploading(false);
                return;
            }

            // Upload the image to your API
            const response = await fetch(`/api/v1/metadata/upload/${contractId}`, {
                method: 'POST',
                headers: {
                    'x-signature': signature,
                    'x-public-key': publicKey,
                },
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to upload image');
            }

            const data = await response.json();
            if (data.success && data.imageUrl) {
                setImageUrl(data.imageUrl);
                setSuccess('Image uploaded successfully!');

                // Clear success message after 3 seconds
                setTimeout(() => setSuccess(''), 3000);
            }
        } catch (error) {
            console.error('Failed to upload image:', error);
            setError('Failed to upload image. Please try again.');
        } finally {
            setUploading(false);
            // Reset the file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Trigger the file input click
    const triggerFileUpload = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleGenerateImage = async () => {
        if (!contractId) return;

        try {
            setGenerating(true);
            setError('');

            // Sign the contract ID as a message to authenticate
            let signature, publicKey;
            try {
                const signResult = await signMessage(contractId);
                signature = signResult.signature;
                publicKey = signResult.publicKey;

                if (!signature || !publicKey) {
                    throw new Error('Failed to sign message with wallet');
                }
            } catch (signError) {
                console.error('Error signing message:', signError);
                setError('Please sign the message with your wallet to authenticate the request.');
                setGenerating(false);
                return;
            }

            const response = await fetch(`/api/v1/metadata/generate/${contractId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-signature': signature,
                    'x-public-key': publicKey,
                },
                body: JSON.stringify({
                    ...formData,
                    properties: token?.properties || {}
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate image');
            }

            const data = await response.json();
            if (data.success && data.metadata) {
                setToken(data.metadata);
                setImageUrl(data.metadata.image);
                setSuccess('Image generated successfully!');

                // Clear success message after 3 seconds
                setTimeout(() => setSuccess(''), 3000);
            }
        } catch (error) {
            console.error('Failed to generate image:', error);
            setError('Failed to generate image. Please try again.');
        } finally {
            setGenerating(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!contractId || !authenticated) return;

        try {
            setSaving(true);
            setError('');

            // Sign the contract ID as a message to authenticate
            const { signature, publicKey } = await signMessage(contractId);

            const response = await fetch(`/api/v1/metadata/${contractId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-signature': signature,
                    'x-public-key': publicKey,
                },
                body: JSON.stringify({
                    ...formData,
                    image: imageUrl,
                    properties: token?.properties || {}
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save metadata');
            }

            const data = await response.json();
            setToken(data.metadata);
            setSuccess('Metadata saved successfully!');

            // Clear success message after 3 seconds
            setTimeout(() => setSuccess(''), 3000);
        } catch (error) {
            console.error('Failed to save metadata:', error);
            setError(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setSaving(false);
        }
    };

    // Use contextLoading to determine if the app context (and auth state) is still initializing
    const isInitializing = contextLoading && !authenticated;

    if (isInitializing) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Layers className="w-8 h-8 text-primary/60" />
                    </div>
                </div>
                <p className="mt-4 text-muted-foreground">Initializing...</p>
            </div>
        );
    }

    if (!authenticated) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center py-12 bg-gradient-to-b from-background to-muted/20 rounded-xl">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <Layers className="w-10 h-10 text-primary/60" />
                </div>
                <h2 className="text-2xl font-semibold mb-2">Connect your wallet</h2>
                <p className="text-muted-foreground max-w-md">
                    Please connect your wallet to manage token metadata
                </p>
            </div>
        );
    }

    // Use the local loading state for fetching this specific token's data
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Layers className="w-8 h-8 text-primary/60" />
                    </div>
                </div>
                <p className="mt-4 text-muted-foreground">Loading token metadata...</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header with Back Button and Contract ID */}
            <div className="mb-8 flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => router.push('/tokens')}
                        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="mr-1 h-4 w-4" />
                        Back to Tokens
                    </button>

                    {saving ? (
                        <Button disabled className="gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Saving...
                        </Button>
                    ) : (
                        <Button
                            onClick={handleSubmit}
                            className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-300"
                        >
                            <Save className="h-4 w-4" />
                            Save Metadata
                        </Button>
                    )}
                </div>

                <div className="flex items-start justify-between flex-col sm:flex-row gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            {formData.name || 'New Token'}
                        </h1>
                        {formData.symbol && (
                            <div className="mt-1 text-lg text-muted-foreground">
                                ${formData.symbol}
                            </div>
                        )}
                    </div>

                    <div className="px-4 py-2 bg-muted/30 border border-border/50 rounded-lg min-w-[280px]">
                        <div className="flex items-center justify-between mb-1">
                            <div className="text-xs text-muted-foreground">Contract ID</div>
                            {!editingContractId ? (
                                <button
                                    onClick={startEditingContractId}
                                    className="text-xs text-primary hover:text-primary/80 transition-colors"
                                    title="Edit token identifier"
                                >
                                    <PencilLine className="h-3 w-3" />
                                </button>
                            ) : (
                                <div className="flex items-center space-x-1">
                                    <button
                                        onClick={saveEditedContractId}
                                        className="text-xs text-green-500 hover:text-green-600 transition-colors"
                                        title="Save changes"
                                    >
                                        <Check className="h-3 w-3" />
                                    </button>
                                    <button
                                        onClick={cancelEditingContractId}
                                        className="text-xs text-red-500 hover:text-red-600 transition-colors"
                                        title="Cancel"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {!editingContractId ? (
                            <div className="font-mono text-sm text-foreground/80 break-all">{contractId}</div>
                        ) : (
                            <div>
                                <div className="flex items-center mt-1">
                                    <div className="font-mono text-sm text-foreground/80 shrink-0">
                                        {contractId.split('.')[0]}.
                                    </div>
                                    <input
                                        ref={editInputRef}
                                        value={tokenIdentifier}
                                        onChange={(e) => {
                                            setTokenIdentifier(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                                            setIdEditError('');
                                        }}
                                        className="font-mono text-sm py-0 h-7 border-none bg-transparent focus:outline-none focus:ring-0 px-1 w-full"
                                        placeholder="token-identifier"
                                    />
                                </div>
                                {idEditError && (
                                    <div className="text-xs text-destructive mt-1">{idEditError}</div>
                                )}
                                <div className="text-xs text-muted-foreground mt-1">
                                    Use lowercase letters, numbers, and hyphens only
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Notification Messages */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg mb-6 flex items-center"
                    >
                        <div className="mr-2 flex-shrink-0 h-5 w-5 text-destructive">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div>{error}</div>
                    </motion.div>
                )}

                {success && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg mb-6 flex items-center"
                    >
                        <div className="mr-2 flex-shrink-0 h-5 w-5 text-green-500">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div>{success}</div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-12 gap-8">
                {/* Left Column: Token Image */}
                <div className="col-span-12 md:col-span-4">
                    <div className="sticky top-24 space-y-6">
                        <div className="bg-gradient-to-br from-background to-muted/30 border border-border/50 rounded-xl p-6 overflow-hidden">
                            <h3 className="text-lg font-medium mb-4 flex items-center">
                                <Layers className="inline mr-2 h-5 w-5 text-primary/70" />
                                Token Image
                            </h3>

                            <div className="aspect-square mb-4 relative rounded-lg overflow-hidden bg-gradient-to-br from-muted/50 to-muted border border-border/50 flex items-center justify-center">
                                {imageUrl ? (
                                    <Image
                                        src={imageUrl}
                                        alt={formData.name}
                                        fill
                                        sizes="(max-width: 768px) 100vw, 300px"
                                        className="object-cover"
                                        unoptimized={true}
                                    />
                                ) : (
                                    <div className="text-center p-6 text-muted-foreground">
                                        <Layers className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                        <p className="text-sm">No image yet</p>
                                    </div>
                                )}
                            </div>

                            {/* Image Action Tabs */}
                            <div className="mb-4 border-b border-border/40">
                                <div className="flex">
                                    <button
                                        className={`py-2 px-3 text-sm font-medium border-b-2 transition-colors ${activeImageTab === 'generate'
                                            ? 'border-primary text-primary'
                                            : 'border-transparent text-muted-foreground hover:text-foreground'
                                            }`}
                                        onClick={() => setActiveImageTab('generate')}
                                    >
                                        Generate
                                    </button>
                                    <button
                                        className={`py-2 px-3 text-sm font-medium border-b-2 transition-colors ${activeImageTab === 'upload'
                                            ? 'border-primary text-primary'
                                            : 'border-transparent text-muted-foreground hover:text-foreground'
                                            }`}
                                        onClick={() => setActiveImageTab('upload')}
                                    >
                                        Upload
                                    </button>
                                </div>
                            </div>

                            {activeImageTab === 'generate' ? (
                                <div className="space-y-3">
                                    <div>
                                        <label htmlFor="imagePrompt" className="text-sm font-medium text-foreground/80 block mb-1.5">
                                            Image Generation Prompt
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                id="imagePrompt"
                                                name="imagePrompt"
                                                className="w-full pl-3 pr-10 py-2 border border-border bg-background/50 rounded-md focus:ring-1 focus:ring-primary/30 focus:border-primary/40 outline-none transition-all"
                                                value={formData.imagePrompt}
                                                onChange={handleChange}
                                                placeholder="Describe token's appearance..."
                                            />
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleGenerateImage}
                                        disabled={generating || !formData.imagePrompt}
                                        className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-all
                                            ${generating || !formData.imagePrompt
                                                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                                : 'bg-gradient-to-r from-primary/90 to-primary/70 text-primary-foreground hover:from-primary hover:to-primary/80'}`}
                                    >
                                        {generating ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="h-4 w-4" />
                                                Generate Image
                                            </>
                                        )}
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="border-2 border-dashed border-border/70 rounded-lg p-4 text-center">
                                        <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                        <p className="text-sm text-muted-foreground mb-2">
                                            {uploading ? 'Uploading...' : 'Drag & drop or click to upload'}
                                        </p>
                                        <p className="text-xs text-muted-foreground mb-3">
                                            PNG, JPG or SVG (max 5MB)
                                        </p>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            accept="image/*"
                                            className="hidden"
                                        />
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={triggerFileUpload}
                                            disabled={uploading}
                                            className="w-full"
                                        >
                                            {uploading ? (
                                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                            ) : (
                                                <Upload className="h-4 w-4 mr-2" />
                                            )}
                                            {uploading ? 'Uploading...' : 'Select File'}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Token Details Form */}
                <div className="col-span-12 md:col-span-8">
                    <div className="bg-gradient-to-br from-background to-muted/30 border border-border/50 rounded-xl overflow-hidden">
                        {/* Tab Navigation */}
                        <div className="flex border-b border-border/50">
                            <button
                                className={`flex-1 py-3 px-4 text-center text-sm font-medium ${activeTab === 'basic' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground/80'}`}
                                onClick={() => setActiveTab('basic')}
                            >
                                Basic Information
                            </button>
                            <button
                                className={`flex-1 py-3 px-4 text-center text-sm font-medium ${activeTab === 'advanced' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground/80'}`}
                                onClick={() => setActiveTab('advanced')}
                            >
                                Advanced Details
                            </button>
                        </div>

                        {/* Form Content */}
                        <div className="p-6">
                            {activeTab === 'basic' ? (
                                <div className="space-y-5">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        <div>
                                            <label htmlFor="name" className="text-sm font-medium text-foreground/80 block mb-1.5">
                                                Token Name
                                            </label>
                                            <input
                                                type="text"
                                                id="name"
                                                name="name"
                                                className="w-full px-3 py-2 border border-border bg-background/50 rounded-md focus:ring-1 focus:ring-primary/30 focus:border-primary/40 outline-none transition-all"
                                                value={formData.name}
                                                onChange={handleChange}
                                                required
                                                placeholder="e.g., Bitcoin"
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="symbol" className="text-sm font-medium text-foreground/80 block mb-1.5">
                                                Token Symbol
                                            </label>
                                            <input
                                                type="text"
                                                id="symbol"
                                                name="symbol"
                                                className="w-full px-3 py-2 border border-border bg-background/50 rounded-md focus:ring-1 focus:ring-primary/30 focus:border-primary/40 outline-none transition-all"
                                                value={formData.symbol}
                                                onChange={handleChange}
                                                required
                                                placeholder="e.g., BTC"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label htmlFor="description" className="text-sm font-medium text-foreground/80 block mb-1.5">
                                            Description
                                        </label>
                                        <textarea
                                            id="description"
                                            name="description"
                                            rows={4}
                                            className="w-full px-3 py-2 border border-border bg-background/50 rounded-md focus:ring-1 focus:ring-primary/30 focus:border-primary/40 outline-none transition-all resize-none"
                                            value={formData.description}
                                            onChange={handleChange}
                                            placeholder="Describe your token's purpose and features..."
                                        ></textarea>
                                        <div className="mt-1 text-xs text-muted-foreground">
                                            {formData.description.length} / 500 characters
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        <div>
                                            <label htmlFor="identifier" className="text-sm font-medium text-foreground/80 block mb-1.5">
                                                Identifier
                                            </label>
                                            <input
                                                type="text"
                                                id="identifier"
                                                name="identifier"
                                                className="w-full px-3 py-2 border border-border bg-background/50 rounded-md focus:ring-1 focus:ring-primary/30 focus:border-primary/40 outline-none transition-all"
                                                value={formData.identifier}
                                                onChange={handleChange}
                                                required
                                            />
                                            <div className="mt-1 text-xs text-muted-foreground">
                                                Unique identifier for your token
                                            </div>
                                        </div>
                                        <div>
                                            <label htmlFor="decimals" className="text-sm font-medium text-foreground/80 block mb-1.5">
                                                Decimals
                                            </label>
                                            <input
                                                type="number"
                                                id="decimals"
                                                name="decimals"
                                                min="0"
                                                max="18"
                                                className="w-full px-3 py-2 border border-border bg-background/50 rounded-md focus:ring-1 focus:ring-primary/30 focus:border-primary/40 outline-none transition-all"
                                                value={formData.decimals}
                                                onChange={handleChange}
                                                required
                                            />
                                            <div className="mt-1 text-xs text-muted-foreground">
                                                Number of decimal places (0-18)
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-muted/40 border border-border/50 rounded-lg p-4">
                                        <h4 className="text-sm font-medium mb-2 flex items-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 mr-1.5 text-primary/70">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                                            </svg>
                                            Advanced Properties
                                        </h4>
                                        <p className="text-xs text-muted-foreground">
                                            Additional properties will be displayed here once your token is saved. These include blockchain-specific attributes and custom metadata.
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="mt-8 pt-6 border-t border-border/40 flex justify-between">
                                <Button
                                    variant="outline"
                                    onClick={() => router.push('/tokens')}
                                    className="text-muted-foreground"
                                >
                                    Cancel
                                </Button>

                                <Button
                                    onClick={handleSubmit}
                                    disabled={saving}
                                    className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-300"
                                >
                                    {saving ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="h-4 w-4" />
                                            Save Metadata
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 