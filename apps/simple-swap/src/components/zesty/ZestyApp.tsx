'use client';

import React, { useState } from 'react';
import { ZESTY_TOKENS } from '@/lib/zesty/config';
import { exitsFor, planFunding, toUsd, type Side } from '@/lib/zesty/plan';
import { cancelOrders, convertedAmount, placeZestyOrder, runNow } from '@/lib/zesty/orders';
import { addToZesty, waitForConfirmation } from '@/lib/zesty/subnet';
import { MoneyHeader, type ZestyView } from './MoneyHeader';
import { useZestyMoney, formatUsd, formatPrice } from './use-zesty-money';
import { useZestyTrade } from './use-zesty-trade';
import { PickSide } from './screens/PickSide';
import { HowMuch } from './screens/HowMuch';
import { SetIt, SAFETY_PCT, TARGET_CHOICES } from './screens/SetIt';
import { Approve, type ApprovalStep } from './screens/Approve';
import { Watch } from './screens/Watch';
import { Done } from './screens/Done';
import { Trades } from './screens/Trades';
import { BigButton } from './ui';

type Screen = 'side' | 'amount' | 'set' | 'approve';

export function ZestyApp() {
  const money = useZestyMoney();
  const { trade, trades, reload } = useZestyTrade(money.address);
  const [view, setView] = useState<ZestyView>('trade');
  const [screen, setScreen] = useState<Screen>('side');
  const [side, setSide] = useState<Side>('up');
  const [amountUsd, setAmountUsd] = useState(0);
  const [targetPct, setTargetPct] = useState(TARGET_CHOICES[1]);
  const [safetyOn, setSafetyOn] = useState(true);
  const [steps, setSteps] = useState<ApprovalStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [seenTrade, setSeenTrade] = useState<string | null>(null);

  const tradeActive = trade?.state === 'converting' || trade?.state === 'waiting';
  const tradeFinished = trade && !tradeActive && trade.strategyId !== seenTrade;

  const setStatus = (id: string, status: ApprovalStep['status']) =>
    setSteps(current => current.map(step => (step.id === id ? { ...step, status } : step)));

  /** Run every wallet step for the trade, in order: add money, convert now, target, safety net. */
  const startTrade = async () => {
    if (!money.holdings || !money.zestPrice) return;
    setError(null);
    const plan = planFunding(side, amountUsd, money.holdings);
    const exits = exitsFor(side, money.zestPrice, targetPct, safetyOn ? SAFETY_PCT : null);
    const up = side === 'up';
    const plan_steps: ApprovalStep[] = [
      ...plan.adds.map(add => ({
        id: `add-${add.token}`,
        label: `Add ${formatUsd(toUsd(add.token, add.micro, money.holdings![add.token].price))} from your wallet`,
        kind: 'wallet-call' as const,
        status: 'todo' as const,
      })),
      ...(plan.convertMicro > 0n ? [{ id: 'convert', label: up ? 'Buy ZEST now' : 'Sell ZEST now', kind: 'signature' as const, status: 'todo' as const }] : []),
      { id: 'target', label: `${up ? 'Sell' : 'Buy ZEST'} at ${formatPrice(exits.target.price)}`, kind: 'signature', status: 'todo' },
      ...(exits.safety ? [{ id: 'safety', label: `Safety net at ${formatPrice(exits.safety.price)}`, kind: 'signature' as const, status: 'todo' as const }] : []),
    ];
    setSteps(plan_steps);
    setScreen('approve');

    const strategyId = crypto.randomUUID();
    const common = { wallet: money.address, side, strategyId, entryPrice: money.zestPrice, amountUsd };
    try {
      for (const add of plan.adds) {
        setStatus(`add-${add.token}`, 'active');
        const txid = await addToZesty(money.address, ZESTY_TOKENS[add.token], add.micro);
        setStatus(`add-${add.token}`, 'confirming');
        await waitForConfirmation(txid);
        setStatus(`add-${add.token}`, 'done');
      }
      let exitMicro = plan.heldMicro;
      if (plan.convertMicro > 0n) {
        setStatus('convert', 'active');
        exitMicro += await convertedAmount(plan.other, plan.held, plan.convertMicro);
        await placeZestyOrder({ ...common, role: 'convert', from: plan.other, to: plan.held, micro: plan.convertMicro });
        setStatus('convert', 'done');
      }
      setStatus('target', 'active');
      await placeZestyOrder({ ...common, role: 'target', from: plan.held, to: plan.other, micro: exitMicro, exit: exits.target });
      setStatus('target', 'done');
      if (exits.safety) {
        setStatus('safety', 'active');
        await placeZestyOrder({ ...common, role: 'safety', from: plan.held, to: plan.other, micro: exitMicro, exit: exits.safety });
        setStatus('safety', 'done');
      }
      await money.refresh();
      reload();
      setScreen('side');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const act = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const openOrders = () => [trade?.convert, trade?.target, trade?.safety].filter(o => o?.status === 'open').map(o => o!);
  const cancelTrade = () => act(() => cancelOrders(openOrders()));
  const finishNow = () => act(async () => { if (trade?.target) await runNow(trade.target); });

  const body = () => {
    if (!money.connected) {
      return (
        <>
          <PickSide zestPrice={money.zestPrice} onPick={() => money.connectWallet()} />
          <BigButton onClick={money.connectWallet}>Connect wallet to start</BigButton>
        </>
      );
    }
    if (view === 'trades') return <Trades trades={trades} money={money} onChange={reload} />;
    if (screen === 'approve') return <Approve steps={steps} error={error} onRetry={startTrade} />;
    if (trade && tradeActive) {
      return <Watch trade={trade} zestPrice={money.zestPrice} busy={busy} error={error} onSellNow={finishNow} onCancel={cancelTrade} />;
    }
    if (trade && tradeFinished) {
      return <Done trade={trade} zestyUsd={money.zestyUsd} onAgain={() => { setSeenTrade(trade.strategyId); setScreen('side'); }} />;
    }
    if (screen === 'amount') {
      return <HowMuch side={side} money={money} amountUsd={amountUsd} setAmountUsd={setAmountUsd} onNext={() => setScreen('set')} onBack={() => setScreen('side')} />;
    }
    if (screen === 'set' && money.zestPrice && money.holdings) {
      const converts = planFunding(side, amountUsd, money.holdings).convertMicro > 0n;
      return (
        <SetIt
          side={side} amountUsd={amountUsd} zestPrice={money.zestPrice} converts={converts}
          targetPct={targetPct} setTargetPct={setTargetPct} safetyOn={safetyOn} setSafetyOn={setSafetyOn}
          onStart={startTrade} onBack={() => setScreen('amount')}
        />
      );
    }
    return <PickSide zestPrice={money.zestPrice} onPick={picked => { setSide(picked); setScreen('amount'); }} />;
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-[480px] flex-col bg-[#F7F7F7]">
      <MoneyHeader money={money} tradeActive={!!tradeActive} view={view} setView={setView} />
      <main className="flex flex-1 flex-col gap-5 px-6 py-7">{body()}</main>
    </div>
  );
}
