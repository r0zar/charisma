import { Badge } from '@/components/ui/badge';
import { protocolOf } from '@/lib/protocols';

/** The protocol a vault belongs to, with its team's icon */
export default function ProtocolBadge({ protocol }: { protocol: string }) {
    const p = protocolOf(protocol);
    return (
        <Badge variant="outline" className="gap-1.5">
            {p.icon && <img src={p.icon} alt="" className="w-4 h-4 rounded-full object-cover" />}
            {p.name}
        </Badge>
    );
}
