'use client';

import { useState, useTransition } from 'react';
import { blacklistToken, unblacklistToken } from '@/app/actions';

interface BlacklistManagerProps {
    initialBlacklistedTokens: string[];
}

export default function BlacklistManager({ initialBlacklistedTokens }: BlacklistManagerProps) {
    const [blacklistedTokens, setBlacklistedTokens] = useState<string[]>(initialBlacklistedTokens);
    const [newTokenId, setNewTokenId] = useState('');
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const showMessage = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 5000);
    };

    const handleAddToken = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTokenId.trim()) return;

        startTransition(async () => {
            try {
                const result = await blacklistToken(newTokenId.trim());
                if (result.success) {
                    setBlacklistedTokens(prev => [...prev, newTokenId.trim()]);
                    setNewTokenId('');
                    showMessage('success', 'message' in result ? result.message : 'Token blacklisted successfully');
                } else {
                    showMessage('error', 'error' in result ? result.error : 'Failed to blacklist token');
                }
            } catch (error) {
                showMessage('error', 'An unexpected error occurred');
            }
        });
    };

    const handleRemoveToken = async (contractId: string) => {
        startTransition(async () => {
            try {
                const result = await unblacklistToken(contractId);
                if (result.success) {
                    setBlacklistedTokens(prev => prev.filter(id => id !== contractId));
                    showMessage('success', 'message' in result ? result.message : 'Token removed from blacklist successfully');
                } else {
                    showMessage('error', 'error' in result ? result.error : 'Failed to remove token from blacklist');
                }
            } catch (error) {
                showMessage('error', 'An unexpected error occurred');
            }
        });
    };

    return (
        <div className="space-y-8">
            {/* Message Display */}
            {message && (
                <div className={`rounded-lg p-4 ${message.type === 'success'
                    ? 'bg-green-50 border border-green-200 text-green-700'
                    : 'bg-red-50 border border-red-200 text-red-700'
                    }`}>
                    {message.text}
                </div>
            )}

            {/* Add Token Form */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                    Add Token to Blacklist
                </h2>
                <form onSubmit={handleAddToken} className="space-y-4">
                    <div>
                        <label htmlFor="tokenId" className="block text-sm font-medium text-gray-700 mb-2">
                            Contract ID
                        </label>
                        <input
                            type="text"
                            id="tokenId"
                            value={newTokenId}
                            onChange={(e) => setNewTokenId(e.target.value)}
                            placeholder="e.g., SP2AKWJYC7BNY18W1XXKPGP0YVEK63QJG4793Z2D4.sip010-token"
                            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                            disabled={isPending}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isPending || !newTokenId.trim()}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isPending ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Adding...
                            </>
                        ) : (
                            'Add to Blacklist'
                        )}
                    </button>
                </form>
            </div>

            {/* Blacklisted Tokens List */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Blacklisted Tokens
                    </h2>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {blacklistedTokens.length} tokens
                    </span>
                </div>

                {blacklistedTokens.length === 0 ? (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center rounded-full bg-gray-100">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-8V4a1 1 0 00-1-1H6a1 1 0 00-1 1v1m16 0h-2M4 5h2" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No blacklisted tokens</h3>
                        <p className="text-gray-500">Tokens you blacklist will appear here.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {blacklistedTokens.map((tokenId) => (
                            <div
                                key={tokenId}
                                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                            >
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate font-mono">
                                        {tokenId}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleRemoveToken(tokenId)}
                                    disabled={isPending}
                                    className="ml-4 inline-flex items-center px-3 py-1 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isPending ? 'Removing...' : 'Remove'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Info Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex">
                    <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="ml-3">
                        <h3 className="text-sm font-medium text-blue-800">
                            About Token Blacklisting
                        </h3>
                        <div className="mt-2 text-sm text-blue-700">
                            <ul className="list-disc list-inside space-y-1">
                                <li>Blacklisted tokens are automatically removed from the managed token list</li>
                                <li>They will not appear in API responses or be available for indexing</li>
                                <li>Cached data for blacklisted tokens is automatically deleted</li>
                                <li>Blacklisted tokens cannot be re-added through normal indexing processes</li>
                                <li>Use this feature to permanently exclude problematic or unwanted tokens</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 