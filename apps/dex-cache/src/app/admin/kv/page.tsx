'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, RefreshCw, Search, Trash, Database, Key, List } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function AdminKVPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [authKey, setAuthKey] = useState('');
    const [pattern, setPattern] = useState('energy:*');
    const [valueKey, setValueKey] = useState('');
    const [keys, setKeys] = useState<string[]>([]);
    const [keyStats, setKeyStats] = useState<any>(null);
    const [selectedValue, setSelectedValue] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const authenticate = () => {
        if (authKey.trim()) {
            localStorage.setItem('admin_key', authKey);
            setIsAuthenticated(true);
        }
    };

    const fetchKeys = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/kv?key=${authKey}&pattern=${encodeURIComponent(pattern)}`);
            if (!res.ok) {
                if (res.status === 401) {
                    setIsAuthenticated(false);
                    localStorage.removeItem('admin_key');
                    throw new Error('Unauthorized. Please re-authenticate.');
                }
                throw new Error(`API error: ${res.status}`);
            }

            const data = await res.json();
            if (data.success) {
                setKeys(data.keys || []);
                setKeyStats(data.stats || null);
            } else {
                throw new Error(data.error || 'Failed to fetch keys');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            console.error('Error fetching keys:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchValue = async (key: string) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/kv?key=${authKey}&valueKey=${encodeURIComponent(key)}`);
            if (!res.ok) {
                throw new Error(`API error: ${res.status}`);
            }

            const data = await res.json();
            if (data.success) {
                setSelectedValue(data.value);
                setValueKey(key);
            } else {
                throw new Error(data.error || 'Failed to fetch value');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            console.error(`Error fetching value for ${key}:`, err);
        } finally {
            setLoading(false);
        }
    };

    const deleteKey = async (key: string) => {
        if (!confirm(`Are you sure you want to delete the key "${key}"?`)) {
            return;
        }

        setLoading(true);
        try {
            const res = await fetch(`/api/admin/kv?key=${authKey}&deleteKey=${encodeURIComponent(key)}`, {
                method: 'DELETE',
            });

            if (!res.ok) {
                throw new Error(`API error: ${res.status}`);
            }

            const data = await res.json();
            if (data.success) {
                setSuccessMessage(`Key "${key}" deleted successfully`);
                setTimeout(() => setSuccessMessage(null), 3000);

                // Refresh key list and clear selected value if it was deleted
                await fetchKeys();
                if (valueKey === key) {
                    setSelectedValue(null);
                    setValueKey('');
                }
            } else {
                throw new Error(data.error || 'Failed to delete key');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            console.error(`Error deleting key ${key}:`, err);
        } finally {
            setLoading(false);
        }
    };

    // Check if we have a saved auth key on load
    useEffect(() => {
        const savedKey = localStorage.getItem('admin_key');
        if (savedKey) {
            setAuthKey(savedKey);
            setIsAuthenticated(true);
        }
    }, []);

    // Load keys after authentication
    useEffect(() => {
        if (isAuthenticated) {
            fetchKeys();
        }
    }, [isAuthenticated]);

    if (!isAuthenticated) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Card className="w-[400px]">
                    <CardHeader>
                        <CardTitle className="text-xl">KV Admin Access</CardTitle>
                        <CardDescription>Enter your admin key to continue</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex gap-2">
                            <Input
                                type="password"
                                placeholder="Admin Key"
                                value={authKey}
                                onChange={(e) => setAuthKey(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && authenticate()}
                            />
                            <Button onClick={authenticate}>Login</Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8">
            <h1 className="text-2xl font-bold mb-6 flex items-center">
                <Database className="w-6 h-6 mr-2" /> Vercel KV Admin Dashboard
            </h1>

            {error && (
                <Alert variant="destructive" className="mb-4">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {successMessage && (
                <Alert className="mb-4 bg-green-50 border-green-200">
                    <AlertDescription className="text-green-600">{successMessage}</AlertDescription>
                </Alert>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column - Key Search */}
                <div className="md:col-span-1">
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center">
                                <Key className="w-4 h-4 mr-2" /> Search Keys
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Key pattern (e.g. energy:*)"
                                        value={pattern}
                                        onChange={(e) => setPattern(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && fetchKeys()}
                                    />
                                    <Button
                                        onClick={fetchKeys}
                                        disabled={loading}
                                        size="icon"
                                    >
                                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                                    </Button>
                                </div>

                                {keyStats && (
                                    <div className="text-sm">
                                        <p>Total keys: {keyStats.totalKeys}</p>
                                        <div className="mt-2">
                                            <p className="text-xs text-muted-foreground mb-1">Keys by prefix:</p>
                                            <div className="flex flex-wrap gap-2">
                                                {Object.entries(keyStats.keysByPrefix).map(([prefix, count]: [any, any]) => (
                                                    <Badge key={prefix} variant="outline" className="text-xs">
                                                        {prefix}: {count}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-between border-t pt-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setPattern('*');
                                    fetchKeys();
                                }}
                            >
                                Show All
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setPattern('energy:*');
                                    fetchKeys();
                                }}
                            >
                                Energy Keys
                            </Button>
                        </CardFooter>
                    </Card>
                </div>

                {/* Middle Column - Key List */}
                <div className="md:col-span-1">
                    <Card className="h-full max-h-[600px] flex flex-col">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center">
                                <List className="w-4 h-4 mr-2" /> Keys {keys.length > 0 && `(${keys.length})`}
                            </CardTitle>
                            <CardDescription>
                                Click on a key to view its value
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow overflow-auto">
                            {loading ? (
                                <div className="flex justify-center items-center h-full">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : keys.length === 0 ? (
                                <div className="text-center text-muted-foreground py-10">
                                    No keys found matching the pattern
                                </div>
                            ) : (
                                <ul className="space-y-1">
                                    {keys.map((key) => (
                                        <li key={key} className="group">
                                            <div
                                                className={`flex justify-between items-center p-2 rounded text-sm hover:bg-muted cursor-pointer group ${valueKey === key ? 'bg-muted/80 font-medium' : ''
                                                    }`}
                                                onClick={() => fetchValue(key)}
                                            >
                                                <span className="truncate flex-grow">{key}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="opacity-0 group-hover:opacity-100 h-7 w-7"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteKey(key);
                                                    }}
                                                >
                                                    <Trash className="h-3.5 w-3.5 text-red-500" />
                                                </Button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column - Value Viewer */}
                <div className="md:col-span-1">
                    <Card className="h-full max-h-[600px] flex flex-col">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">Value Viewer</CardTitle>
                            {valueKey && (
                                <CardDescription className="truncate">
                                    {valueKey}
                                </CardDescription>
                            )}
                        </CardHeader>
                        <CardContent className="flex-grow overflow-auto relative">
                            {loading ? (
                                <div className="flex justify-center items-center h-full">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : !valueKey ? (
                                <div className="text-center text-muted-foreground py-10">
                                    Select a key to view its value
                                </div>
                            ) : (
                                <Tabs defaultValue="formatted">
                                    <TabsList className="mb-2">
                                        <TabsTrigger value="formatted">Formatted</TabsTrigger>
                                        <TabsTrigger value="raw">Raw</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="formatted" className="p-0">
                                        <pre className="whitespace-pre-wrap break-all text-xs bg-muted/50 p-4 rounded">
                                            {JSON.stringify(selectedValue, null, 2)}
                                        </pre>
                                    </TabsContent>
                                    <TabsContent value="raw" className="p-0">
                                        <pre className="whitespace-pre-wrap break-all text-xs bg-muted/50 p-4 rounded">
                                            {JSON.stringify(selectedValue)}
                                        </pre>
                                    </TabsContent>
                                </Tabs>
                            )}

                            {valueKey && !loading && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="absolute top-0 right-4"
                                    onClick={() => fetchValue(valueKey)}
                                >
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                    Refresh
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}