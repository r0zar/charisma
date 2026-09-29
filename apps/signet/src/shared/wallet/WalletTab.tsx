/**
 * WalletTab - Interface for managing wallet, seed phrases and accounts
 */

import { useState, useEffect } from 'react';
import { useSignetContext } from '~shared/context/SignetContext';
import { colors } from '~shared/styles/theme';
import { motion } from 'framer-motion';
import { saveEncryptedWalletBackup } from '~shared/context/utils';
import { PasswordField } from './PasswordField';

export function WalletTab() {
  const {
    isLoading,
    isWalletInitialized,
    hasWallet,
    currentAccount,
    accounts,
    seedPhrases,
    initializeWallet,
    createSeedPhrase,
    importSeedPhrase,
    createAccount,
    activateAccount,
    deleteSeedPhrase,
    resetWallet,
    refreshWalletState,
    endSession,
  } = useSignetContext();

  // Form state for wallet tab
  const [walletPassword, setWalletPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [seedPhraseName, setSeedPhraseName] = useState('');
  const [seedPhraseImport, setSeedPhraseImport] = useState('');
  const [selectedSeedPhraseId, setSelectedSeedPhraseId] = useState('');
  const [isCreatingSeedPhrase, setIsCreatingSeedPhrase] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isImportingPhrase, setIsImportingPhrase] = useState(false);
  const [walletView, setWalletView] = useState(isWalletInitialized ? 'accounts' : 'setup');

  // Update wallet view when initialization status changes
  useEffect(() => {
    setWalletView(isWalletInitialized ? 'accounts' : 'setup');
  }, [isWalletInitialized]);

  // Effect to check wallet status on load
  useEffect(() => {
    if (isWalletInitialized) {
      refreshWalletState();
    }
  }, []);

  // Handle wallet initialization
  // Unlock the wallet, or create it (password typed twice) when there isn't one yet
  const handleInitializeWallet = async (e) => {
    e.preventDefault();
    if (!walletPassword) return;
    if (!hasWallet && walletPassword !== confirmPassword) {
      setUnlockError("Passwords don't match");
      return;
    }
    setUnlockError(null);
    try {
      await initializeWallet(walletPassword);
      setWalletPassword('');
      setConfirmPassword('');
      refreshWalletState();
      setWalletView('accounts');
    } catch (err) {
      setUnlockError(err instanceof Error ? err.message : 'Could not unlock the wallet');
    }
  };

  // Handle creating a new seed phrase
  const handleCreateSeedPhrase = async (e) => {
    e.preventDefault();
    if (seedPhraseName) {
      try {
        const newPhrase = await createSeedPhrase(seedPhraseName);
        setSeedPhraseName('');
        setIsCreatingSeedPhrase(false);
        if (newPhrase) {
          setSelectedSeedPhraseId(newPhrase.id);
          setIsCreatingAccount(true);
        }
      } catch (err) {
        console.error('Error creating seed phrase:', err);
      }
    }
  };

  // Handle importing a seed phrase
  const handleImportSeedPhrase = async (e) => {
    e.preventDefault();
    if (seedPhraseName && seedPhraseImport) {
      try {
        const imported = await importSeedPhrase(seedPhraseName, seedPhraseImport);
        setSeedPhraseName('');
        setSeedPhraseImport('');
        setIsImportingPhrase(false);
        if (imported) {
          setSelectedSeedPhraseId(imported.id);
          setIsCreatingAccount(true);
        }
      } catch (err) {
        console.error('Error importing seed phrase:', err);
      }
    }
  };

  // Handle creating an account from a seed phrase
  const handleCreateAccount = async (e) => {
    e.preventDefault();
    if (selectedSeedPhraseId) {
      try {
        await createAccount(selectedSeedPhraseId, true); // Make it active with auto-generated name
        setIsCreatingAccount(false);
        refreshWalletState();
      } catch (err) {
        console.error('Error creating account:', err);
      }
    }
  };

  // Handle activating an account
  const handleActivateAccount = async (id) => {
    try {
      await activateAccount(id);
      refreshWalletState();
    } catch (err) {
      console.error('Error activating account:', err);
    }
  };

  // Handle deleting a seed phrase
  const handleDeleteSeedPhrase = async (id) => {
    if (confirm('Are you sure you want to delete this seed phrase? This will delete all accounts associated with it and CANNOT be undone.')) {
      try {
        await deleteSeedPhrase(id);
        refreshWalletState();
      } catch (err) {
        console.error('Error deleting seed phrase:', err);
      }
    }
  };

  // Handle resetting the wallet
  const handleResetWallet = async () => {
    if (confirm('Delete this wallet? All seed phrases and accounts are removed from this browser and CANNOT be recovered without your seed phrase written down.')) {
      try {
        await resetWallet();
        refreshWalletState();
      } catch (err) {
        console.error('Error resetting wallet:', err);
      }
    }
  };

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await endSession();
      setWalletView('setup');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  return (
    <div style={{
      padding: '16px 8px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
      {/* Setup view - initial wallet setup with password */}
      {walletView === 'setup' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            fontSize: '14px',
            color: colors.steel,
            padding: '8px',
            border: '1px solid rgba(125, 249, 255, 0.2)',
            borderRadius: '4px',
            background: 'rgba(1, 4, 9, 0.3)',
          }}>
            {hasWallet
              ? 'Wallet locked. Enter your password to unlock.'
              : 'Create a password to protect your wallet on this browser'}
          </div>

          <form onSubmit={handleInitializeWallet} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label
                htmlFor="walletPassword"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  color: colors.cyber,
                  marginBottom: '8px',
                  fontWeight: 'bold'
                }}
              >
                <span style={{ fontSize: '16px', marginRight: '4px' }}>🔐</span> {hasWallet ? 'Password' : 'New password'}
              </label>

              <PasswordField value={walletPassword} onChange={setWalletPassword} onEnter={handleInitializeWallet} placeholder={hasWallet ? "Enter your password..." : "Enter a strong password..."} label="Password" />

              <div style={{
                fontSize: '11px',
                color: colors.steel,
                marginTop: '6px',
                textAlign: 'center'
              }}>
                {!hasWallet && <><span style={{ color: 'rgba(125, 249, 255, 0.7)' }}>⚠️</span> Use a strong password with at least 8 characters</>}
              </div>

              {!hasWallet && (
                <div style={{ marginTop: '12px' }}>
                  <PasswordField value={confirmPassword} onChange={setConfirmPassword} onEnter={handleInitializeWallet} placeholder="Type it again..." label="Confirm password" />
                </div>
              )}

              {unlockError && (
                <div role="alert" style={{ marginTop: '10px', fontSize: '12px', color: '#FF4E4E', textAlign: 'center' }}>
                  {unlockError}
                </div>
              )}
            </div>

            <motion.button
              type="submit"
              whileHover={{ scale: 1.02, boxShadow: '0 0 8px rgba(125, 249, 255, 0.4)' }}
              whileTap={{ scale: 0.98 }}
              disabled={!walletPassword}
              style={{
                padding: '12px 18px',
                background: !walletPassword ? 'rgba(125, 249, 255, 0.05)' : 'rgba(125, 249, 255, 0.1)',
                border: '1px solid rgba(125, 249, 255, 0.4)',
                borderRadius: '4px',
                color: !walletPassword ? 'rgba(125, 249, 255, 0.4)' : colors.cyber,
                cursor: !walletPassword ? 'default' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                alignSelf: 'center',
                marginTop: '8px',
                width: '80%'
              }}
            >
              {hasWallet ? 'Unlock' : 'Create Wallet'}
            </motion.button>
          </form>

          {/* Animation styles */}
          <style>
            {`
              @keyframes blink {
                0%, 100% { opacity: 1; }
                50% { opacity: 0; }
              }
              @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
              }
              @keyframes glow {
                0% { border-color: rgba(125, 249, 255, 0.6); box-shadow: 0 0 15px rgba(125, 249, 255, 0.3), 0 0 5px rgba(125, 249, 255, 0.5) inset; }
                100% { border-color: rgba(125, 249, 255, 0.9); box-shadow: 0 0 20px rgba(125, 249, 255, 0.4), 0 0 10px rgba(125, 249, 255, 0.6) inset; }
              }
            `}
          </style>
        </div>
      )}

      {/* Creating account view */}
      {walletView === 'accounts' && isCreatingAccount && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '14px', color: colors.cyber, fontWeight: 'bold' }}>
              Create Account
            </span>
            <motion.button
              onClick={() => setIsCreatingAccount(false)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{
                background: 'none',
                border: 'none',
                color: colors.steel,
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              ← Back
            </motion.button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{
              padding: '12px',
              backgroundColor: 'rgba(54, 199, 88, 0.05)',
              border: '1px solid rgba(54, 199, 88, 0.2)',
              borderRadius: '4px',
              fontSize: '12px',
              color: colors.steel
            }}>
              A new account will be created from this seed phrase. The account address will be automatically generated and your wallet password will be used for key encryption.
            </div>

            <motion.button
              onClick={handleCreateAccount}
              whileHover={{ scale: 1.02, boxShadow: '0 0 8px rgba(125, 249, 255, 0.4)' }}
              whileTap={{ scale: 0.98 }}
              style={{
                padding: '10px 16px',
                background: 'rgba(125, 249, 255, 0.1)',
                border: '1px solid rgba(125, 249, 255, 0.4)',
                borderRadius: '4px',
                color: colors.cyber,
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                alignSelf: 'center',
                textAlign: 'center'
              }}
            >
              Create Account
            </motion.button>
          </div>
        </div>
      )}

      {/* Create seed phrase view */}
      {walletView === 'accounts' && isCreatingSeedPhrase && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '14px', color: colors.cyber, fontWeight: 'bold' }}>
              Create New Seed Phrase
            </span>
            <motion.button
              onClick={() => setIsCreatingSeedPhrase(false)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{
                background: 'none',
                border: 'none',
                color: colors.steel,
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              ← Back
            </motion.button>
          </div>

          <form onSubmit={handleCreateSeedPhrase} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label
                htmlFor="seedPhraseName"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  color: colors.steel,
                  marginBottom: '4px'
                }}
              >
                Seed Phrase Name
              </label>
              <input
                id="seedPhraseName"
                type="text"
                value={seedPhraseName}
                onChange={(e) => setSeedPhraseName(e.target.value)}
                placeholder="My Seed Phrase"
                style={{
                  width: '100%',
                  padding: '8px',
                  background: 'rgba(1, 4, 9, 0.8)',
                  border: '1px solid rgba(125, 249, 255, 0.3)',
                  borderRadius: '4px',
                  color: colors.cyber,
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{
              padding: '8px',
              backgroundColor: 'rgba(54, 199, 88, 0.05)',
              border: '1px solid rgba(54, 199, 88, 0.2)',
              borderRadius: '4px',
              fontSize: '10px',
              color: colors.steel
            }}>
              A secure seed phrase will be generated automatically. You'll create accounts from this seed phrase in the next step.
            </div>

            <motion.button
              type="submit"
              whileHover={{ scale: 1.02, boxShadow: '0 0 8px rgba(125, 249, 255, 0.4)' }}
              whileTap={{ scale: 0.98 }}
              disabled={!seedPhraseName}
              style={{
                padding: '8px 16px',
                background: !seedPhraseName ? 'rgba(125, 249, 255, 0.05)' : 'rgba(125, 249, 255, 0.1)',
                border: '1px solid rgba(125, 249, 255, 0.4)',
                borderRadius: '4px',
                color: !seedPhraseName ? 'rgba(125, 249, 255, 0.4)' : colors.cyber,
                cursor: !seedPhraseName ? 'default' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                alignSelf: 'flex-start'
              }}
            >
              Create Seed Phrase
            </motion.button>
          </form>
        </div>
      )}

      {/* Importing seed phrase view */}
      {walletView === 'accounts' && isImportingPhrase && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '14px', color: colors.cyber, fontWeight: 'bold' }}>
              Import Seed Phrase
            </span>
            <motion.button
              onClick={() => setIsImportingPhrase(false)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{
                background: 'none',
                border: 'none',
                color: colors.steel,
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              ← Back
            </motion.button>
          </div>

          <form onSubmit={handleImportSeedPhrase} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label
                htmlFor="seedPhraseName"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  color: colors.steel,
                  marginBottom: '4px'
                }}
              >
                Seed Phrase Name
              </label>
              <input
                id="seedPhraseName"
                type="text"
                value={seedPhraseName}
                onChange={(e) => setSeedPhraseName(e.target.value)}
                placeholder="My Seed Phrase"
                style={{
                  width: '100%',
                  padding: '8px',
                  background: 'rgba(1, 4, 9, 0.8)',
                  border: '1px solid rgba(125, 249, 255, 0.3)',
                  borderRadius: '4px',
                  color: colors.cyber,
                  fontSize: '14px'
                }}
              />
            </div>

            <div>
              <label
                htmlFor="seedPhraseImport"
                style={{
                  display: 'block',
                  fontSize: '12px',
                  color: colors.steel,
                  marginBottom: '4px'
                }}
              >
                Seed Phrase Words
              </label>
              <textarea
                id="seedPhraseImport"
                value={seedPhraseImport}
                onChange={(e) => setSeedPhraseImport(e.target.value)}
                placeholder="Enter your 12 or 24 word seed phrase"
                style={{
                  width: '100%',
                  padding: '8px',
                  background: 'rgba(1, 4, 9, 0.8)',
                  border: '1px solid rgba(125, 249, 255, 0.3)',
                  borderRadius: '4px',
                  color: colors.cyber,
                  fontSize: '14px',
                  minHeight: '80px',
                  resize: 'vertical'
                }}
              />
            </div>

            <motion.button
              type="submit"
              whileHover={{ scale: 1.02, boxShadow: '0 0 8px rgba(125, 249, 255, 0.4)' }}
              whileTap={{ scale: 0.98 }}
              disabled={!seedPhraseName || !seedPhraseImport}
              style={{
                padding: '8px 16px',
                background: (!seedPhraseName || !seedPhraseImport) ? 'rgba(125, 249, 255, 0.05)' : 'rgba(125, 249, 255, 0.1)',
                border: '1px solid rgba(125, 249, 255, 0.4)',
                borderRadius: '4px',
                color: (!seedPhraseName || !seedPhraseImport) ? 'rgba(125, 249, 255, 0.4)' : colors.cyber,
                cursor: (!seedPhraseName || !seedPhraseImport) ? 'default' : 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                alignSelf: 'flex-start'
              }}
            >
              Import Phrase
            </motion.button>
          </form>
        </div>
      )}

      {/* Main accounts view */}
      {walletView === 'accounts' && !isCreatingAccount && !isImportingPhrase && !isCreatingSeedPhrase && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Current active account display */}
          <div style={{
            border: '1px solid rgba(54, 199, 88, 0.4)',
            borderRadius: '6px',
            background: 'rgba(54, 199, 88, 0.05)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '8px 10px',
              borderBottom: '1px solid rgba(54, 199, 88, 0.15)',
              background: 'rgba(54, 199, 88, 0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{ fontSize: '14px' }}>⚡</span>
              <div style={{
                fontSize: '13px',
                color: '#36C758',
                fontWeight: 'bold'
              }}>
                Active Account
              </div>
            </div>

            <div style={{ padding: '10px' }}>
              {currentAccount ? (
                <div>
                  <div style={{
                    fontSize: '14px',
                    color: colors.cyber,
                    fontWeight: 'bold',
                    marginBottom: '4px'
                  }}>
                    {currentAccount.name}
                  </div>
                  <div style={{
                    fontSize: '10px',
                    color: colors.steel,
                    wordBreak: 'break-all',
                    padding: '2px 0'
                  }}>
                    {currentAccount.stxAddress}
                  </div>
                </div>
              ) : (
                <div style={{
                  fontSize: '14px',
                  color: colors.steel,
                  textAlign: 'center',
                  padding: '6px'
                }}>
                  No active account selected
                </div>
              )}
            </div>
          </div>

          {/* Refresh wallet button */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginBottom: '8px',
            marginTop: '-8px'
          }}>
            <motion.button
              onClick={refreshWalletState}
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
              Refresh Wallet
            </motion.button>
          </div>

          {/* Seed phrases section */}
          <div>
            <div style={{
              fontSize: '14px',
              color: colors.cyber,
              fontWeight: 'bold',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{ fontSize: '16px' }}>🗝️</span> Seed Phrases ({seedPhrases.length})
            </div>

            <div style={{
              maxHeight: '200px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              {seedPhrases.map(phrase => {
                // Find accounts associated with this seed phrase
                const phraseAccounts = accounts.filter(acc => acc.seedPhraseId === phrase.id);

                return (
                  <div
                    key={phrase.id}
                    style={{
                      border: '1px solid rgba(125, 249, 255, 0.3)',
                      borderRadius: '6px',
                      background: 'rgba(1, 4, 9, 0.4)',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Seed Phrase Header */}
                    <div style={{
                      padding: '8px 10px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: phraseAccounts.length > 0 ? '1px solid rgba(125, 249, 255, 0.15)' : 'none',
                      background: 'rgba(125, 249, 255, 0.05)'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span style={{ fontSize: '14px' }}>🔑</span>
                        <div style={{
                          fontSize: '13px',
                          color: colors.cyber,
                          fontWeight: 'bold'
                        }}>
                          {phrase.name}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <motion.button
                          onClick={() => {
                            setSelectedSeedPhraseId(phrase.id);
                            setIsCreatingAccount(true);
                          }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          style={{
                            background: 'rgba(125, 249, 255, 0.1)',
                            border: '1px solid rgba(125, 249, 255, 0.3)',
                            borderRadius: '4px',
                            color: colors.cyber,
                            cursor: 'pointer',
                            fontSize: '10px',
                            padding: '3px 6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          <span style={{ fontSize: '10px' }}>+</span> Account
                        </motion.button>

                        <motion.button
                          onClick={() => handleDeleteSeedPhrase(phrase.id)}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          style={{
                            background: 'rgba(255, 78, 78, 0.1)',
                            border: '1px solid rgba(255, 78, 78, 0.3)',
                            borderRadius: '4px',
                            color: '#FF4E4E',
                            cursor: 'pointer',
                            fontSize: '10px',
                            padding: '3px 6px'
                          }}
                        >
                          Delete
                        </motion.button>
                      </div>
                    </div>

                    {/* Associated Accounts List */}
                    {phraseAccounts.length > 0 && (
                      <div style={{
                        padding: '6px 8px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}>
                        {phraseAccounts.map(account => (
                          <div
                            key={account.id}
                            style={{
                              padding: '6px 8px',
                              marginLeft: '0px', // Indentation to show hierarchy
                              border: `1px solid ${account.isActive ? 'rgba(54, 199, 88, 0.4)' : 'rgba(125, 249, 255, 0.15)'}`,
                              borderRadius: '4px',
                              background: account.isActive ? 'rgba(54, 199, 88, 0.05)' : 'rgba(1, 4, 9, 0.2)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                          >
                            <div>
                              <div style={{
                                fontSize: '12px',
                                color: account.isActive ? '#36C758' : colors.cyber,
                                fontWeight: account.isActive ? 'bold' : 'normal',
                                marginBottom: '2px'
                              }}>
                                {account.name}
                              </div>
                              <div style={{
                                fontSize: '10px',
                                color: colors.steel,
                                maxWidth: '280px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {account.stxAddress}
                              </div>
                            </div>

                            <div style={{ display: 'flex', gap: '4px' }}>
                              {!account.isActive && (
                                <motion.button
                                  onClick={() => handleActivateAccount(account.id)}
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  style={{
                                    background: 'rgba(54, 199, 88, 0.1)',
                                    border: '1px solid rgba(54, 199, 88, 0.3)',
                                    borderRadius: '4px',
                                    color: '#36C758',
                                    cursor: 'pointer',
                                    fontSize: '10px',
                                    padding: '2px 5px'
                                  }}
                                >
                                  Use
                                </motion.button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Empty State for No Accounts */}
                    {phraseAccounts.length === 0 && (
                      <div style={{
                        padding: '8px',
                        fontSize: '11px',
                        color: colors.steel,
                        textAlign: 'center',
                        fontStyle: 'italic'
                      }}>
                        No accounts yet. Create an account from this seed phrase.
                      </div>
                    )}
                  </div>
                );
              })}

              {seedPhrases.length === 0 && (
                <div style={{
                  padding: '12px 8px',
                  fontSize: '12px',
                  color: colors.steel,
                  textAlign: 'center',
                  border: '1px dashed rgba(125, 249, 255, 0.2)',
                  borderRadius: '4px',
                }}>
                  No seed phrases yet. Create or import one.
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{
            display: 'flex',
            gap: '8px',
            marginTop: '8px'
          }}>
            <motion.button
              onClick={() => {
                setIsImportingPhrase(false);
                setIsCreatingSeedPhrase(true);
              }}
              whileHover={{ scale: 1.02, boxShadow: '0 0 8px rgba(125, 249, 255, 0.4)' }}
              whileTap={{ scale: 0.98 }}
              style={{
                flex: 1,
                padding: '8px 10px',
                background: 'rgba(125, 249, 255, 0.1)',
                border: '1px solid rgba(125, 249, 255, 0.4)',
                borderRadius: '4px',
                color: colors.cyber,
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold',
                textAlign: 'center'
              }}
            >
              New Seed Phrase
            </motion.button>

            <motion.button
              onClick={() => setIsImportingPhrase(true)}
              whileHover={{ scale: 1.02, boxShadow: '0 0 8px rgba(125, 249, 255, 0.4)' }}
              whileTap={{ scale: 0.98 }}
              style={{
                flex: 1,
                padding: '8px 10px',
                background: 'rgba(125, 249, 255, 0.1)',
                border: '1px solid rgba(125, 249, 255, 0.4)',
                borderRadius: '4px',
                color: colors.cyber,
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold',
                textAlign: 'center'
              }}
            >
              Import Seed Phrase
            </motion.button>
          </div>

          {/* Export, Sign out and Reset wallet buttons */}
          <div style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'center',
            marginTop: '8px'
          }}>
            <motion.button
              onClick={() => saveEncryptedWalletBackup()}
              whileHover={{ scale: 1.02, boxShadow: '0 0 8px rgba(54, 199, 88, 0.4)' }}
              whileTap={{ scale: 0.98 }}
              style={{
                padding: '6px 10px',
                background: 'rgba(54, 199, 88, 0.1)',
                border: '1px solid rgba(54, 199, 88, 0.4)',
                borderRadius: '4px',
                color: '#36C758',
                cursor: 'pointer',
                fontSize: '10px'
              }}
            >
              Export Backup
            </motion.button>

            <motion.button
              onClick={handleSignOut}
              whileHover={{ scale: 1.02, boxShadow: '0 0 8px rgba(125, 249, 255, 0.4)' }}
              whileTap={{ scale: 0.98 }}
              style={{
                padding: '6px 10px',
                background: 'rgba(125, 249, 255, 0.1)',
                border: '1px solid rgba(125, 249, 255, 0.4)',
                borderRadius: '4px',
                color: colors.cyber,
                cursor: 'pointer',
                fontSize: '10px'
              }}
            >
              Lock
            </motion.button>

            <motion.button
              onClick={handleResetWallet}
              whileHover={{ scale: 1.02, boxShadow: '0 0 8px rgba(255, 78, 78, 0.4)' }}
              whileTap={{ scale: 0.98 }}
              style={{
                padding: '6px 10px',
                background: 'rgba(255, 78, 78, 0.05)',
                border: '1px solid rgba(255, 78, 78, 0.3)',
                borderRadius: '4px',
                color: '#FF4E4E',
                cursor: 'pointer',
                fontSize: '10px'
              }}
            >
              Delete Wallet
            </motion.button>
          </div>
        </div>
      )}
    </div>
  );
}