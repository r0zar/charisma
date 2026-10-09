import { redirect } from 'next/navigation';

/** Orders live in Activity now: old links land on its Orders tab, keeping their page, filter and search */
export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
    const params = new URLSearchParams(await searchParams);
    params.set('view', 'orders');
    redirect(`/activity?${params}`);
}
