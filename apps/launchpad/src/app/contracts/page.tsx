import { ContractsList } from '@/components/contracts/contracts-list';

// Set this to dynamic to ensure we always get fresh data
export const dynamic = 'force-dynamic';

export default function ContractsPage() {
    return (
        <div className="container pb-12">
            <ContractsList />
        </div>
    );
} 