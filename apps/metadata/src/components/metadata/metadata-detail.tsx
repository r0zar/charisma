"use client"

import { useEffect, useState, useRef, useCallback } from 'react';
import { useApp } from '@/lib/context/app-context';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { TokenMetadata } from '@/lib/metadata-service';
import { constructSip16MetadataObject } from '@/lib/metadata-service';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, Layers, Save, ArrowLeft, RefreshCcw, Loader2, PencilLine, Check, X, Upload, ImageIcon, Edit, FileJson, Copy } from 'lucide-react';
import { generateRandomSvgDataUri } from '@/lib/image-utils';
import dynamic from 'next/dynamic';

const ReactJson = dynamic(() => import('react-json-view'), { ssr: false });

interface MetadataDetailProps {
    contractId: string;
}

const defaultLocalization = { uri: '', default: 'en', locales: [] as string[] };

export function MetadataDetail({ contractId: initialContractId }: MetadataDetailProps) {
    const { authenticated, stxAddress, signMessage, loading: contextLoading } = useApp();
    const [token, setToken] = useState<TokenMetadata | null>(null);
    const [initializing, setInitializing] = useState(true);
    const [loading, setLoading] = useState(true);
    const [imageUrl, setImageUrl] = useState('');
    const [saving, setSaving] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [activeImageTab, setActiveImageTab] = useState('random');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [contractId, setContractId] = useState(initialContractId);
    const [editingContractId, setEditingContractId] = useState(false);
    const [tokenIdentifier, setTokenIdentifier] = useState('');
    const [idEditError, setIdEditError] = useState('');
    const editInputRef = useRef<HTMLInputElement>(null);

    const [isJsonEditing, setIsJsonEditing] = useState(false);
    const [editedJsonString, setEditedJsonString] = useState('');
    const [jsonEditError, setJsonEditError] = useState('');

    const [dataUriStats, setDataUriStats] = useState({
        length: 0,
        percentage: 0,
        status: 'idle' as 'idle' | 'ok' | 'warning' | 'error',
        message: ''
    });

    const [formData, setFormData] = useState({
        sip: 16,
        name: '',
        description: '',
        imagePrompt: '',
        symbol: '',
        decimals: 6,
        identifier: '',
        attributes: [] as Array<{ trait_type: string; value: any; display_type?: string }>,
        localization: { ...defaultLocalization },
    });

    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const router = useRouter();

    const [unsavedImageUrl, setUnsavedImageUrl] = useState('');

    // Memoize getFullMetadataObjectFromService
    const getFullMetadataObjectFromService = useCallback(() => {
        return constructSip16MetadataObject(
            formData,
            tokenIdentifier,
            imageUrl,
            unsavedImageUrl,
            token?.properties
        );
    }, [formData, tokenIdentifier, imageUrl, unsavedImageUrl, token?.properties]);

    useEffect(() => {
        if (contractId && contractId.includes('.')) {
            const parts = contractId.split('.');
            const identifier = parts.slice(1).join('.');
            setTokenIdentifier(identifier);
        } else if (contractId) {
            const parts = contractId.split('.');
            if (parts.length > 1) {
                setTokenIdentifier(parts.slice(1).join('.'));
            } else {
                setTokenIdentifier('');
            }
        }
    }, [contractId]);

    useEffect(() => {
        async function fetchToken() {
            console.log("MetadataDetail: fetchToken triggered. contractId:", contractId);
            if (!contractId) {
                setLoading(false);
                return;
            }
            if (!contractId.includes('.')) {
                console.log("MetadataDetail: Contract ID seems incomplete, likely a new token page.", contractId);
                const newName = tokenIdentifier ? tokenIdentifier.toUpperCase().replace(/-/g, ' ') : 'New Token';
                const newSymbol = tokenIdentifier ? tokenIdentifier.toUpperCase() : 'TOKEN';
                setToken(null);
                setImageUrl('');
                setUnsavedImageUrl('');
                setFormData({
                    sip: 16,
                    name: newName,
                    symbol: newSymbol,
                    decimals: 6,
                    description: '',
                    imagePrompt: '',
                    identifier: tokenIdentifier,
                    attributes: [],
                    localization: { ...defaultLocalization },
                });
                setLoading(false);
                setTimeout(() => setEditedJsonString(JSON.stringify(getFullMetadataObjectFromService(), null, 2)), 0);
                return;
            }

            try {
                setLoading(true);
                setError('');
                const response = await fetch(`/api/v1/metadata/${contractId}`);

                if (response.ok) {
                    const data = await response.json() as any;
                    setToken(data as TokenMetadata);

                    const currentName = data.name || (tokenIdentifier ? tokenIdentifier.toUpperCase().replace(/-/g, ' ') : 'New Token');
                    const currentSymbol = data.properties?.symbol || data.symbol || (tokenIdentifier ? tokenIdentifier.toUpperCase() : 'TOKEN');
                    const currentIdentifier = data.properties?.identifier || '';

                    let parsedDecimals = 6;
                    if (typeof data.properties?.decimals === 'number') {
                        parsedDecimals = data.properties.decimals;
                    } else if (typeof data.decimals === 'number') {
                        parsedDecimals = data.decimals;
                    }

                    const parsedAttributes = Array.isArray(data.attributes) ? data.attributes : [];

                    let parsedLocalization = { ...defaultLocalization };
                    if (data.localization && typeof data.localization === 'object') {
                        parsedLocalization.uri = typeof data.localization.uri === 'string' ? data.localization.uri : '';
                        parsedLocalization.default = typeof data.localization.default === 'string' ? data.localization.default : 'en';
                        parsedLocalization.locales = Array.isArray(data.localization.locales)
                            ? data.localization.locales.filter((l: any) => typeof l === 'string')
                            : [];
                    }

                    setFormData(prevFormData => ({
                        sip: data.sip || 16,
                        name: currentName,
                        description: data.description || '',
                        imagePrompt: prevFormData.imagePrompt,
                        symbol: currentSymbol,
                        decimals: parsedDecimals,
                        identifier: currentIdentifier,
                        attributes: parsedAttributes,
                        localization: parsedLocalization,
                    }));

                    if (data.image) {
                        setImageUrl(data.image);
                        setUnsavedImageUrl('');
                    } else {
                        setImageUrl('');
                        setUnsavedImageUrl('');
                    }
                    setTimeout(() => setEditedJsonString(JSON.stringify(getFullMetadataObjectFromService(), null, 2)), 0);
                } else if (response.status === 404) {
                    console.log(`MetadataDetail: Token ${contractId} not found (404). Setting defaults.`);
                    const newName = tokenIdentifier ? tokenIdentifier.toUpperCase().replace(/-/g, ' ') : 'New Token';
                    const newSymbol = tokenIdentifier ? tokenIdentifier.toUpperCase() : 'TOKEN';
                    setToken(null);
                    setImageUrl('');
                    setUnsavedImageUrl('');
                    setFormData({
                        sip: 16,
                        name: newName,
                        symbol: newSymbol,
                        decimals: 6,
                        description: '',
                        imagePrompt: '',
                        identifier: tokenIdentifier,
                        attributes: [],
                        localization: { ...defaultLocalization },
                    });
                    setTimeout(() => setEditedJsonString(JSON.stringify(getFullMetadataObjectFromService(), null, 2)), 0);
                } else {
                    const errorData = await response.text();
                    console.error(`MetadataDetail: API error for ${contractId}. Status: ${response.status}, Body: ${errorData}`);
                    setError(`Failed to load token data (Status: ${response.status})`);
                }
            } catch (error) {
                console.error(`MetadataDetail: Failed to fetch token ${contractId}:`, error);
                setError('An error occurred while fetching token data.');
            } finally {
                setLoading(false);
            }
        }

        if (authenticated) {
            fetchToken();
        } else {
            if (!contextLoading) {
                setLoading(false);
            }
        }
    }, [contractId, authenticated]);

    useEffect(() => {
        try {
            const metadataObject = getFullMetadataObjectFromService();
            if (Object.keys(metadataObject).length === 0 && !metadataObject.name) {
                setDataUriStats({
                    length: 0,
                    percentage: 0,
                    status: 'idle',
                    message: 'No metadata to generate URI from yet.'
                });
                return;
            }
            const jsonString = JSON.stringify(metadataObject);
            const base64Json = btoa(jsonString);
            const dataUri = `data:application/json;base64,${base64Json}`;
            const length = dataUri.length;
            const percentage = Math.min(Math.round((length / MAX_DATA_URI_LENGTH) * 100), 100);

            let status: 'ok' | 'warning' | 'error' = 'ok';
            let message = `Length: ${length} / ${MAX_DATA_URI_LENGTH} (${percentage}%)`;

            if (length > MAX_DATA_URI_LENGTH) {
                status = 'error';
                message += ' - Error: Exceeds maximum length!';
            } else if (length > MAX_DATA_URI_LENGTH * 0.8) {
                status = 'warning';
                message += ' - Warning: Approaching maximum length.';
            }

            setDataUriStats({ length, percentage, status, message });

        } catch (error) {
            console.error("Failed to calculate data URI stats:", error);
            setDataUriStats({
                length: 0,
                percentage: 0,
                status: 'error',
                message: 'Error calculating URI size. Check console.'
            });
        }
    }, [getFullMetadataObjectFromService]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const newFormData = { ...prev };
            if (name === 'sip' || name === 'decimals') {
                (newFormData as any)[name] = parseInt(value, 10) || (name === 'decimals' ? 0 : 16);
            } else if (name === 'localization.uri' || name === 'localization.default') {
                const keys = name.split('.');
                newFormData.localization = {
                    ...newFormData.localization,
                    [keys[1]]: value
                };
            } else if (name === 'localization.locales') {
                newFormData.localization = {
                    ...newFormData.localization,
                    locales: value.split(',').map(s => s.trim()).filter(s => s)
                };
            }
            else {
                (newFormData as any)[name] = value;
            }
            return newFormData;
        });
    };

    const startEditingContractId = () => {
        setEditingContractId(true);
        setIdEditError('');
        setTimeout(() => {
            if (editInputRef.current) {
                editInputRef.current.focus();
            }
        }, 0);
    };

    const cancelEditingContractId = () => {
        setEditingContractId(false);
        setIdEditError('');
    };

    const saveEditedContractId = () => {
        if (!/^[a-z0-9\-]+$/.test(tokenIdentifier)) {
            setIdEditError('Token identifier can only contain lowercase letters, numbers, and hyphens');
            return;
        }

        if (tokenIdentifier.trim() === '') {
            setIdEditError('Token identifier cannot be empty');
            return;
        }

        const principalAddress = contractId.split('.')[0];
        const newContractId = `${principalAddress}.${tokenIdentifier}`;

        if (newContractId !== contractId) {
            router.push(`/dashboard/new/${encodeURIComponent(newContractId)}`);
        }

        setEditingContractId(false);
        setIdEditError('');
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            setError('Please select an image file');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            setError('Image size should be less than 10MB');
            return;
        }

        try {
            setUploading(true);
            setError('');
            setSuccess('');

            const formData = new FormData();
            formData.append('image', file);

            const response = await fetch(`/api/v1/metadata/upload/${contractId}`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to upload image');
            }

            const data = await response.json();
            console.log(data)
            if (data.success && data.url) {
                setUnsavedImageUrl(data.url);
                setSuccess('Image uploaded successfully! Remember to save metadata.');
                setTimeout(() => setSuccess(''), 3000);
            }
        } catch (error) {
            console.error('Failed to upload image:', error);
            setError(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

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
            setSuccess('');

            let signature, publicKey;
            try {
                const signResult = await signMessage(contractId);
                console.log('signResult', signResult);
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

            const metadataForPrompt = getFullMetadataObjectFromService();

            const response = await fetch(`/api/v1/metadata/generate/${contractId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-signature': signature,
                    'x-public-key': publicKey,
                },
                body: JSON.stringify({
                    prompt: formData.imagePrompt,
                    name: metadataForPrompt.name || undefined,
                    symbol: metadataForPrompt.properties?.symbol || undefined,
                    description: metadataForPrompt.description || undefined,
                    properties: metadataForPrompt.properties || {}
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to generate image');
            }

            if (response.ok) {
                const data = await response.json();
                setUnsavedImageUrl(data.image);
                setSuccess('Image generated successfully! Remember to save metadata.');
                setTimeout(() => setSuccess(''), 3000);
            }
        } catch (error) {
            console.error('Failed to generate image:', error);
            setError(`Failed to generate image: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setGenerating(false);
        }
    };

    const handleGenerateRandomSvg = () => {
        setGenerating(true);
        setError('');
        setSuccess('');
        try {
            const dataUrl = generateRandomSvgDataUri();
            setUnsavedImageUrl(dataUrl);

        } catch (error) {
            console.error('Failed to generate random SVG:', error);
            setError('Failed to generate random SVG.');
        } finally {
            setGenerating(false);
        }
    };

    const MAX_DATA_URI_LENGTH = 256;

    const handleGenerateFullDataUri = async () => {
        try {
            const metadataObject = getFullMetadataObjectFromService();
            const jsonString = JSON.stringify(metadataObject);
            const base64Json = btoa(jsonString);
            const dataUri = `data:application/json;base64,${base64Json}`;

            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(dataUri);
                setDataUriStats({
                    length: dataUri.length,
                    percentage: 100,
                    status: 'ok',
                    message: `Success: Full Data URI (length: ${dataUri.length}) copied to clipboard!`
                });
            } else {
                setDataUriStats({
                    length: dataUri.length,
                    percentage: 100,
                    status: 'warning',
                    message: `Warning: Clipboard API not available. URI (length: ${dataUri.length}) generated but not copied. You may need to copy it manually from the console if logged, or enable clipboard permissions.`
                });
                console.log("Generated Data URI:", dataUri);
            }

            if (dataUri.length > MAX_DATA_URI_LENGTH) {
                setDataUriStats(prev => ({
                    ...prev,
                    message: prev.message + ` (Warning: URI is very long: ${dataUri.length} chars, consider hosting externally.)`
                }));
            }

        } catch (error) {
            console.error("Failed to generate or copy full data URI:", error);
            setDataUriStats({
                length: 0,
                percentage: 0,
                status: 'error',
                message: "Error generating/copying full data URI. Check console."
            });
        }
    };

    const handleSave = async (metadataToSave: Record<string, any>) => {
        if (!contractId || !authenticated) return;

        try {
            setSaving(true);
            setError('');
            setSuccess('');

            const { signature, publicKey } = await signMessage(contractId);

            const cleanedMetadata: Record<string, any> = {};
            for (const key in metadataToSave) {
                if (metadataToSave[key] !== null && metadataToSave[key] !== undefined && metadataToSave[key] !== '') {
                    cleanedMetadata[key] = metadataToSave[key];
                }
            }
            if (token?.properties && !cleanedMetadata.properties) {
                cleanedMetadata.properties = token.properties;
            }

            const response = await fetch(`/api/v1/metadata/${contractId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-signature': signature,
                    'x-public-key': publicKey,
                },
                body: JSON.stringify(cleanedMetadata),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save metadata');
            }

            setSuccess('Metadata saved successfully!');
            setIsJsonEditing(false);
            setJsonEditError('');

            setTimeout(() => setSuccess(''), 3000);
        } catch (error) {
            console.error('Failed to save metadata:', error);
            setError(`Failed to save: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setSaving(false);
        }
    }

    const handleJsonSave = async () => {
        let parsedJson;
        try {
            parsedJson = JSON.parse(editedJsonString);
            setJsonEditError('');
            await handleSave(parsedJson);
        } catch (parseError) {
            console.error('Invalid JSON:', parseError);
            setJsonEditError(`Invalid JSON: ${parseError instanceof Error ? parseError.message : 'Syntax error'}`);
            setError('Could not save: Invalid JSON format.');
        }
    };

    const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setEditedJsonString(e.target.value);
        try {
            const parsed = JSON.parse(e.target.value) as any;

            let parsedDecimals = 6;
            if (typeof parsed.properties?.decimals === 'number') {
                parsedDecimals = parsed.properties.decimals;
            } else if (typeof parsed.decimals === 'number') {
                parsedDecimals = parsed.decimals;
            }

            const parsedAttributes = Array.isArray(parsed.attributes) ? parsed.attributes : [];
            const parsedIdentifier = parsed.properties?.identifier || '';

            let parsedLocalization = { ...defaultLocalization };
            if (parsed.localization && typeof parsed.localization === 'object') {
                parsedLocalization.uri = typeof parsed.localization.uri === 'string' ? parsed.localization.uri : '';
                parsedLocalization.default = typeof parsed.localization.default === 'string' ? parsed.localization.default : 'en';
                parsedLocalization.locales = Array.isArray(parsed.localization.locales)
                    ? parsed.localization.locales.filter((l: any) => typeof l === 'string')
                    : [];
            }

            setFormData(prev => ({
                ...prev,
                sip: parsed.sip || 16,
                name: parsed.name || '',
                description: parsed.description || '',
                symbol: parsed.properties?.symbol || parsed.symbol || '',
                decimals: parsedDecimals,
                identifier: parsedIdentifier,
                attributes: parsedAttributes,
                localization: parsedLocalization,
            }));
            if (parsed.image) {
                setImageUrl(parsed.image);
                setUnsavedImageUrl('');
            } else if (parsed.image === null || parsed.image === '') {
                setImageUrl('');
                setUnsavedImageUrl('');
            }
            setJsonEditError('');
        } catch (err) {
            setJsonEditError('JSON might be invalid. Error will be confirmed on save.');
        }
    };

    const toggleJsonEdit = () => {
        if (isJsonEditing) {
            setEditedJsonString(JSON.stringify(getFullMetadataObjectFromService(), null, 2));
            setJsonEditError('');
        } else {
            setEditedJsonString(JSON.stringify(getFullMetadataObjectFromService(), null, 2));
        }
        setIsJsonEditing(!isJsonEditing);
    };

    const isAppInitializing = contextLoading;

    if (isAppInitializing) {
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

    if (loading && contractId.includes('.')) {
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

    const displayImageUrl = unsavedImageUrl || imageUrl;
    const metadataForJsonView = getFullMetadataObjectFromService();

    return (
        <div className="max-w-5xl mx-auto">
            <div className="mb-8 flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ArrowLeft className="mr-1 h-4 w-4" />
                        Back to Dashboard
                    </button>
                </div>

                <div className="flex items-start justify-between flex-col sm:flex-row gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            {formData.name || (tokenIdentifier ? tokenIdentifier.toUpperCase().replace(/-/g, ' ') : 'New Token')}
                        </h1>
                        {formData.symbol && (
                            <div className="mt-1 text-lg text-muted-foreground">
                                ${formData.symbol}
                            </div>
                        )}
                    </div>

                    <div className="px-4 py-2 bg-muted/30 border border-border/50 rounded-lg min-w-[280px]">
                        <div className="flex items-center justify-between mb-1">
                            <div className="text-xs text-muted-foreground">Metadata Slug</div>
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
                                        {stxAddress ? `${stxAddress}.` : 'YOUR-ADDR.'}
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

            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg mb-6 flex items-start"
                    >
                        <div className="mr-2 flex-shrink-0 h-5 w-5 text-destructive mt-0.5">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="flex-1">{error}</div>
                        <button onClick={() => setError('')} className="ml-2 text-destructive/70 hover:text-destructive">✕</button>
                    </motion.div>
                )}

                {success && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg mb-6 flex items-start"
                    >
                        <div className="mr-2 flex-shrink-0 h-5 w-5 text-green-500 mt-0.5">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="flex-1">{success}</div>
                        <button onClick={() => setSuccess('')} className="ml-2 text-green-800/70 hover:text-green-800">✕</button>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-12 gap-8">
                <div className="col-span-12 md:col-span-4">
                    <div className="sticky top-24 space-y-6">
                        <div className="bg-gradient-to-br from-background to-muted/30 border border-border/50 rounded-xl p-6 overflow-hidden">
                            <h3 className="text-lg font-medium mb-4 flex items-center">
                                <Layers className="inline mr-2 h-5 w-5 text-primary/70" />
                                Metadata Image
                            </h3>

                            <div className="aspect-square mb-4 relative rounded-lg overflow-hidden bg-gradient-to-br from-muted/50 to-muted border border-border/50 flex items-center justify-center">
                                {displayImageUrl ? (
                                    <Image
                                        src={displayImageUrl}
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
                                {unsavedImageUrl && (
                                    <div className="absolute bottom-2 right-2 bg-yellow-500/80 text-white text-xs px-2 py-1 rounded-full">
                                        Unsaved changes
                                    </div>
                                )}
                            </div>

                            <div className="mb-4 border-b border-border/40">
                                <div className="flex">
                                    <button
                                        className={`py-2 px-3 text-sm font-medium border-b-2 transition-colors ${activeImageTab === 'random'
                                            ? 'border-primary text-primary'
                                            : 'border-transparent text-muted-foreground hover:text-foreground'
                                            }`}
                                        onClick={() => setActiveImageTab('random')}
                                    >
                                        Random
                                    </button>
                                    <button
                                        className={`py-2 px-3 text-sm font-medium border-b-2 transition-colors ${activeImageTab === 'generate'
                                            ? 'border-primary text-primary'
                                            : 'border-transparent text-muted-foreground hover:text-foreground'
                                            }`}
                                        onClick={() => setActiveImageTab('generate')}
                                    >
                                        Generate AI
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

                            {activeImageTab === 'random' && (
                                <div className="space-y-3">
                                    <p className="text-sm text-muted-foreground">
                                        Generate a unique, simple SVG image for your token.
                                    </p>
                                    <Button
                                        onClick={handleGenerateRandomSvg}
                                        disabled={generating}
                                        className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-medium transition-all
                                            ${generating && activeImageTab === 'random'
                                                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                                : 'bg-gradient-to-r from-primary/90 to-primary/70 text-primary-foreground hover:from-primary hover:to-primary/80'
                                            }`}
                                    >
                                        {generating && activeImageTab === 'random' ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <RefreshCcw className="h-4 w-4" />
                                                Generate Random SVG
                                            </>
                                        )}
                                    </Button>
                                </div>
                            )}

                            {activeImageTab === 'generate' ? (
                                <div className="space-y-3">
                                    <div>
                                        <label htmlFor="imagePrompt" className="text-sm font-medium text-foreground/80 block mb-1.5">
                                            Image Generation Prompt
                                        </label>
                                        <div className="relative">
                                            <textarea
                                                id="imagePrompt"
                                                name="imagePrompt"
                                                className="w-full pl-3 pr-10 py-2 border border-border bg-background/50 rounded-md focus:ring-1 focus:ring-primary/30 focus:border-primary/40 outline-none transition-all text-xs"
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
                                            ${generating && activeImageTab === 'generate' || !formData.imagePrompt
                                                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                                : 'bg-gradient-to-r from-primary/90 to-primary/70 text-primary-foreground hover:from-primary hover:to-primary/80'
                                            }`}
                                    >
                                        {generating && activeImageTab === 'generate' ? (
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
                            ) : null}

                            {activeImageTab === 'upload' ? (
                                <div className="space-y-3">
                                    <div className="border-2 border-dashed border-border/70 rounded-lg p-4 text-center">
                                        <ImageIcon className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                                        <p className="text-sm text-muted-foreground mb-2">
                                            {uploading ? 'Uploading...' : 'Drag & drop or click to upload'}
                                        </p>
                                        <p className="text-xs text-muted-foreground mb-3">
                                            PNG, JPG or SVG (max 10MB)
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
                            ) : null}
                        </div>
                    </div>
                </div>

                <div className="col-span-12 md:col-span-8">
                    <div className="bg-gradient-to-br from-background to-muted/30 border border-border/50 rounded-xl overflow-hidden">
                        <div className="p-6">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-medium">
                                        Token Metadata (SIP-16 JSON)
                                    </h3>
                                    <Button variant="outline" size="sm" onClick={toggleJsonEdit} className="gap-2">
                                        {isJsonEditing ? (
                                            <>
                                                <X className="h-4 w-4" /> Cancel Edit
                                            </>
                                        ) : (
                                            <>
                                                <Edit className="h-4 w-4" /> Edit JSON
                                            </>
                                        )}
                                    </Button>
                                </div>

                                <div className="my-4 space-y-3">
                                    <div>
                                        <label htmlFor="dataUriProgressBar" className="text-sm font-medium text-foreground/80 block mb-1">
                                            Data URI Size (DMT)
                                        </label>
                                        <div className="w-full bg-muted rounded-full h-2.5 dark:bg-neutral-700/50 border border-border/50">
                                            <div
                                                className={`h-full rounded-full transition-all duration-300 ease-in-out ${{
                                                    idle: 'bg-gray-300',
                                                    ok: 'bg-green-500',
                                                    warning: 'bg-yellow-400',
                                                    error: 'bg-red-500'
                                                }[dataUriStats.status]
                                                    }`}
                                                style={{ width: `${dataUriStats.percentage}%` }}
                                            ></div>
                                        </div>
                                        <p className={`text-xs mt-1.5 
                                            ${dataUriStats.status === 'error' ? 'text-destructive' :
                                                dataUriStats.status === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
                                                    'text-muted-foreground'}`}>
                                            {dataUriStats.message || '\u00A0'}
                                        </p>
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleGenerateFullDataUri}
                                        className="gap-2 w-full sm:w-auto"
                                    >
                                        <Copy className="h-4 w-4" /> Generate & Copy Full Data URI
                                    </Button>
                                </div>

                                {isJsonEditing ? (
                                    <div className="space-y-3">
                                        <textarea
                                            value={editedJsonString}
                                            onChange={handleJsonChange}
                                            className={`w-full p-3 font-mono text-xs border rounded-md bg-background/80 h-96 resize-y focus:ring-1 focus:ring-primary/30 focus:border-primary/40 outline-none transition-all ${jsonEditError ? 'border-destructive' : 'border-border'}`}
                                            spellCheck="false"
                                        />
                                        {jsonEditError && (
                                            <p className="text-xs text-destructive mt-1">{jsonEditError}</p>
                                        )}
                                        <div className="mt-4 pt-4 border-t border-border/40 flex justify-between">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={toggleJsonEdit}
                                                className="text-muted-foreground"
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                onClick={handleJsonSave}
                                                disabled={saving || !!jsonEditError}
                                                className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-300"
                                            >
                                                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                                Save JSON
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-3 border border-border/50 rounded-md bg-background/50 max-h-[500px] overflow-auto">
                                        {Object.keys(metadataForJsonView).length > 0 ? (
                                            <ReactJson
                                                src={metadataForJsonView}
                                                theme="ocean"
                                                iconStyle="square"
                                                collapsed={Object.keys(metadataForJsonView.properties || {}).length > 0 || (Array.isArray(metadataForJsonView.attributes) ? metadataForJsonView.attributes.length : 0) > 0 ? 1 : 0}
                                                collapseStringsAfterLength={70}
                                                displayDataTypes={false}
                                                enableClipboard={true}
                                                style={{ background: 'transparent', fontSize: '0.8rem' }}
                                            />
                                        ) : (
                                            <p className="text-muted-foreground text-sm">No metadata available to display.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 