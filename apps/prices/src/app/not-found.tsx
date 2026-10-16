import Link from 'next/link';
import { SiteHeader } from '@/components/site-header';

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid max-w-xl gap-3 px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">We don&apos;t have a price for that token</h1>
        <p className="text-ink-muted">Check the contract id, or search for the token by name in the box above.</p>
        <p><Link href="/" className="font-semibold text-accent-text hover:underline">Back to all markets</Link></p>
      </main>
    </>
  );
}
