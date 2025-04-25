"use client"

import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { TokenMetadata } from '@/lib/metadata-service';
import * as React from 'react';
import { useApp } from '@/lib/context/app-context';

// Constants
const TOKEN_DRAFT_KEY = 'token-draft';

export interface TokenDetailClientProps {
    contractId?: string;
    initialMetadata?: TokenMetadata;
    isNew?: boolean;
}

export function TokenDetailClient({ contractId, initialMetadata, isNew = false }: TokenDetailClientProps) {
    const { authenticated, stxAddress, signMessage, tokens, loading: tokensLoading } = useApp();
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [token, setToken] = useState<TokenMetadata | null>(initialMetadata || null);
    const [loading, setLoading] = useState<boolean>(!initialMetadata && !isNew);
    const [imageUrl, setImageUrl] = useState<string>(initialMetadata?.image || '');
    const [saving, setSaving] = useState<boolean>(false);
    const [uploading, setUploading] = useState<boolean>(false);
    const [formData, setFormData] = useState({
        name: initialMetadata?.name || '',
        description: initialMetadata?.description || '',
        prompt: initialMetadata?.prompt || '',
        symbol: initialMetadata?.symbol || '',
        decimals: initialMetadata?.decimals || 0,
    });
    const [error, setError] = useState<string>('');
    const [success, setSuccess] = useState<string>('');

    // Extract the address and token part from the contract ID
    const getContractParts = (id: string = '') => {
        const parts = id.split('.');
        return {
            address: parts.length > 1 ? parts[0] : stxAddress || '',
            tokenPart: parts.length > 1 ? parts.slice(1).join('.') : ''
        };
    };

    // Initialize contract part state
    const initialContractParts = getContractParts(contractId);
    const [tokenNamePart, setTokenNamePart] = useState<string>(initialContractParts.tokenPart);

    // Get the full contract ID
    const getFullContractId = (): string => {
        if (!tokenNamePart.trim()) return '';
        const addressPart = initialContractParts.address || stxAddress;
        return `${addressPart}.${tokenNamePart.trim()}`;
    };

    // Load draft from localStorage on mount for new tokens
    useEffect(() => {
        if (isNew) {
            const savedDraft = localStorage.getItem(TOKEN_DRAFT_KEY);
            if (savedDraft) {
                try {
                    const parsedDraft = JSON.parse(savedDraft);
                    setFormData({
                        name: parsedDraft.name || '',
                        description: parsedDraft.description || '',
                        prompt: parsedDraft.prompt || '',
                        symbol: parsedDraft.symbol || '',
                        decimals: parsedDraft.decimals || 0,
                    });
                    if (parsedDraft.image) {
                        setImageUrl(parsedDraft.image);
                    }
                    if (parsedDraft.tokenNamePart) {
                        setTokenNamePart(parsedDraft.tokenNamePart);
                    }
                } catch (e) {
                    console.error('Error parsing saved draft:', e);
                }
            }
        }
    }, [isNew, stxAddress]);

    // Save to localStorage whenever form data changes (for new tokens)
    useEffect(() => {
        if (isNew) {
            const draftData = {
                ...formData,
                image: imageUrl,
                tokenNamePart,
            };
            localStorage.setItem(TOKEN_DRAFT_KEY, JSON.stringify(draftData));
        }
    }, [formData, imageUrl, tokenNamePart, isNew]);

    // Fetch token data if needed
    useEffect(() => {
        if (!authenticated) return;
        if (initialMetadata || isNew) {
            setToken(initialMetadata || null);
            return;
        }

        if (!contractId) return;

        const fetchToken = async () => {
            try {
                setLoading(true);
                const response = await fetch(`/api/v1/metadata/${contractId}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch token data');
                }
                const data = await response.json();
                setToken(data);
                setFormData({
                    name: data.name || '',
                    description: data.description || '',
                    prompt: data.prompt || '',
                    symbol: data.symbol || '',
                    decimals: data.decimals || 0,
                });
                setImageUrl(data.image || '');

                // Set the token name part
                const parts = getContractParts(contractId);
                setTokenNamePart(parts.tokenPart);
            } catch (err) {
                console.error('Error fetching token:', err);
                setError('Failed to load token data. Please try again.');
            } finally {
                setLoading(false);
            }
        };

        fetchToken();
    }, [contractId, authenticated, initialMetadata, isNew]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'decimals' ? parseInt(value) || 0 : value
        }));
    };

    const handleGenerateImage = async () => {
        if (!formData.prompt) {
            setError('Please provide a prompt to generate an image.');
            return;
        }

        try {
            setSaving(true);
            const response = await fetch('/api/v1/generate-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ prompt: formData.prompt }),
            });

            if (!response.ok) {
                throw new Error('Failed to generate image');
            }

            const data = await response.json();
            setImageUrl(data.imageUrl);
            setSuccess('Image generated successfully!');
        } catch (err) {
            console.error('Error generating image:', err);
            setError('Failed to generate image. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('Please upload an image file (JPEG, PNG, etc.)');
            return;
        }

        // Validate file size (max 25MB)
        if (file.size > 25 * 1024 * 1024) {
            setError('Image size should be less than 25MB');
            return;
        }

        setUploading(true);
        setError('');

        const reader = new FileReader();
        reader.onload = async (event) => {
            if (!event.target?.result) {
                setError('Failed to read the image');
                setUploading(false);
                return;
            }

            try {
                // Convert to base64 string
                const base64Image = event.target.result as string;
                console.log(file)

                // Try uploading the image to the server
                try {
                    const response = await fetch('/api/v1/upload-image', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            image: base64Image,
                            filename: file.name
                        }),
                    });

                    if (!response.ok) {
                        console.log(response)
                        throw new Error('Failed to upload image');
                    }

                    const data = await response.json();
                    if (data.success) {
                        setImageUrl(data.imageUrl);
                        setSuccess('Image uploaded successfully!');
                    } else {
                        throw new Error(data.error || 'Unknown error during upload');
                    }
                } catch (uploadError) {
                    console.error('Error using upload API, using local image as fallback:', uploadError);
                    // Fallback: Use the base64 image directly
                    setImageUrl(base64Image);
                    setSuccess('Image loaded successfully (using local format)');
                }
            } catch (err) {
                console.error('Error handling image:', err);
                setError('Failed to process image. Please try again.');
            } finally {
                setUploading(false);
            }
        };

        reader.onerror = () => {
            setError('Failed to read the image file');
            setUploading(false);
        };

        reader.readAsDataURL(file);
    };

    const handleUploadClick = () => {
        fileInputRef.current?.click();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSaving(true);

        if (!formData.name || !formData.description || !imageUrl) {
            setError('Please fill in the required fields (name, description) and provide an image.');
            return;
        }

        // Validate token name part is provided
        if (!tokenNamePart.trim()) {
            setError('Token identifier is required (the part after the dot in Contract ID)');
            return;
        }

        try {
            const tokenContractId = getFullContractId();
            const origContractId = contractId;

            if (!tokenContractId) {
                throw new Error('No contract ID available');
            }

            // Sign message with wallet using our new hook
            try {
                const signatureResponse = await signMessage(tokenContractId);

                // Check if we're updating an existing token with a new ID
                if (!isNew && origContractId && tokenContractId !== origContractId) {
                    // We need to check if the new contract ID exists first
                    try {
                        const checkResponse = await fetch(`/api/v1/metadata/${tokenContractId}`);
                        const existingData = await checkResponse.json();

                        // If metadata already exists for this contract ID, don't allow overwriting
                        if (existingData && existingData.name) {
                            throw new Error(`A token with the identifier "${tokenNamePart}" already exists. Please choose a different identifier.`);
                        }
                    } catch (checkErr) {
                        // If we get a 404 or error, it likely doesn't exist, which is what we want
                        console.log('Contract ID appears to be available');
                    }
                }

                // Once we have the signature, proceed with the API call
                const response = await fetch(`/api/v1/metadata/${tokenContractId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-signature': signatureResponse.signature,
                        'x-public-key': signatureResponse.publicKey,
                    },
                    body: JSON.stringify({
                        ...formData,
                        // Ensure decimals is a number
                        decimals: typeof formData.decimals === 'string'
                            ? parseInt(formData.decimals as string) || 0
                            : formData.decimals,
                        image: imageUrl,
                    }),
                });

                if (!response.ok) {
                    throw new Error('Failed to save token metadata');
                }

                // If we changed the contract ID of an existing token, delete the old one
                if (!isNew && origContractId && tokenContractId !== origContractId) {
                    // We need to delete the old contract ID
                    try {
                        const deleteResponse = await fetch(`/api/v1/metadata/${origContractId}`, {
                            method: 'DELETE',
                            headers: {
                                'x-signature': signatureResponse.signature,
                                'x-public-key': signatureResponse.publicKey,
                            }
                        });

                        if (deleteResponse.ok) {
                            const result = await deleteResponse.json();
                            console.log(`Deleted old token metadata: ${origContractId}`, result);
                            setSuccess(`Token identifier updated from "${initialContractParts.tokenPart}" to "${tokenNamePart}" successfully!`);

                            // Redirect to the new token URL after a short delay
                            setTimeout(() => {
                                router.push(`/tokens/${tokenContractId}`);
                            }, 1500);
                        } else {
                            console.error('Failed to clean up old token identifier:', await deleteResponse.text());
                            setSuccess('Token metadata saved with new identifier, but could not remove the old version. Please contact support.');

                            // Still redirect to the new token URL
                            setTimeout(() => {
                                router.push(`/tokens/${tokenContractId}`);
                            }, 1500);
                        }
                    } catch (deleteErr) {
                        console.error('Failed to delete old contract ID:', deleteErr);
                        setSuccess('Token metadata saved with new identifier, but could not remove the old version. Please contact support.');

                        // Still redirect to the new token URL even if cleanup failed
                        setTimeout(() => {
                            router.push(`/tokens/${tokenContractId}`);
                        }, 1500);
                    }
                } else {
                    setSuccess('Token metadata saved successfully!');
                }

                // Clear draft from localStorage if this was a new token
                if (isNew) {
                    localStorage.removeItem(TOKEN_DRAFT_KEY);
                }

                // Reset the success message after a few seconds
                setTimeout(() => {
                    setSuccess('');
                }, 5000);
            } catch (signError) {
                console.error('Error signing message:', signError);
                setError(signError instanceof Error ? signError.message : 'Please sign the message with your wallet to authenticate ownership.');
                setSaving(false);
                return;
            }
        } catch (err) {
            console.error('Error saving token metadata:', err);
            setError(err instanceof Error ? err.message : 'Failed to save token metadata. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (!authenticated) {
        return (
            <div className="text-center py-10">
                <p className="text-lg mb-4">Please connect your wallet to manage token metadata.</p>
                <Button onClick={() => router.push('/')}>
                    Return to Home
                </Button>
            </div>
        );
    }

    if (loading) {
        return <div className="flex justify-center py-10">Loading token data...</div>;
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-6">{isNew ? 'Create New Token' : 'Edit Token Metadata'}</h1>

            {error && (
                <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded mb-4">
                    {error}
                </div>
            )}

            {success && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                    {success}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="tokenNamePart" className="block text-sm font-medium mb-1">
                                Token Identifier *
                            </label>
                            <div className="flex">
                                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground sm:text-sm">
                                    {initialContractParts.address || stxAddress}.
                                </span>
                                <input
                                    type="text"
                                    id="tokenNamePart"
                                    name="tokenNamePart"
                                    value={tokenNamePart}
                                    onChange={(e) => setTokenNamePart(e.target.value)}
                                    placeholder="token-name"
                                    className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-r-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring border border-input bg-background sm:text-sm"
                                    required
                                />
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {isNew
                                    ? "Choose a unique identifier for your token"
                                    : "You can update the token identifier as long as it's not already in use"}
                            </p>
                        </div>

                        <div>
                            <label htmlFor="name" className="block text-sm font-medium mb-1">
                                Name *
                            </label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-input rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring bg-background sm:text-sm"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="symbol" className="block text-sm font-medium mb-1">
                                Symbol
                            </label>
                            <input
                                type="text"
                                id="symbol"
                                name="symbol"
                                value={formData.symbol}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-input rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring bg-background sm:text-sm"
                            />
                        </div>

                        <div>
                            <label htmlFor="decimals" className="block text-sm font-medium mb-1">
                                Decimals
                            </label>
                            <input
                                type="number"
                                id="decimals"
                                name="decimals"
                                min="0"
                                max="18"
                                value={formData.decimals}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-input rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring bg-background sm:text-sm"
                            />
                        </div>

                        <div>
                            <label htmlFor="description" className="block text-sm font-medium mb-1">
                                Description *
                            </label>
                            <textarea
                                id="description"
                                name="description"
                                rows={3}
                                value={formData.description}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-input rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring bg-background sm:text-sm"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="prompt" className="block text-sm font-medium mb-1">
                                Image Generation Prompt <span className="text-muted-foreground">(optional)</span>
                            </label>
                            <textarea
                                id="prompt"
                                name="prompt"
                                rows={3}
                                value={formData.prompt as string}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 border border-input rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring bg-background sm:text-sm"
                            />
                        </div>

                        <div className="flex justify-between items-center">
                            <Button
                                type="button"
                                onClick={handleGenerateImage}
                                disabled={saving || !formData.prompt}
                                className="mr-2"
                            >
                                {saving ? 'Generating...' : 'Generate Image'}
                            </Button>

                            <div className="relative">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    accept="image/*"
                                    className="hidden"
                                />
                                <Button
                                    type="button"
                                    onClick={handleUploadClick}
                                    disabled={uploading}
                                    variant="outline"
                                >
                                    {uploading ? 'Uploading...' : 'Upload Image'}
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col items-center">
                        <h3 className="text-lg font-medium mb-2">Token Image *</h3>
                        <div className="border border-input rounded-md p-4 w-full h-64 flex items-center justify-center bg-muted/20">
                            {imageUrl ? (
                                <div className="relative w-full h-full">
                                    <img
                                        src={imageUrl}
                                        alt="Token"
                                        className="object-contain w-full h-full"
                                    />
                                </div>
                            ) : (
                                <p className="text-muted-foreground">Upload or generate an image for your token</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end">
                    <Button type="button" variant="outline" className="mr-2" onClick={() => router.push('/tokens')}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={saving || uploading}>
                        {saving ? 'Saving...' : (isNew ? 'Create Token' : 'Save Metadata')}
                    </Button>
                </div>
            </form>
        </div>
    );
} 