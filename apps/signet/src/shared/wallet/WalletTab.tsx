/**
 * WalletTab - lock and unlock, seed phrases, accounts, and the vault's settings.
 */
import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Copy } from 'lucide-react';
import { useSignetContext } from '~shared/context/SignetContext';
import { saveEncryptedWalletBackup, sendMessage } from '~shared/context/utils';
import { applyTheme, readTheme, type ThemeChoice } from '~shared/styles/theme';
import { BlazeFlame, Card, ErrorText, Kv, short } from '~shared/ui';
import { PasswordField } from './PasswordField';

type View = 'accounts' | 'newSeed' | 'importSeed' | 'newAccount';

/** "Account 1 (SP9S3...3V3M)" → "Account 1" */
const accountLabel = (name: string) => name.split(' (')[0];

/** Unlock the wallet, or create it (password typed twice) when this browser has none yet */
function UnlockView() {
  const { hasWallet, initializeWallet, refreshWalletState } = useSignetContext();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
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
    <div className="w-lock">
      <div className="w-brand">
        <BlazeFlame size={72} />
        <h1>Blaze Wallet</h1>
        <p>{hasWallet ? 'Locked. Enter your password to continue.' : 'Choose a password to protect this wallet.'}</p>
      </div>
      <Card title={hasWallet ? 'Unlock' : 'Create your wallet'}>
        <div className="w-stack">
          <PasswordField
            id="password"
            label={hasWallet ? 'Password' : 'New password (8 or more characters)'}
            value={password}
            onChange={setPassword}
            onEnter={submit}
            placeholder={hasWallet ? 'Your password' : 'A strong password'}
          />
          {!hasWallet && (
            <PasswordField id="password-again" label="Type it again" value={confirm} onChange={setConfirm} onEnter={submit} placeholder="The same password" />
          )}
          <ErrorText error={error} />
          <button type="button" className="cx-btn cx-btn-primary cx-btn-block" onClick={submit} disabled={!password}>
            {hasWallet ? 'Unlock' : 'Create wallet'}
          </button>
        </div>
      </Card>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="cx-btn cx-btn-quiet w-btn-sm" onClick={onClick}>
      <ArrowLeft size={14} aria-hidden /> Back
    </button>
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
    <Card title="Import a seed phrase" right={<BackButton onClick={onBack} />}>
      <div className="w-stack">
        <label className="w-field" htmlFor="import-name">
          <span>Name</span>
          <input id="import-name" className="w-input" placeholder="My seed phrase" value={name} onChange={e => setName(e.target.value)} />
        </label>
        <label className="w-field" htmlFor="import-words">
          <span>12 or 24 words</span>
          <textarea id="import-words" className="w-input w-mono" rows={4} placeholder="word word word …" value={phrase} onChange={e => setPhrase(e.target.value)} spellCheck={false} />
        </label>
        <ErrorText error={error} />
        <button type="button" className="cx-btn cx-btn-primary cx-btn-block" onClick={submit} disabled={!name || !phrase.trim()}>Import</button>
      </div>
    </Card>
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
      <Card title="New seed phrase" right={<BackButton onClick={onBack} />}>
        <div className="w-stack">
          <label className="w-field" htmlFor="seed-name">
            <span>Name</span>
            <input id="seed-name" className="w-input" placeholder="My seed phrase" value={name} onChange={e => setName(e.target.value)} />
          </label>
          <ErrorText error={error} />
          <button type="button" className="cx-btn cx-btn-primary cx-btn-block" onClick={generate} disabled={!name}>Generate 24 words</button>
        </div>
      </Card>
    );
  }

  if (step === 'words') {
    return (
      <Card title="Write these down" right={<BackButton onClick={onBack} />}>
        <div className="w-stack">
          <p className="w-warning">These 24 words are the only way to recover this wallet. Anyone who sees them controls your funds, and Blaze Wallet can't recover them.</p>
          <div className="w-words">
            {words.map((word, i) => (
              <div key={i} className="w-word"><i>{i + 1}</i><span>{word}</span></div>
            ))}
          </div>
          <label className="w-check">
            <input type="checkbox" checked={wroteDown} onChange={e => setWroteDown(e.target.checked)} />
            I wrote all 24 words down, in order
          </label>
          <button type="button" className="cx-btn cx-btn-primary cx-btn-block" onClick={() => setStep('confirm')} disabled={!wroteDown}>Continue</button>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Confirm your words" right={<BackButton onClick={() => setStep('words')} />}>
      <div className="w-stack">
        <p className="w-note">Type these words from what you wrote down.</p>
        {checks.map(position => (
          <label key={position} className="w-field" htmlFor={`word-${position}`}>
            <span>Word #{position}</span>
            <input
              id={`word-${position}`}
              className="w-input w-mono"
              value={answers[position] ?? ''}
              onChange={e => setAnswers(current => ({ ...current, [position]: e.target.value }))}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        ))}
        <ErrorText error={error} />
        <button type="button" className="cx-btn cx-btn-primary cx-btn-block" onClick={confirmAndSave} disabled={checks.some(position => !answers[position]?.trim())}>
          Confirm and save
        </button>
      </div>
    </Card>
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
    <Card title="New account" right={<BackButton onClick={onBack} />}>
      <div className="w-stack">
        <p className="w-note">The next address from this seed phrase becomes your active account.</p>
        <ErrorText error={error} />
        <button type="button" className="cx-btn cx-btn-primary cx-btn-block" onClick={submit}>Create account</button>
      </div>
    </Card>
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
    <div className="cx-kv w-kv-text">
      <span>Theme</span>
      <div className="cx-segment" role="group" aria-label="Theme">
        {THEMES.map(({ choice, label, title }) => (
          <button key={choice} type="button" aria-pressed={current === choice} title={title} onClick={() => pick(choice)}>{label}</button>
        ))}
      </div>
    </div>
  );
}

/** Copy the address, and say so for a moment */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard.writeText(text).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  });
  return (
    <button type="button" className="cx-btn w-btn-sm" onClick={copy}>
      {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />} {copied ? 'Copied' : 'Copy'}
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

  if (!isWalletInitialized) return <UnlockView />;

  const back = () => setView('accounts');

  if (view === 'newSeed') return <div className="w-page"><NewSeed onDone={newAccountFor} onBack={back} /></div>;
  if (view === 'importSeed') return <div className="w-page"><ImportSeed onDone={newAccountFor} onBack={back} /></div>;
  if (view === 'newAccount') return <div className="w-page"><NewAccount seedPhraseId={seedPhraseId} onDone={back} onBack={back} /></div>;

  return (
    <div className="w-page">
      {currentAccount ? (
        <Card title={accountLabel(currentAccount.name)} right={<span className="cx-pill cx-pill-success">Active</span>}>
          <div className="w-row" style={{ paddingTop: 0 }}>
            <span className="w-address" style={{ flex: 1 }}>{currentAccount.stxAddress}</span>
            <CopyButton text={currentAccount.stxAddress} />
          </div>
        </Card>
      ) : (
        <Card title="No active account">
          <p className="w-warning">Add an account from a seed phrase below.</p>
        </Card>
      )}

      <Card title="Seed phrases" right={<span className="cx-pill cx-pill-plain">{seedPhrases.length}</span>}>
        <div className="w-stack">
          {seedPhrases.length === 0 && <p className="w-note">None yet. Generate a new one or import yours.</p>}
          {seedPhrases.map(phrase => {
            const phraseAccounts = accounts.filter(account => account.seedPhraseId === phrase.id);
            return (
              <div key={phrase.id} className="cx-pane">
                <div className="w-card-head">
                  <h2>{phrase.name}</h2>
                  <span className="w-actions" style={{ flex: 'none' }}>
                    <button type="button" className="cx-btn w-btn-sm" onClick={() => newAccountFor(phrase.id)}>+ Account</button>
                    <button
                      type="button"
                      className="cx-btn w-btn-sm w-btn-danger"
                      onClick={() => confirm('Unlink this seed phrase from this browser?\n\nIts accounts and funds stay safe on the blockchain. To use them here again, you will need the seed phrase words.')
                        && run(async () => { await deleteSeedPhrase(phrase.id); await refreshWalletState(); })}
                    >
                      Unlink
                    </button>
                  </span>
                </div>
                {phraseAccounts.map(account => (
                  <div key={account.id} className="w-row">
                    <div className="w-row-main">
                      <strong>{accountLabel(account.name)}</strong>
                      <span className="w-mono">{short(account.stxAddress)}</span>
                    </div>
                    {account.isActive
                      ? <span className="cx-pill cx-pill-success">Active</span>
                      : <button type="button" className="cx-btn w-btn-sm" onClick={() => run(async () => { await activateAccount(account.id); await refreshWalletState(); })}>Use</button>}
                  </div>
                ))}
              </div>
            );
          })}
          <div className="w-actions">
            <button type="button" className="cx-btn" onClick={() => setView('newSeed')}>Generate new</button>
            <button type="button" className="cx-btn" onClick={() => setView('importSeed')}>Import</button>
          </div>
        </div>
      </Card>

      <Card title="Vault">
        <Kv label="Keys" text>Encrypted, on this device only</Kv>
        <Kv label="Auto-lock" text>After 15 idle minutes</Kv>
        <ThemePicker />
        <div className="w-stack" style={{ marginTop: '12px' }}>
          <ErrorText error={error} />
          <div className="w-actions">
            <button type="button" className="cx-btn" onClick={() => run(saveEncryptedWalletBackup)}>Export</button>
            <button type="button" className="cx-btn" onClick={() => run(endSession)}>Lock</button>
            <button
              type="button"
              className="cx-btn w-btn-danger"
              onClick={() => confirm('Unlink this wallet from this browser?\n\nEvery seed phrase and account is removed from this device. Your funds stay safe on the blockchain; you will need your seed phrase to get back in.')
                && run(async () => { await resetWallet(); await refreshWalletState(); })}
            >
              Unlink
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
