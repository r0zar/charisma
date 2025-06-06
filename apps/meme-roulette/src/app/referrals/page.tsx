import { ReferralDashboard } from '@/components/ui/ReferralDashboard';

export default function ReferralsPage() {
    return (
        <div className="container mx-auto px-4 py-8">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Referrals</h1>
                    <p className="text-muted-foreground">
                        Invite friends to join Meme Roulette and track your referrals
                    </p>
                </div>

                <ReferralDashboard />
            </div>
        </div>
    );
} 