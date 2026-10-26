/**
 * WalletTab - lock and unlock, seed phrases, accounts, and the vault's settings.
 */
import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Copy } from 'lucide-react';
import { useSignetContext } from '~shared/context/SignetContext';
import { saveEncryptedWalletBackup, sendMessage } from '~shared/context/utils';
import { asError } from '~shared/errors';
import { LANGUAGES, pickLanguage, readLanguage, t, type LanguageChoice } from '~shared/i18n';
import { normalizeSeedWords } from '~shared/seed-words';
import { applyTheme, readTheme, type ThemeChoice } from '~shared/styles/theme';
import { BlazeFlame, Card, ErrorText, Kv, short } from '~shared/ui';
import { PasswordField } from './PasswordField';

type View = 'accounts' | 'newSeed' | 'importSeed' | 'newAccount';

/** The password's minimum length, as the vault checks it (background/lib/wallet/storage.ts) */
const MIN_PASSWORD_LENGTH = 8;

/** Unlock the wallet, or create it (password typed twice) when this browser has none yet */
function UnlockView() {
  const { hasWallet, initializeWallet, refreshWalletState } = useSignetContext();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<Error | null>(null);

  const submit = async () => {
    if (!password) return;
    if (!hasWallet && password !== confirm) return setError(new Error(t('errorPasswordsDontMatch')));
    setError(null);
    try {
      await initializeWallet(password);
      setPassword('');
      setConfirm('');
      refreshWalletState();
    } catch (err) {
      setError(asError(err));
    }
  };

  return (
    <div className="w-lock">
      <div className="w-brand">
        <BlazeFlame size={72} />
        <h1>Blaze Wallet</h1>
        <p>{hasWallet ? t('unlockLocked') : t('unlockChoosePassword')}</p>
      </div>
      <Card title={hasWallet ? t('unlockTitle') : t('createWalletTitle')}>
        <div className="w-stack">
          <PasswordField
            id="password"
            label={hasWallet ? t('passwordLabel') : t('newPasswordLabel', MIN_PASSWORD_LENGTH)}
            value={password}
            onChange={setPassword}
            onEnter={submit}
            placeholder={hasWallet ? t('passwordPlaceholder') : t('newPasswordPlaceholder')}
          />
          {!hasWallet && (
            <PasswordField id="password-again" label={t('passwordAgainLabel')} value={confirm} onChange={setConfirm} onEnter={submit} placeholder={t('passwordAgainPlaceholder')} />
          )}
          <ErrorText error={error} />
          <button type="button" className="cx-btn cx-btn-primary cx-btn-block" onClick={submit} disabled={!password}>
            {hasWallet ? t('unlockButton') : t('createWalletButton')}
          </button>
        </div>
      </Card>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="cx-btn cx-btn-quiet w-btn-sm" onClick={onClick}>
      <ArrowLeft size={14} aria-hidden /> {t('back')}
    </button>
  );
}

/** Import an existing seed phrase */
function ImportSeed({ onDone, onBack }: { onDone: (seedPhraseId: string) => void; onBack: () => void }) {
  const { importSeedPhrase } = useSignetContext();
  const [name, setName] = useState('');
  const [phrase, setPhrase] = useState('');
  const [error, setError] = useState<Error | null>(null);

  const submit = async () => {
    setError(null);
    try {
      const saved = await importSeedPhrase(name, phrase.trim());
      if (!saved) throw new Error(t('errorSeedNotSaved'));
      onDone(saved.id);
    } catch (err) {
      setError(asError(err));
    }
  };

  return (
    <Card title={t('importTitle')} right={<BackButton onClick={onBack} />}>
      <div className="w-stack">
        <label className="w-field" htmlFor="import-name">
          <span>{t('name')}</span>
          <input id="import-name" className="w-input" placeholder={t('seedNamePlaceholder')} value={name} onChange={e => setName(e.target.value)} />
        </label>
        <label className="w-field" htmlFor="import-words">
          <span>{t('importWordsLabel')}</span>
          <textarea id="import-words" className="w-input w-mono" rows={4} placeholder={t('importWordsPlaceholder')} value={phrase} onChange={e => setPhrase(e.target.value)} spellCheck={false} />
        </label>
        <ErrorText error={error} />
        <button type="button" className="cx-btn cx-btn-primary cx-btn-block" onClick={submit} disabled={!name || !phrase.trim()}>{t('import')}</button>
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
  const [error, setError] = useState<Error | null>(null);

  const generate = async () => {
    setError(null);
    try {
      const phrase = await sendMessage<string>('generateSeedWords');
      const list = phrase.split(' ');
      setWords(list);
      setChecks(pickChecks(list.length));
      setStep('words');
    } catch (err) {
      setError(asError(err));
    }
  };

  const confirmAndSave = async () => {
    setError(null);
    // The same cleanup as importing: a Turkish İ or full-width letters still match
    const wrong = checks.filter(position => normalizeSeedWords(answers[position] ?? '') !== words[position - 1]);
    if (wrong.length) return setError(new Error(t('errorWordsDontMatch', wrong.map(position => `#${position}`).join(', '))));
    try {
      const saved = await importSeedPhrase(name, words.join(' '));
      if (!saved) throw new Error(t('errorSeedNotSaved'));
      onDone(saved.id);
    } catch (err) {
      setError(asError(err));
    }
  };

  if (step === 'name') {
    return (
      <Card title={t('newSeedTitle')} right={<BackButton onClick={onBack} />}>
        <div className="w-stack">
          <label className="w-field" htmlFor="seed-name">
            <span>{t('name')}</span>
            <input id="seed-name" className="w-input" placeholder={t('seedNamePlaceholder')} value={name} onChange={e => setName(e.target.value)} />
          </label>
          <ErrorText error={error} />
          <button type="button" className="cx-btn cx-btn-primary cx-btn-block" onClick={generate} disabled={!name}>{t('generateWords')}</button>
        </div>
      </Card>
    );
  }

  if (step === 'words') {
    return (
      <Card title={t('writeDownTitle')} right={<BackButton onClick={onBack} />}>
        <div className="w-stack">
          <p className="w-warning">{t('writeDownWarning')}</p>
          <div className="w-words">
            {words.map((word, i) => (
              <div key={i} className="w-word"><i>{i + 1}</i><span>{word}</span></div>
            ))}
          </div>
          <label className="w-check">
            <input type="checkbox" checked={wroteDown} onChange={e => setWroteDown(e.target.checked)} />
            {t('wroteDown')}
          </label>
          <button type="button" className="cx-btn cx-btn-primary cx-btn-block" onClick={() => setStep('confirm')} disabled={!wroteDown}>{t('continue')}</button>
        </div>
      </Card>
    );
  }

  return (
    <Card title={t('confirmTitle')} right={<BackButton onClick={() => setStep('words')} />}>
      <div className="w-stack">
        <p className="w-note">{t('confirmNote')}</p>
        {checks.map(position => (
          <label key={position} className="w-field" htmlFor={`word-${position}`}>
            <span>{t('wordNumber', position)}</span>
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
          {t('confirmAndSave')}
        </button>
      </div>
    </Card>
  );
}

/** Derive the next account from a seed phrase */
function NewAccount({ seedPhraseId, onDone, onBack }: { seedPhraseId: string; onDone: () => void; onBack: () => void }) {
  const { createAccount, refreshWalletState } = useSignetContext();
  const [error, setError] = useState<Error | null>(null);

  const submit = async () => {
    setError(null);
    try {
      await createAccount(seedPhraseId, true);
      await refreshWalletState();
      onDone();
    } catch (err) {
      setError(asError(err));
    }
  };

  return (
    <Card title={t('newAccountTitle')} right={<BackButton onClick={onBack} />}>
      <div className="w-stack">
        <p className="w-note">{t('newAccountNote')}</p>
        <ErrorText error={error} />
        <button type="button" className="cx-btn cx-btn-primary cx-btn-block" onClick={submit}>{t('createAccount')}</button>
      </div>
    </Card>
  );
}

const THEMES: { choice: ThemeChoice; label: string; title: string }[] = [
  { choice: 'system', label: 'themeSystem', title: 'themeSystemTitle' },
  { choice: 'light', label: 'themeLight', title: 'themeLightTitle' },
  { choice: 'dark', label: 'themeDark', title: 'themeDarkTitle' },
];

/** The theme for every wallet page and approval card: follow the device, Light · Bitcoin or Dark · RPG */
function ThemePicker() {
  const [current, setCurrent] = useState<ThemeChoice>(readTheme);
  const pick = (choice: ThemeChoice) => { applyTheme(choice); setCurrent(choice); };
  return (
    <div className="cx-kv w-kv-text">
      <span>{t('themeLabel')}</span>
      <div className="cx-segment" role="group" aria-label={t('themeLabel')}>
        {THEMES.map(({ choice, label, title }) => (
          <button key={choice} type="button" aria-pressed={current === choice} title={t(title)} onClick={() => pick(choice)}>{t(label)}</button>
        ))}
      </div>
    </div>
  );
}

/** The language for every wallet page and approval card: Chrome's (Automatic), or one picked here. Reloads. */
function LanguagePicker() {
  return (
    <label className="cx-kv w-kv-text" htmlFor="language">
      <span>{t('languageLabel')}</span>
      <select id="language" className="w-input" value={readLanguage()} onChange={e => pickLanguage(e.target.value as LanguageChoice)}>
        <option value="auto">{t('languageAutomatic')}</option>
        {LANGUAGES.map(({ folder, name }) => <option key={folder} value={folder} lang={folder.replace('_', '-')}>{name}</option>)}
      </select>
    </label>
  );
}

/** Copy the address, and say so for a moment */
export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard.writeText(text).then(() => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  });
  return (
    <button type="button" className="cx-btn w-btn-sm" onClick={copy}>
      {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />} {copied ? t('copied') : t('copy')}
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
    refreshWalletState,
    endSession,
  } = useSignetContext();
  const [view, setView] = useState<View>('accounts');
  const [seedPhraseId, setSeedPhraseId] = useState('');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (isWalletInitialized) refreshWalletState();
  }, [isWalletInitialized]);

  /** Run a wallet action, showing its error instead of losing it */
  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(asError(err));
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
        <Card title={t('accountName', currentAccount.index + 1)} right={<span className="cx-pill cx-pill-success">{t('active')}</span>}>
          <div className="w-row" style={{ paddingTop: 0 }}>
            <span className="w-address" style={{ flex: 1 }}>{currentAccount.stxAddress}</span>
            <CopyButton text={currentAccount.stxAddress} />
          </div>
        </Card>
      ) : (
        <Card title={t('noActiveAccount')}>
          <p className="w-warning">{t('addAccountHint')}</p>
        </Card>
      )}

      <Card title={t('seedPhrasesTitle')} right={<span className="cx-pill cx-pill-plain">{seedPhrases.length}</span>}>
        <div className="w-stack">
          {seedPhrases.length === 0 && <p className="w-note">{t('noSeedPhrases')}</p>}
          {seedPhrases.map(phrase => {
            const phraseAccounts = accounts.filter(account => account.seedPhraseId === phrase.id);
            return (
              <div key={phrase.id} className="cx-pane">
                <div className="w-card-head">
                  <h2>{phrase.name}</h2>
                  <span className="w-actions" style={{ flex: 'none' }}>
                    <button type="button" className="cx-btn w-btn-sm" onClick={() => newAccountFor(phrase.id)}>{t('addAccount')}</button>
                    <button
                      type="button"
                      className="cx-btn w-btn-sm w-btn-danger"
                      onClick={() => confirm(t('confirmUnlinkSeed'))
                        && run(async () => { await deleteSeedPhrase(phrase.id); await refreshWalletState(); })}
                    >
                      {t('unlink')}
                    </button>
                  </span>
                </div>
                {phraseAccounts.map(account => (
                  <div key={account.id} className="w-row">
                    <div className="w-row-main">
                      <strong>{t('accountName', account.index + 1)}</strong>
                      <span className="w-mono">{short(account.stxAddress)}</span>
                    </div>
                    {account.isActive
                      ? <span className="cx-pill cx-pill-success">{t('active')}</span>
                      : <button type="button" className="cx-btn w-btn-sm" onClick={() => run(async () => { await activateAccount(account.id); await refreshWalletState(); })}>{t('use')}</button>}
                  </div>
                ))}
              </div>
            );
          })}
          <div className="w-actions">
            <button type="button" className="cx-btn" onClick={() => setView('newSeed')}>{t('generateNew')}</button>
            <button type="button" className="cx-btn" onClick={() => setView('importSeed')}>{t('import')}</button>
          </div>
        </div>
      </Card>

      <Card title={t('vaultTitle')}>
        <Kv label={t('vaultKeys')} text>{t('vaultKeysValue')}</Kv>
        <Kv label={t('vaultAutoLock')} text>{t('vaultAutoLockValue')}</Kv>
        <ThemePicker />
        <LanguagePicker />
        <div className="w-stack" style={{ marginTop: '12px' }}>
          <ErrorText error={error} />
          <div className="w-actions">
            <button type="button" className="cx-btn" onClick={() => run(saveEncryptedWalletBackup)}>{t('exportButton')}</button>
            <button type="button" className="cx-btn" onClick={() => run(endSession)}>{t('lock')}</button>
          </div>
        </div>
      </Card>
    </div>
  );
}
