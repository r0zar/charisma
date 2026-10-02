'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/sonner';
import { getRoundAdmin, rescheduleRound, saveConfig, voidRound, type AdminRoundState } from '@/lib/admin-api';
import { AchievementAdminPanel } from '@/components/admin/AchievementAdminPanel';
import { ReferralAdminPanel } from '@/components/admin/ReferralAdminPanel';
import type { PublicBet, PublicRound } from '@/lib/roulette/types';

const MIN = 60_000;
const cha = (micro: string | number) => (Number(micro) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 2 });
const when = (ms?: number) => (ms ? new Date(ms).toLocaleString() : '—');
const short = (id: string) => (id.includes('.') ? id.split('.')[1] : `${id.slice(0, 6)}…${id.slice(-4)}`);

function RoundCard({ title, round }: { title: string; round: PublicRound | null }) {
    if (!round) return <Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>None yet</CardDescription></CardHeader></Card>;
    const total = Object.values(round.tally).reduce((s, v) => s + Number(v), 0);
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <span>{title}: {round.id}</span>
                    <span className="rounded-md bg-surface-hover px-2 py-0.5 font-mono text-xs">{round.status}</span>
                </CardTitle>
                <CardDescription className="font-mono text-xs break-all">seed hash {round.seedHash}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div><div className="text-ink-muted text-xs">Opens</div>{when(round.opensAt)}</div>
                    <div><div className="text-ink-muted text-xs">Locks</div>{when(round.locksAt)}</div>
                    <div><div className="text-ink-muted text-xs">Draw</div>{when(round.endsAt)}</div>
                    <div><div className="text-ink-muted text-xs">Pot</div>{cha(total)} CHA · {round.players} players · {round.bets} bets</div>
                </div>
                {round.draw && (
                    <div className="rounded-lg border border-line p-3 font-mono text-xs space-y-1 break-all">
                        <div>winner {round.draw.winner ?? 'none (no stake)'}</div>
                        <div>ticket {round.draw.ticket} / {round.draw.total}</div>
                        <div>block {round.draw.block.height} {round.draw.block.hash}</div>
                        <div>seed {round.seed}</div>
                        <a className="text-accent-text underline" href={`/api/rounds/${round.id}`} target="_blank" rel="noreferrer">verify record</a>
                    </div>
                )}
                {Object.keys(round.tally).length > 0 && (
                    <div className="space-y-1">
                        {Object.entries(round.tally).sort((a, b) => Number(b[1]) - Number(a[1])).map(([token, stake]) => (
                            <div key={token} className="flex justify-between font-mono text-xs">
                                <span>{short(token)}</span><span>{cha(stake)} CHA · {total ? ((Number(stake) / total) * 100).toFixed(1) : 0}%</span>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function BetsTable({ bets }: { bets: PublicBet[] }) {
    if (!bets.length) return <p className="text-sm text-ink-muted">No bets in the live round yet.</p>;
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
                <thead className="text-ink-muted"><tr><th className="text-left p-1">Player</th><th className="text-left p-1">Meme</th><th className="text-right p-1">CHA</th><th className="text-left p-1">Status</th><th className="text-left p-1">Placed</th></tr></thead>
                <tbody>
                    {bets.map(b => (
                        <tr key={b.uuid} className="border-t border-line">
                            <td className="p-1">{short(b.user)}</td><td className="p-1">{short(b.tokenId)}</td><td className="p-1 text-right">{cha(b.amount)}</td>
                            <td className="p-1">{b.status}{b.error ? ` (${b.error})` : ''}</td><td className="p-1">{when(b.placedAt)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function AdminPage() {
    const [state, setState] = useState<AdminRoundState | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [form, setForm] = useState({ roundMin: 0, lockSec: 0, intermissionSec: 0 });
    const [drawIn, setDrawIn] = useState(10);

    const load = async () => {
        try {
            const s = await getRoundAdmin();
            setState(s);
            setError(null);
            setForm({ roundMin: s.config.roundMs / MIN, lockSec: s.config.lockMs / 1000, intermissionSec: s.config.intermissionMs / 1000 });
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
        }
    };
    useEffect(() => { load(); }, []);

    const run = async (label: string, fn: () => Promise<unknown>) => {
        setBusy(true);
        try { await fn(); toast.success(label); await load(); }
        catch (e) { toast.error(`${label} failed: ${e instanceof Error ? e.message : String(e)}`); }
        finally { setBusy(false); }
    };

    return (
        <div className="container mx-auto max-w-5xl space-y-6 px-4 py-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">Meme Roulette admin</h1>
                <Button variant="outline" onClick={load} disabled={busy}>Refresh</Button>
            </div>
            {error && <p className="rounded-lg border border-danger/40 bg-danger-soft p-3 text-sm text-danger">{error}</p>}

            <Tabs defaultValue="round" className="w-full">
                <TabsList>
                    <TabsTrigger value="round">Round</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                    <TabsTrigger value="history">History</TabsTrigger>
                    <TabsTrigger value="achievements">Achievements</TabsTrigger>
                    <TabsTrigger value="referrals">Referrals</TabsTrigger>
                </TabsList>

                <TabsContent value="round" className="space-y-4">
                    {state && (
                        <>
                            <RoundCard title="Live" round={state.round} />
                            <RoundCard title="Last drawn" round={state.last} />
                            <Card>
                                <CardHeader><CardTitle>Live round bets</CardTitle></CardHeader>
                                <CardContent><BetsTable bets={state.bets} /></CardContent>
                            </Card>
                            <Card>
                                <CardHeader>
                                    <CardTitle>Actions</CardTitle>
                                    <CardDescription>Both need your wallet signature. There is no manual winner: the draw is provably fair.</CardDescription>
                                </CardHeader>
                                <CardContent className="flex flex-wrap items-end gap-4">
                                    <div className="space-y-1">
                                        <Label htmlFor="drawIn">Draw in (minutes from now)</Label>
                                        <Input id="drawIn" type="number" min={1} value={drawIn} onChange={e => setDrawIn(Number(e.target.value))} className="w-40" />
                                    </div>
                                    <Button disabled={busy} onClick={() => run('Rescheduled', () => rescheduleRound(Date.now() + drawIn * MIN))}>Reschedule the draw</Button>
                                    <Button variant="destructive" disabled={busy} onClick={() => {
                                        if (confirm('Void the live round? Its bets will never execute and a new round opens now.')) run('Round voided', voidRound);
                                    }}>Void the live round</Button>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </TabsContent>

                <TabsContent value="settings">
                    <Card>
                        <CardHeader>
                            <CardTitle>Settings</CardTitle>
                            <CardDescription>They apply from the next round.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-4 sm:grid-cols-2">
                            {([
                                ['roundMin', 'Round length (minutes)'],
                                ['lockSec', 'Lock before the draw (seconds)'],
                                ['intermissionSec', 'Time between rounds (seconds)'],
                            ] as const).map(([key, label]) => (
                                <div key={key} className="space-y-1">
                                    <Label htmlFor={key}>{label}</Label>
                                    <Input id={key} type="number" step="any" value={form[key]} onChange={e => setForm({ ...form, [key]: Number(e.target.value) })} />
                                </div>
                            ))}
                            <Button className="sm:col-span-2" disabled={busy} onClick={() => run('Settings saved', () => saveConfig({
                                roundMs: Math.round(form.roundMin * MIN),
                                lockMs: Math.round(form.lockSec * 1000),
                                intermissionMs: Math.round(form.intermissionSec * 1000),
                            }))}>Save settings</Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="history">
                    <Card>
                        <CardHeader><CardTitle>Drawn rounds</CardTitle></CardHeader>
                        <CardContent className="space-y-1 font-mono text-sm">
                            {state?.history.length ? state.history.map(id => (
                                <div key={id}><a className="text-accent-text underline" href={`/api/rounds/${id}`} target="_blank" rel="noreferrer">{id}</a></div>
                            )) : <p className="text-ink-muted">No rounds drawn yet.</p>}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="achievements"><AchievementAdminPanel /></TabsContent>
                <TabsContent value="referrals"><ReferralAdminPanel /></TabsContent>
            </Tabs>
        </div>
    );
}
