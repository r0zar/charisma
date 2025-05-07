import React from 'react'
import { Card, CardContent } from './card'
import { Coins, DollarSign, Database, Banknote, Icon } from 'lucide-react'

const iconMap: Record<string, React.ReactNode> = {
    coins: <Coins className="h-5 w-5 text-primary" />,
    dollar: <DollarSign className="h-5 w-5 text-primary" />,
    database: <Database className="h-5 w-5 text-primary" />,
    bank: <Banknote className="h-5 w-5 text-primary" />,
}

type Props = {
    title: string
    value: string
    icon: keyof typeof iconMap
}

export const StatCard: React.FC<Props> = ({ title, value, icon }) => (
    <Card>
        <CardContent className="p-4 flex items-center gap-4">
            {iconMap[icon]}
            <div>
                <p className="text-sm text-muted-foreground">{title}</p>
                <p className="text-lg font-semibold">{value}</p>
            </div>
        </CardContent>
    </Card>
) 