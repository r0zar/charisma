import { Badge } from '@/components/ui/badge';
import { dexOf } from '@/lib/protocols';

/** The DEX a vault belongs to, with its team's icon */
export default function DexBadge({ protocol }: { protocol: string }) {
    const dex = dexOf(protocol);
    return (
        <Badge variant="outline" className="gap-1.5">
            {dex.icon && <img src={dex.icon} alt="" className="w-4 h-4 rounded-full object-cover" />}
            {dex.name}
        </Badge>
    );
}
