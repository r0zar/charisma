import EnergyVaultList from '@/components/hold-to-earn/EnergyVaultList';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, Info, Clock, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function EnergyPage() {
    return (
        <div className="container mx-auto py-8 space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-primary flex items-center gap-2">
                        <Zap className="h-8 w-8 text-primary" />
                        Hold-to-Earn
                    </h1>
                    <p className="text-muted-foreground mt-2 max-w-2xl">
                        Earn energy by holding tokens in your wallet. The longer you hold, the more energy you accumulate, which can be harvested for rewards.
                    </p>
                </div>
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center">
                            <Clock className="h-5 w-5 mr-2 text-primary" />
                            Automatic Tracking
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        Energy accumulates based on how long you hold tokens. Keep them in your wallet to start earning.
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center">
                            <Zap className="h-5 w-5 mr-2 text-primary" />
                            Harvest Rewards
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        Claim your accumulated energy when you're ready. Your rewards scale with the duration and amount you hold.
                    </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center">
                            <Shield className="h-5 w-5 mr-2 text-primary" />
                            Protocol Benefits
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        Energy can be used for token rewards, enhanced protocol features, exclusive NFTs, and more.
                    </CardContent>
                </Card>
            </div>

            {/* Optional Informational Alert */}
            <Alert variant="default" className="bg-primary/5 border-primary/20 mb-8">
                <Info className="h-4 w-4 text-primary" />
                <AlertTitle className="text-primary">What is Hold-to-Earn?</AlertTitle>
                <AlertDescription className="text-sm text-muted-foreground">
                    Hold-to-Earn is a feature that rewards long-term holders of specific tokens. As you hold tokens in your wallet, you accrue energy over time.
                    This energy can be harvested and used within the ecosystem for various benefits. Select a token below to get started.
                </AlertDescription>
            </Alert>

            {/* Main Content - Vault List */}
            <div className="bg-card rounded-lg border border-border/50 p-6">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold">Eligible Tokens</h2>
                    <Badge variant="outline" className="px-3">
                        <Zap className="h-3.5 w-3.5 mr-1.5 text-primary" />
                        Hold-To-Earn
                    </Badge>
                </div>
                <EnergyVaultList />
            </div>
        </div>
    );
} 