'use client';

import { useState } from 'react';
import { Vault } from '@repo/dexterity';
import { removeVault, refreshVaultData } from '@/app/actions';

// Utility to truncate contract id for display
const truncateContractId = (id: string, prefix = 4, suffix = 4) => {
    const [addr, name] = id.split('.');
    if (!addr) return id;
    if (addr.length <= prefix + suffix + 3) return id;
    return `${addr.slice(0, prefix)}...${addr.slice(-suffix)}.${name}`;
};

interface Props {
    vaults: Vault[];
}

export default function VaultList({ vaults }: Props) {
    const [refreshing, setRefreshing] = useState<string | null>(null);
    const [removing, setRemoving] = useState<string | null>(null);
    const [expandedVault, setExpandedVault] = useState<string | null>(null);
    const isDev = process.env.NODE_ENV === 'development';

    const handleRefresh = async (id: string) => {
        setRefreshing(id);
        await refreshVaultData(id);
        setRefreshing(null);
        window.location.reload();
    };

    const handleRemove = async (id: string) => {
        setRemoving(id);
        await removeVault(id);
        setRemoving(null);
        window.location.reload();
    };

    const toggleExpand = (id: string) => {
        setExpandedVault(expandedVault === id ? null : id);
    };

    if (vaults.length === 0) return (
        <div className="text-center py-8 text-gray-400 bg-gray-800 rounded-lg border border-gray-700 p-6">
            No vaults found. Add a vault using the form above.
        </div>
    );

    return (
        <div className="overflow-x-auto bg-gray-800 rounded-lg shadow-lg border border-gray-700">
            <table className="min-w-full text-sm text-gray-300">
                <thead className="bg-gray-700 text-left">
                    <tr>
                        <th className="p-3 font-medium">Name</th>
                        <th className="p-3 font-medium">Contract</th>
                        <th className="p-3 font-medium">Tokens</th>
                        <th className="p-3 font-medium">Fee</th>
                        <th className="p-3 font-medium">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                    {vaults.map(v => {
                        const isRefreshing = refreshing === v.contractId;
                        const isRemoving = removing === v.contractId;
                        const isExpanded = expandedVault === v.contractId;
                        return (
                            <>
                                <tr
                                    key={v.contractId}
                                    className={`${isExpanded ? 'bg-gray-700/50' : 'hover:bg-gray-700/30'} cursor-pointer`}
                                    onClick={() => toggleExpand(v.contractId)}
                                >
                                    <td className="p-3 whitespace-nowrap font-medium flex items-center gap-2">
                                        {/* LP Token Image */}
                                        {v.image && (
                                            <div className="flex-shrink-0 h-8 w-8 mr-1">
                                                <img
                                                    src={v.image}
                                                    alt={`${v.name} logo`}
                                                    className="h-8 w-8 rounded-full object-contain bg-gray-600/50 p-1"
                                                />
                                            </div>
                                        )}
                                        {v.name} <span className="text-gray-400">({v.symbol})</span>
                                        <span className="ml-2 text-gray-500">
                                            {isExpanded ?
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"></path>
                                                </svg>
                                                :
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                                                </svg>
                                            }
                                        </span>
                                    </td>
                                    <td className="p-3 whitespace-nowrap font-mono text-xs text-gray-400">
                                        {truncateContractId(v.contractId)}
                                    </td>
                                    <td className="p-3 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <span className="flex items-center">
                                                {v.tokenA.image && (
                                                    <img
                                                        src={v.tokenA.image}
                                                        alt={v.tokenA.symbol}
                                                        className="w-5 h-5 rounded-full mr-1 object-contain bg-blue-900/50 p-0.5"
                                                    />
                                                )}
                                                <span className="text-blue-300">{v.tokenA.symbol}</span>
                                            </span>
                                            /
                                            <span className="flex items-center">
                                                {v.tokenB.image && (
                                                    <img
                                                        src={v.tokenB.image}
                                                        alt={v.tokenB.symbol}
                                                        className="w-5 h-5 rounded-full mr-1 object-contain bg-purple-900/50 p-0.5"
                                                    />
                                                )}
                                                <span className="text-purple-300">{v.tokenB.symbol}</span>
                                            </span>
                                        </div>
                                    </td>
                                    <td className="p-3 text-center text-green-300">
                                        {(v.fee / 10000).toFixed(2)}%
                                    </td>
                                    <td className="p-3 whitespace-nowrap flex gap-2">
                                        <button
                                            className="px-2 py-1 text-blue-400 hover:text-blue-300 hover:underline disabled:opacity-50"
                                            disabled={isRefreshing || isRemoving}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRefresh(v.contractId);
                                            }}
                                        >
                                            {isRefreshing ? 'Refreshing…' : 'Refresh'}
                                        </button>
                                        {isDev && (
                                            <button
                                                className="px-2 py-1 text-red-400 hover:text-red-300 hover:underline disabled:opacity-50"
                                                disabled={isRefreshing || isRemoving}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRemove(v.contractId);
                                                }}
                                            >
                                                {isRemoving ? 'Removing…' : 'Remove'}
                                            </button>
                                        )}
                                    </td>
                                </tr>

                                {/* Expanded Details Panel */}
                                {isExpanded && (
                                    <tr className="bg-gray-700/30">
                                        <td colSpan={5} className="p-0">
                                            <div className="p-6 text-gray-300 text-sm">
                                                {/* LP Token Section */}
                                                <div className="mb-6 border-b border-gray-600 pb-6">
                                                    <h3 className="text-lg font-bold text-gray-100 mb-4 flex items-center">
                                                        <span className="mr-2">LP Token Details</span>
                                                        <span className="px-2 py-0.5 bg-gray-600 rounded-md text-xs font-normal text-gray-300">
                                                            {v.contractAddress}.{v.contractName}
                                                        </span>
                                                    </h3>
                                                    <div className="flex flex-col md:flex-row gap-6">
                                                        {/* LP Token Image */}
                                                        {v.image && (
                                                            <div className="flex-shrink-0">
                                                                <img
                                                                    src={v.image}
                                                                    alt={`${v.name} logo`}
                                                                    className="w-24 h-24 rounded-md object-contain bg-gray-600/50 p-2 border border-gray-700"
                                                                />
                                                            </div>
                                                        )}

                                                        <div className="flex-grow">
                                                            <div className="mb-4">
                                                                <h4 className="font-semibold text-xl text-gray-100">
                                                                    {v.name} <span className="text-gray-400">({v.symbol})</span>
                                                                </h4>

                                                                {v.description && (
                                                                    <p className="text-gray-400 mt-1 italic text-sm">{v.description}</p>
                                                                )}
                                                            </div>

                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                                                                <div className="flex items-baseline">
                                                                    <span className="w-24 text-gray-400">Contract ID:</span>
                                                                    <span className="font-mono text-xs">{v.contractId}</span>
                                                                </div>
                                                                <div className="flex items-baseline">
                                                                    <span className="w-24 text-gray-400">Identifier:</span>
                                                                    <span>{v.identifier || '—'}</span>
                                                                </div>
                                                                <div className="flex items-baseline">
                                                                    <span className="w-24 text-gray-400">Decimals:</span>
                                                                    <span>{v.decimals}</span>
                                                                </div>
                                                                <div className="flex items-baseline">
                                                                    <span className="w-24 text-gray-400">Fee:</span>
                                                                    <span className="text-green-300">{(v.fee / 10000).toFixed(2)}%</span>
                                                                </div>
                                                                {v.engineContractId && (
                                                                    <div className="col-span-2 flex items-baseline">
                                                                        <span className="w-24 text-gray-400">Engine:</span>
                                                                        <span className="font-mono text-xs">{v.engineContractId}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Underlying Tokens Section */}
                                                <h3 className="text-lg font-bold text-gray-100 mb-4">Underlying Tokens</h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    {/* Token A Details */}
                                                    <div className="bg-blue-900/10 rounded-md border border-blue-900/30 overflow-hidden">
                                                        <div className="bg-blue-900/30 p-3 border-b border-blue-800/50">
                                                            <div className="flex items-center gap-3">
                                                                {v.tokenA.image && (
                                                                    <img
                                                                        src={v.tokenA.image}
                                                                        alt={`${v.tokenA.name} logo`}
                                                                        className="w-10 h-10 rounded-md object-contain bg-blue-900/40 p-1"
                                                                    />
                                                                )}
                                                                <div>
                                                                    <h4 className="font-semibold text-blue-300">
                                                                        {v.tokenA.name} <span className="text-gray-400">({v.tokenA.symbol})</span>
                                                                    </h4>
                                                                    <div className="text-xs font-mono text-gray-400">
                                                                        {v.tokenA.contractId}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="p-4 space-y-3">
                                                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                                                <div>
                                                                    <span className="text-gray-400 block text-xs mb-1">Decimals</span>
                                                                    <span>{v.tokenA.decimals}</span>
                                                                </div>
                                                                {v.tokenA.identifier && (
                                                                    <div>
                                                                        <span className="text-gray-400 block text-xs mb-1">Identifier</span>
                                                                        <span>{v.tokenA.identifier}</span>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {v.tokenA.description && (
                                                                <div className="pt-2 border-t border-blue-900/30">
                                                                    <span className="text-gray-400 block text-xs mb-1">Description</span>
                                                                    <p className="italic text-gray-300 text-sm">{v.tokenA.description}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Token B Details */}
                                                    <div className="bg-purple-900/10 rounded-md border border-purple-900/30 overflow-hidden">
                                                        <div className="bg-purple-900/30 p-3 border-b border-purple-800/50">
                                                            <div className="flex items-center gap-3">
                                                                {v.tokenB.image && (
                                                                    <img
                                                                        src={v.tokenB.image}
                                                                        alt={`${v.tokenB.name} logo`}
                                                                        className="w-10 h-10 rounded-md object-contain bg-purple-900/40 p-1"
                                                                    />
                                                                )}
                                                                <div>
                                                                    <h4 className="font-semibold text-purple-300">
                                                                        {v.tokenB.name} <span className="text-gray-400">({v.tokenB.symbol})</span>
                                                                    </h4>
                                                                    <div className="text-xs font-mono text-gray-400">
                                                                        {v.tokenB.contractId}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="p-4 space-y-3">
                                                            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                                                <div>
                                                                    <span className="text-gray-400 block text-xs mb-1">Decimals</span>
                                                                    <span>{v.tokenB.decimals}</span>
                                                                </div>
                                                                {v.tokenB.identifier && (
                                                                    <div>
                                                                        <span className="text-gray-400 block text-xs mb-1">Identifier</span>
                                                                        <span>{v.tokenB.identifier}</span>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {v.tokenB.description && (
                                                                <div className="pt-2 border-t border-purple-900/30">
                                                                    <span className="text-gray-400 block text-xs mb-1">Description</span>
                                                                    <p className="italic text-gray-300 text-sm">{v.tokenB.description}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
} 