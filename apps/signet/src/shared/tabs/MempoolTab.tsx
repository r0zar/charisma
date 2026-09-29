/**
 * MempoolTab - Visualizes pending transactions in the mempool with expanded view and action controls
 */

import { useState } from 'react';
import { useSignetContext } from '~shared/context/SignetContext';
import { colors, tint } from '~shared/styles/theme';
import { motion, AnimatePresence } from 'framer-motion';
import { txTypeContracts } from '~background/lib';

// Helper interface for Status
interface Status {
  subnet: string;
  txQueue: any[];
}

export function MempoolTab() {
  const { status, isLoading, refreshStatus, discardTransaction, mineSingleTransaction, mineBatchTransactions } = useSignetContext();
  const [expandedTxIds, setExpandedTxIds] = useState<string[]>([]);
  const [processingTxs, setProcessingTxs] = useState<string[]>([]);
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
  const [isBatchMining, setIsBatchMining] = useState(false);

  // Collect transactions from all subnets
  const allTxs = getAllTransactions(status);
  const txQueueSize = allTxs.length;

  // Helper function to collect transactions from all subnets
  function getAllTransactions(status: Record<string, Status> | null): Array<any> {
    if (!status) return [];

    // Create a counter to ensure unique IDs even with duplicate tx data
    let uniqueCounter = 0;

    // Flatten all txQueues from all subnets into a single array
    return Object.entries(status).flatMap(([subnetId, subnetStatus]) => {
      // Add subnet identifier to each transaction
      return (subnetStatus.txQueue || []).map(tx => {
        uniqueCounter++;
        return {
          ...tx,
          ...tx.data,
          subnetId,
          subnetName: subnetStatus.subnet.split('.')[1], // Extract subnet name
          // Create truly unique ID for transaction using counter and more reliable properties
          id: `${tx.type || 'tx'}-${tx.nonce || uniqueCounter}-${subnetId}-${uniqueCounter}`
        };
      });
    });
  }

  // Toggle expanded state for a transaction
  const toggleExpandTx = (txId: string) => {
    // Close all others and open just this one (prevents multiple expanding)
    setExpandedTxIds(prev =>
      prev.includes(txId) ? [] : [txId]
    );
  };

  // Toggle selection of a transaction
  const toggleSelectTx = (e: React.MouseEvent, txId: string) => {
    e.stopPropagation(); // Prevent expanding/collapsing when selecting

    setSelectedTxIds(prev =>
      prev.includes(txId)
        ? prev.filter(id => id !== txId)
        : [...prev, txId]
    );
  };

  // Toggle select all transactions
  const toggleSelectAll = () => {
    if (selectedTxIds.length === allTxs.length) {
      // If all are selected, unselect all
      setSelectedTxIds([]);
    } else {
      // Otherwise, select all
      setSelectedTxIds(allTxs.map(tx => tx.id));
    }
  };

  // Discard a transaction from the mempool
  const discard = async (txId: string) => {
    // Find the transaction by ID in our local allTxs collection
    const tx = allTxs.find(tx => tx.id === txId);
    if (!tx || !tx.signature) {
      console.error("Transaction not found or missing signature:", txId);
      return;
    }

    // Mark as processing
    setProcessingTxs(prev => [...prev, txId]);

    // Remove from selection
    setSelectedTxIds(prev => prev.filter(id => id !== txId));

    try {
      // Call the API to remove from mempool using transaction's signature
      const result = await discardTransaction(tx.signature, tx.subnetId);

      if (result.success) {
        console.log(`Successfully discarded transaction from: ${result.removedFrom.join(', ')}`);
        // Refresh the status to update UI
        await refreshStatus();
      } else {
        console.error("Failed to discard transaction, not found in any subnet");
      }
    } catch (error) {
      console.error("Error discarding transaction:", error);
    } finally {
      // Remove from processing state
      setProcessingTxs(prev => prev.filter(id => id !== txId));
    }
  };

  // Mine a single transaction
  const mineTransaction = async (txId: string) => {
    // Find the transaction by ID in our local allTxs collection
    const tx = allTxs.find(tx => tx.id === txId);
    if (!tx || !tx.signature) {
      console.error("Transaction not found or missing signature:", txId);
      return;
    }

    // Mark as processing
    setProcessingTxs(prev => [...prev, txId]);

    try {
      // this is a work in progress, but we are detecting the "subnet" from the transaction type...
      const subnetId = txTypeContracts[tx.type].contract;

      // Call the API to mine the transaction using its signature
      const result = await mineSingleTransaction(tx.signature, subnetId);

      if (result.success) {
        console.log(`Successfully mined transaction with txid: ${result.txid} on subnet: ${result.subnet}`);
      } else {
        console.error(`Failed to mine transaction: ${result.error}`);
      }

      // Refresh the mempool after mining
      await refreshStatus();
    } catch (error) {
      console.error("Mining error:", error);
    } finally {
      // Remove from processing and selection state
      setProcessingTxs(prev => prev.filter(id => id !== txId));
      setSelectedTxIds(prev => prev.filter(id => id !== txId));
    }
  };

  // Mine selected transactions in batch
  const mineBatch = async () => {
    if (selectedTxIds.length === 0) return;

    // Collect signatures for all selected transactions
    const signatures: string[] = [];
    const missingSignatures: string[] = [];

    // Find all transactions and collect their signatures
    for (const txId of selectedTxIds) {
      const tx = allTxs.find(tx => tx.id === txId);
      if (tx && tx.signature) {
        signatures.push(tx.signature);
      } else {
        missingSignatures.push(txId);
        console.warn(`Transaction ${txId} not found or missing signature`);
      }
    }

    // If no valid signatures, abort
    if (signatures.length === 0) {
      console.error("No valid transactions to mine");
      return;
    }

    // Mark batch mining state
    setIsBatchMining(true);
    // Mark all selected transactions as processing
    setProcessingTxs(prev => [...prev, ...selectedTxIds]);

    try {
      // Call the API to mine these transactions as a batch
      const result = await mineBatchTransactions(signatures);

      if (result.success) {
        // Success info by subnet
        let mineCount = 0;
        let totalMined = 0;

        // Show results by subnet
        Object.entries(result.results).forEach(([subnetId, subnetResult]) => {
          const { success, count, error } = subnetResult;
          if (success && count > 0) {
            console.log(`Successfully mined ${count} transaction(s) on ${subnetId}`);
            totalMined += count;
          } else if (error) {
            console.error(`Error mining on ${subnetId}: ${error}`);
          }
        });

        console.log(`Batch mining completed: ${totalMined}/${signatures.length} transactions mined`);
      } else {
        console.error("Failed to mine any transactions in batch");
      }

      // Refresh the mempool after mining
      await refreshStatus();
    } catch (error) {
      console.error("Batch mining error:", error);
    } finally {
      setIsBatchMining(false);
      setProcessingTxs(prev => prev.filter(id => !selectedTxIds.includes(id)));
      setSelectedTxIds([]);
    }
  };

  return (
    <div style={{
      padding: '8px 0',
      display: 'flex',
      flexDirection: 'column',
      maxHeight: '640px'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        marginBottom: '12px',
        padding: '0 12px',
        gap: '8px'
      }}>
        {/* Header row with title and refresh button */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px', color: colors.cyber, fontWeight: 'bold' }}>
              Signed Messages: {txQueueSize}
            </span>
          </div>

          <motion.button
            onClick={refreshStatus}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
              background: 'none',
              border: 'none',
              color: colors.steel,
              cursor: 'pointer',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <motion.span
              animate={isLoading ? { rotate: [0, 360] } : {}}
              transition={{ duration: 1, repeat: isLoading ? Infinity : 0, ease: 'linear' }}
            >
              ↻
            </motion.span>
            Refresh
          </motion.button>
        </div>

        {/* Action bar with selection controls and batch mine button */}
        {txQueueSize > 0 && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(1, 4, 9, 0.5)',
            padding: '6px 10px',
            borderRadius: '4px',
            border: '1px solid rgba(125, 249, 255, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {/* Select all checkbox */}
              <div
                onClick={toggleSelectAll}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  cursor: 'pointer'
                }}
              >
                <div style={{
                  width: '14px',
                  height: '14px',
                  border: `1px solid ${selectedTxIds.length > 0 ? colors.cyber : colors.steel}`,
                  borderRadius: '2px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  background: selectedTxIds.length > 0 ? 'rgba(125, 249, 255, 0.1)' : 'transparent'
                }}>
                  {selectedTxIds.length === allTxs.length && allTxs.length > 0 ? (
                    <span style={{ color: colors.cyber, fontSize: '10px' }}>✓</span>
                  ) : selectedTxIds.length > 0 ? (
                    <span style={{ color: colors.cyber, fontSize: '10px' }}>-</span>
                  ) : null}
                </div>
                <span style={{
                  fontSize: '11px',
                  color: selectedTxIds.length > 0 ? colors.cyber : colors.steel
                }}>
                  {selectedTxIds.length === 0
                    ? 'Select All'
                    : `${selectedTxIds.length} selected`
                  }
                </span>
              </div>
            </div>

            {/* Batch mining action button */}
            <motion.button
              onClick={mineBatch}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={selectedTxIds.length === 0 || isBatchMining}
              style={{
                background: selectedTxIds.length === 0
                  ? 'rgba(1, 4, 9, 0.4)'
                  : 'rgba(125, 249, 255, 0.1)',
                border: `1px solid ${selectedTxIds.length === 0
                  ? 'rgba(125, 249, 255, 0.1)'
                  : 'rgba(125, 249, 255, 0.3)'}`,
                borderRadius: '4px',
                padding: '4px 10px',
                color: selectedTxIds.length === 0 ? colors.steel : colors.cyber,
                fontSize: '11px',
                cursor: selectedTxIds.length === 0 ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isBatchMining ? (
                <motion.span
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                >
                  ⚙️
                </motion.span>
              ) : (
                <span style={{ fontSize: '13px' }}>⛏️</span>
              )}
              <span>
                Batch Mine {selectedTxIds.length > 0 ? `(${selectedTxIds.length})` : ''}
              </span>
            </motion.button>
          </div>
        )}
      </div>

      {/* Transaction List View */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        scrollbarWidth: 'thin',
        scrollbarColor: `${colors.cyber} rgba(1, 4, 9, 0.5)`,
      }}>
        {txQueueSize === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px 16px',
              height: '210px',
              gap: '16px'
            }}
          >
            {/* Empty mempool illustration */}
            <motion.div
              animate={{
                y: [0, -8, 0],
                opacity: [0.6, 1, 0.6]
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
              style={{
                position: 'relative',
                width: '80px',
                height: '80px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              {/* Outer ring */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
                style={{
                  position: 'absolute',
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  border: `1px dashed ${tint(colors.cyber, 0.19)}`,
                  boxShadow: `0 0 20px ${tint(colors.cyber, 0.13)} inset`
                }}
              />

              {/* Middle ring */}
              <motion.div
                animate={{ rotate: -180 }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                style={{
                  position: 'absolute',
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  border: `1px dashed ${tint(colors.cyber, 0.31)}`
                }}
              />

              {/* Icon in center */}
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: `radial-gradient(circle, ${tint(colors.cyber, 0.19)} 0%, transparent 70%)`,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                color: colors.cyber,
                fontSize: '16px'
              }}>
                ⚡
              </div>
            </motion.div>

            {/* Text content */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px'
            }}>
              <div style={{
                color: colors.white,
                fontSize: '14px',
                fontWeight: 'bold',
                textAlign: 'center'
              }}>
                Mempool Empty
              </div>
              <div style={{
                color: colors.steel,
                fontSize: '12px',
                textAlign: 'center',
                maxWidth: '240px',
                lineHeight: '1.5'
              }}>
                Signed messages will appear here when they're ready to be settled on-chain
              </div>
            </div>

            {/* Refresh button */}
            <motion.button
              whileHover={{ scale: 1.05, background: `rgba(125, 249, 255, 0.15)` }}
              whileTap={{ scale: 0.95 }}
              onClick={refreshStatus}
              style={{
                marginTop: '8px',
                background: 'rgba(125, 249, 255, 0.08)',
                border: '1px solid rgba(125, 249, 255, 0.3)',
                borderRadius: '4px',
                padding: '6px 14px',
                color: colors.cyber,
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <motion.span
                animate={isLoading ? { rotate: [0, 360] } : {}}
                transition={{ duration: 1, repeat: isLoading ? Infinity : 0, ease: 'linear' }}
              >
                ↻
              </motion.span>
              Refresh
            </motion.button>
          </motion.div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 12px' }}>
            {allTxs.map((tx) => {
              const isExpanded = expandedTxIds.includes(tx.id);
              const isProcessing = processingTxs.includes(tx.id);

              return (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    border: `1px solid ${isExpanded
                      ? 'rgba(125, 249, 255, 0.4)'
                      : selectedTxIds.includes(tx.id)
                        ? 'rgba(125, 249, 255, 0.35)'
                        : 'rgba(125, 249, 255, 0.2)'
                      }`,
                    borderRadius: '4px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                    background: selectedTxIds.includes(tx.id)
                      ? 'rgba(125, 249, 255, 0.05)'
                      : 'rgba(1, 4, 9, 0.6)',
                  }}
                  onClick={() => !isProcessing && toggleExpandTx(tx.id)}
                >
                  {/* Processing overlay */}
                  {isProcessing && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'rgba(1, 4, 9, 0.7)',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      zIndex: 10
                    }}>
                      <motion.div
                        animate={{ rotate: [0, 360] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                      >
                        <div style={{
                          color: colors.cyber,
                          fontSize: '18px'
                        }}>⚙️</div>
                      </motion.div>
                    </div>
                  )}

                  {/* Transaction header - always visible */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '4px',
                    fontSize: '11px',
                    alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {/* Selection checkbox */}
                      <div
                        onClick={(e) => toggleSelectTx(e, tx.id)}
                        style={{
                          width: '14px',
                          height: '14px',
                          border: `1px solid ${selectedTxIds.includes(tx.id) ? colors.cyber : colors.steel}`,
                          borderRadius: '2px',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          background: selectedTxIds.includes(tx.id) ? 'rgba(125, 249, 255, 0.1)' : 'transparent',
                          cursor: 'pointer'
                        }}
                      >
                        {selectedTxIds.includes(tx.id) && (
                          <span style={{ color: colors.cyber, fontSize: '10px' }}>✓</span>
                        )}
                      </div>

                      <div>
                        <span style={{ color: colors.cyber, textTransform: 'uppercase' }}>
                          {tx.type}
                        </span>
                        <span style={{
                          color: '#FFAA00',
                          fontSize: '9px',
                          marginLeft: '4px',
                          opacity: 0.9,
                          background: 'rgba(255, 170, 0, 0.1)',
                          padding: '1px 4px',
                          borderRadius: '2px'
                        }}>
                          {tx.subnetName}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: colors.steel }}>
                        Nonce: {tx.nonce}
                      </span>
                      <span style={{
                        color: isExpanded ? colors.cyber : colors.steel,
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s ease'
                      }}>
                        ▼
                      </span>
                    </div>
                  </div>

                  {/* Basic transaction info - always visible */}
                  {tx.type === 'transfer' && (
                    <div style={{ fontSize: '11px', color: '#FFFFFF' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between' }}>
                        <div>From: <span style={{ color: colors.steel }}>
                          {tx.signer && typeof tx.signer === 'string'
                            ? `${tx.signer.slice(0, 6)}...${tx.signer.slice(-4)}`
                            : 'Unknown'}
                        </span></div>
                        <div>To: <span style={{ color: colors.steel }}>
                          {tx.to && typeof tx.to === 'string'
                            ? `${tx.to.slice(0, 6)}...${tx.to.slice(-4)}`
                            : 'Unknown'}
                        </span></div>
                      </div>
                      <div style={{ textAlign: 'right', marginTop: '4px', color: '#36C758' }}>
                        Amount: {tx.amount}
                      </div>
                    </div>
                  )}

                  {tx.type === 'predict' && (
                    <div style={{ fontSize: '11px', color: '#FFFFFF' }}>
                      <div>From: <span style={{ color: colors.steel }}>
                        {tx.signer && typeof tx.signer === 'string'
                          ? `${tx.signer.slice(0, 6)}...${tx.signer.slice(-4)}`
                          : 'Unknown'}
                      </span></div>
                      <div style={{ marginTop: '4px' }}>
                        <span style={{ color: colors.steel }}>Market: {tx.marketId}</span> |
                        <span style={{ color: colors.steel }}> Outcome: {tx.outcomeId}</span>
                      </div>
                      <div style={{ textAlign: 'right', marginTop: '4px', color: '#FFCC00' }}>
                        Amount: {tx.amount}
                      </div>
                    </div>
                  )}

                  {tx.type === 'claim-reward' && (
                    <div style={{ fontSize: '11px', color: '#FFFFFF' }}>
                      <div>Claimer: <span style={{ color: colors.steel }}>
                        {tx.signer && typeof tx.signer === 'string'
                          ? `${tx.signer.slice(0, 6)}...${tx.signer.slice(-4)}`
                          : 'Unknown'}
                      </span></div>
                      <div style={{ textAlign: 'right', marginTop: '4px', color: '#DA2FB7' }}>
                        Receipt ID: {tx.receiptId}
                      </div>
                    </div>
                  )}

                  {/* Expanded content - only visible when expanded */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ marginTop: '10px' }}
                      >
                        {/* Divider */}
                        <div style={{
                          height: '1px',
                          background: 'rgba(125, 249, 255, 0.15)',
                          margin: '8px 0'
                        }} />

                        {/* Additional transaction details */}
                        <div style={{ fontSize: '11px', color: colors.steel, marginBottom: '10px' }}>
                          <div style={{ marginBottom: '4px' }}>
                            <span style={{ color: colors.white }}>Full Signer:</span> {tx.signer}
                          </div>
                          {tx.to && (
                            <div style={{ marginBottom: '4px' }}>
                              <span style={{ color: colors.white }}>Full Recipient:</span> {tx.to}
                            </div>
                          )}
                          <div style={{ marginBottom: '4px' }}>
                            <span style={{ color: colors.white }}>Subnet ID:</span> {tx.subnetId}
                          </div>
                          {tx.data && (
                            <div>
                              <span style={{ color: colors.white }}>Raw Data:</span>
                              <pre style={{
                                background: 'rgba(1, 4, 9, 0.4)',
                                padding: '6px',
                                borderRadius: '4px',
                                marginTop: '4px',
                                fontSize: '10px',
                                overflowX: 'auto'
                              }}>
                                {JSON.stringify(tx.data, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'flex-end',
                          gap: '8px',
                          marginTop: '8px'
                        }}>
                          {/* Possible transformations would go here */}
                          <div style={{
                            fontSize: '10px',
                            color: colors.steel,
                            padding: '4px 8px',
                            background: 'rgba(1, 4, 9, 0.4)',
                            borderRadius: '4px',
                            border: '1px solid rgba(125, 249, 255, 0.1)',
                            display: 'flex',
                            alignItems: 'center'
                          }}>
                            <span>Available actions:</span>
                          </div>

                          {/* Discard button */}
                          <motion.button
                            onClick={(e) => {
                              e.stopPropagation();
                              discard(tx.id);
                            }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            style={{
                              background: 'rgba(255, 78, 78, 0.1)',
                              border: '1px solid rgba(255, 78, 78, 0.3)',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              color: '#FF4E4E',
                              fontSize: '10px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            ✕ Discard
                          </motion.button>

                          {/* Mine button */}
                          <motion.button
                            onClick={(e) => {
                              e.stopPropagation();
                              mineTransaction(tx.id);
                            }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            style={{
                              background: 'rgba(125, 249, 255, 0.1)',
                              border: '1px solid rgba(125, 249, 255, 0.3)',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              color: colors.cyber,
                              fontSize: '10px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            ⚡ Mine
                          </motion.button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}