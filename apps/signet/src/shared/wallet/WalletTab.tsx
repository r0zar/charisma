/**
 * WalletTab - lock and unlock, seed phrases, accounts. HUD styled to match Diagnostics.
 */
import { useEffect, useState } from 'react';
import { useSignetContext } from '~shared/context/SignetContext';
import { saveEncryptedWalletBackup, sendMessage } from '~shared/context/utils';
import { applyTheme, colors, readTheme, type ThemeChoice } from '~shared/styles/theme';
import { HudButton, HudLabel, HudLine, HudPanel, HudScreen, HudStat } from '~shared/hud';
import { PasswordField } from './PasswordField';

type View = 'accounts' | 'newSeed' | 'importSeed' | 'newAccount';

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-6)}`;
/** "Account 1 (SP9S3...3V3M)" → "ACCOUNT 1" */
const accountLabel = (name: string) => name.split(' (')[0].toUpperCase();

function ErrorLine({ error }: { error: string | null }) {
  return error ? <div role="alert"><HudLine tone="red">{error}</HudLine></div> : null;
}

/** Unlock the wallet, or create it (password typed twice) when this browser has none yet */
function UnlockView() {
  const { hasWallet, initializeWallet, refreshWalletState } = useSignetContext();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e?: { preventDefault?: () => void }) => {
    e?.preventDefault?.();
    if (!password) return;
    if (!hasWallet && password !== confirm) return setError("Passwords don't match");
    setError(null);
    try {
      await initializeWallet(password);
      setPassword('');
      setConfirm('');
      refreshWalletState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unlock the wallet');
    }
  };

  return (
    <HudScreen title="BLAZE VAULT" stats={[{ label: 'STATUS', value: hasWallet ? 'LOCKED' : 'NEW', tone: 'amber' }]}>
    <HudPanel title={hasWallet ? 'UNLOCK' : 'CREATE PASSWORD'} tone={hasWallet ? 'cyan' : 'amber'}>
      <HudLabel>{hasWallet ? 'Password' : 'New password (8+ characters)'}</HudLabel>
      <PasswordField value={password} onChange={setPassword} onEnter={submit} placeholder={hasWallet ? 'Enter your password...' : 'Enter a strong password...'} label="Password" />
      {!hasWallet && (
        <>
          <HudLabel>Type it again</HudLabel>
          <PasswordField value={confirm} onChange={setConfirm} onEnter={submit} placeholder="Type it again..." label="Confirm password" />
        </>
      )}
      <ErrorLine error={error} />
      <HudButton tone={hasWallet ? 'cyan' : 'green'} onClick={() => submit()} disabled={!password} style={{ padding: '7px 8px' }}>
        {hasWallet ? 'Unlock' : 'Create wallet'}
      </HudButton>
    </HudPanel>
    </HudScreen>
  );
}

/** Import an existing seed phrase */
function ImportSeed({ onDone, onBack }: { onDone: (seedPhraseId: string) => void; onBack: () => void }) {
  const { importSeedPhrase } = useSignetContext();
  const [name, setName] = useState('');
  const [phrase, setPhrase] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      const saved = await importSeedPhrase(name, phrase.trim());
      if (!saved) throw new Error('The seed phrase was not saved');
      onDone(saved.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import the seed phrase');
    }
  };

  return (
    <HudPanel title="IMPORT SEED PHRASE" right={<BackLink onClick={onBack} />} gap={8}>
      <HudLabel>Name</HudLabel>
      <input className="hud-input" placeholder="My seed phrase" value={name} onChange={e => setName(e.target.value)} aria-label="Seed phrase name" />
      <HudLabel>12 or 24 words</HudLabel>
      <textarea className="hud-input" rows={4} placeholder="word word word …" value={phrase} onChange={e => setPhrase(e.target.value)} aria-label="Seed phrase" style={{ resize: 'none' }} />
      <ErrorLine error={error} />
      <HudButton tone="green" onClick={submit} disabled={!name || !phrase.trim()}>Import</HudButton>
    </HudPanel>
  );
}

/** Three random word positions (1-based) to confirm */
const pickChecks = (count: number) => {
  const picks = new Set<number>();
  const random = new Uint32Array(8);
  while (picks.size < 3) {
    crypto.getRandomValues(random);
    random.forEach(n => picks.size < 3 && picks.add((n % count) + 1));
  }
  return [...picks].sort((a, b) => a - b);
};

/**
 * A new seed phrase: name it, write the words down, confirm three of them. Nothing is saved until confirmed,
 * so no wallet ever exists with words nobody wrote down.
 */
function NewSeed({ onDone, onBack }: { onDone: (seedPhraseId: string) => void; onBack: () => void }) {
  const { importSeedPhrase } = useSignetContext();
  const [step, setStep] = useState<'name' | 'words' | 'confirm'>('name');
  const [name, setName] = useState('');
  const [words, setWords] = useState<string[]>([]);
  const [wroteDown, setWroteDown] = useState(false);
  const [checks, setChecks] = useState<number[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setError(null);
    try {
      const phrase = await sendMessage<string>('generateSeedWords');
      const list = phrase.split(' ');
      setWords(list);
      setChecks(pickChecks(list.length));
      setStep('words');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate words');
    }
  };

  const confirmAndSave = async () => {
    setError(null);
    const wrong = checks.filter(position => (answers[position] ?? '').trim().toLowerCase() !== words[position - 1]);
    if (wrong.length) return setError(`Word #${wrong.join(', #')} doesn't match. Check what you wrote down`);
    try {
      const saved = await importSeedPhrase(name, words.join(' '));
      if (!saved) throw new Error('The seed phrase was not saved');
      onDone(saved.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the seed phrase');
    }
  };

  if (step === 'name') {
    return (
      <HudPanel title="NEW SEED PHRASE" right={<BackLink onClick={onBack} />} gap={8}>
        <HudLabel>Name</HudLabel>
        <input className="hud-input" placeholder="My seed phrase" value={name} onChange={e => setName(e.target.value)} aria-label="Seed phrase name" />
        <ErrorLine error={error} />
        <HudButton tone="green" onClick={generate} disabled={!name}>Generate 24 words</HudButton>
      </HudPanel>
    );
  }

  if (step === 'words') {
    return (
      <HudPanel title="WRITE THESE DOWN" tone="amber" right={<BackLink onClick={onBack} />} gap={8}>
        <HudLine tone="amber">These 24 words are the only way to recover this wallet</HudLine>
        <HudLine tone="amber">Anyone who sees them controls your funds. Blaze Wallet can't recover them</HudLine>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', margin: '4px 0' }}>
          {words.map((word, i) => (
            <div key={i} style={{ display: 'flex', gap: '6px', padding: '5px 6px', border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)', borderRadius: '2px', background: 'color-mix(in srgb, #000 calc(35% * var(--shade)), transparent)', fontSize: '10px' }}>
              <span style={{ color: 'color-mix(in srgb, var(--ink) 40%, transparent)', minWidth: '16px', textAlign: 'right' }}>{i + 1}</span>
              <span style={{ color: colors.ink, fontWeight: 'bold' }}>{word}</span>
            </div>
          ))}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '9px', color: 'color-mix(in srgb, var(--ink) 80%, transparent)' }}>
          <input type="checkbox" checked={wroteDown} onChange={e => setWroteDown(e.target.checked)} style={{ accentColor: 'var(--warning)' }} />
          I WROTE ALL 24 WORDS DOWN, IN ORDER
        </label>
        <HudButton tone="amber" onClick={() => setStep('confirm')} disabled={!wroteDown}>Continue</HudButton>
      </HudPanel>
    );
  }

  return (
    <HudPanel title="CONFIRM YOUR WORDS" right={<BackLink onClick={() => setStep('words')} />} gap={8}>
      <HudLine>Type these words from what you wrote down</HudLine>
      {checks.map(position => (
        <div key={position} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="hud-label" style={{ minWidth: '52px' }}>WORD #{position}</span>
          <input
            className="hud-input"
            value={answers[position] ?? ''}
            onChange={e => setAnswers(current => ({ ...current, [position]: e.target.value }))}
            aria-label={`Word ${position}`}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      ))}
      <ErrorLine error={error} />
      <HudButton tone="green" onClick={confirmAndSave} disabled={checks.some(position => !answers[position]?.trim())}>Confirm and save</HudButton>
    </HudPanel>
  );
}

/** Derive the next account from a seed phrase */
function NewAccount({ seedPhraseId, onDone, onBack }: { seedPhraseId: string; onDone: () => void; onBack: () => void }) {
  const { createAccount, refreshWalletState } = useSignetContext();
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      await createAccount(seedPhraseId, true);
      await refreshWalletState();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the account');
    }
  };

  return (
    <HudPanel title="NEW ACCOUNT" right={<BackLink onClick={onBack} />}>
      <HudLine>The next address from this seed phrase becomes your active account</HudLine>
      <ErrorLine error={error} />
      <HudButton tone="green" onClick={submit}>Create account</HudButton>
    </HudPanel>
  );
}

const THEMES: { choice: ThemeChoice; label: string; title: string }[] = [
  { choice: 'system', label: 'System', title: 'Follow this device' },
  { choice: 'light', label: 'Light', title: 'Light · Bitcoin' },
  { choice: 'dark', label: 'Dark', title: 'Dark · RPG' },
];

/** The theme for every wallet page and approval card: follow the device, Light · Bitcoin or Dark · RPG */
function ThemePicker() {
  const [current, setCurrent] = useState<ThemeChoice>(readTheme);
  const pick = (choice: ThemeChoice) => { applyTheme(choice); setCurrent(choice); };
  return (
    <HudStat
      label="THEME"
      value={
        <span style={{ display: 'inline-flex', gap: '4px' }}>
          {THEMES.map(({ choice, label, title }) => (
            <HudButton key={choice} tone={current === choice ? 'cyan' : 'steel'} aria-pressed={current === choice} title={title} onClick={() => pick(choice)}>
              {label}
            </HudButton>
          ))}
        </span>
      }
    />
  );
}

function BackLink({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '8px', fontWeight: 'bold', padding: 0 }}>
      ← BACK
    </button>
  );
}

export function WalletTab() {
  const {
    isWalletInitialized,
    currentAccount,
    accounts,
    seedPhrases,
    activateAccount,
    deleteSeedPhrase,
    resetWallet,
    refreshWalletState,
    endSession,
  } = useSignetContext();
  const [view, setView] = useState<View>('accounts');
  const [seedPhraseId, setSeedPhraseId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isWalletInitialized) refreshWalletState();
  }, [isWalletInitialized]);

  /** Run a wallet action, showing its error instead of losing it */
  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  };

  const newAccountFor = (id: string) => { setSeedPhraseId(id); setView('newAccount'); };

  if (!isWalletInitialized) {
    return <div style={{ padding: '8px' }}><UnlockView /></div>;
  }

  const back = () => setView('accounts');

  return (
    <div style={{ padding: '8px' }}>
      <HudScreen
        gap={12}
        title="WALLET"
        stats={[
          { label: 'ACCOUNTS', value: accounts.length },
          { label: 'SEEDS', value: seedPhrases.length },
          { label: 'STATUS', value: 'UNLOCKED', tone: 'green' }
        ]}
      >
        {view === 'newSeed' && <NewSeed onDone={newAccountFor} onBack={back} />}
        {view === 'importSeed' && <ImportSeed onDone={newAccountFor} onBack={back} />}
        {view === 'newAccount' && <NewAccount seedPhraseId={seedPhraseId} onDone={back} onBack={back} />}

        {view === 'accounts' && (
          <>
            <HudPanel title="ACTIVE ACCOUNT" tone={currentAccount ? 'green' : 'amber'} gap={8}>
              {currentAccount ? (
                <>
                  <HudStat label="NAME" value={accountLabel(currentAccount.name)} tone="green" />
                  <HudStat label="ADDRESS" value={short(currentAccount.stxAddress)} />
                  <div style={{ color: 'color-mix(in srgb, var(--ink) 45%, transparent)', fontSize: '8px', wordBreak: 'break-all', marginTop: '4px', paddingTop: '8px', borderTop: '1px dashed color-mix(in srgb, var(--hud-accent) 12%, transparent)' }}>{currentAccount.stxAddress}</div>
                </>
              ) : (
                <HudLine tone="amber">No active account. Add one from a seed phrase below</HudLine>
              )}
            </HudPanel>

            <HudPanel title="SEED PHRASES" right={<span>{seedPhrases.length}</span>} gap={10}>
              {seedPhrases.length === 0 && <HudLine>None yet. Generate or import one</HudLine>}
              {seedPhrases.map(phrase => {
                const phraseAccounts = accounts.filter(account => account.seedPhraseId === phrase.id);
                return (
                  <div key={phrase.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 0 8px' }}>
                      <span style={{ flex: 1, color: colors.accent, fontWeight: 'bold', fontSize: '9px' }}>⬡ {phrase.name.toUpperCase()}</span>
                      <HudButton onClick={() => newAccountFor(phrase.id)}>+ Acct</HudButton>
                      <HudButton
                        tone="red"
                        onClick={() => confirm('Unlink this seed phrase from this browser?\n\nIts accounts and funds stay safe on the blockchain. To use them here again, you will need the seed phrase words.')
                          && run(async () => { await deleteSeedPhrase(phrase.id); await refreshWalletState(); })}
                      >
                        Unlink
                      </HudButton>
                    </div>
                    {phraseAccounts.map(account => (
                      <div key={account.id} className={`hud-row${account.isActive ? ' is-active' : ''}`} style={{ padding: '9px 6px' }}>
                        <span style={{ color: account.isActive ? colors.success : colors.accent, fontWeight: 'bold', minWidth: '64px' }}>{accountLabel(account.name)}</span>
                        <span style={{ flex: 1, color: 'color-mix(in srgb, var(--ink) 55%, transparent)' }}>{short(account.stxAddress)}</span>
                        {account.isActive
                          ? <span style={{ color: colors.success, fontSize: '8px', fontWeight: 'bold' }}>● ACTIVE</span>
                          : <HudButton onClick={() => run(async () => { await activateAccount(account.id); await refreshWalletState(); })}>Use</HudButton>}
                      </div>
                    ))}
                  </div>
                );
              })}
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <HudButton grow onClick={() => setView('newSeed')}>Generate new</HudButton>
                <HudButton grow onClick={() => setView('importSeed')}>Import</HudButton>
              </div>
            </HudPanel>

            <HudPanel title="VAULT" tone="steel" pattern={false} gap={8}>
              <HudStat label="ENCRYPTION" value="AES-GCM · PBKDF2" />
              <HudStat label="AUTO-LOCK" value="15 MIN IDLE" />
              <ThemePicker />
              <ErrorLine error={error} />
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <HudButton tone="green" grow onClick={() => run(saveEncryptedWalletBackup)}>Export</HudButton>
                <HudButton grow onClick={() => run(endSession)}>Lock</HudButton>
                <HudButton
                  tone="red"
                  grow
                  onClick={() => confirm('Unlink this wallet from this browser?\n\nEvery seed phrase and account is removed from this device. Your funds stay safe on the blockchain; you will need your seed phrase to get back in.')
                    && run(async () => { await resetWallet(); await refreshWalletState(); })}
                >
                  Unlink
                </HudButton>
              </div>
            </HudPanel>
          </>
        )}
      </HudScreen>
    </div>
  );
}
