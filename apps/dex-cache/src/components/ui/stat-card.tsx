import React from 'react'
import { Card, CardContent } from './card'
import {
    Coins, DollarSign, Database, Banknote,
    Zap, Clock, Users, BarChart2, Activity,
    TrendingUp, Layers, ArrowUp, ArrowDown,
    BatteryCharging
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Expanded icon map with energy-related icons
const iconMap = {
    coins: Coins,
    dollar: DollarSign,
    database: Database,
    bank: Banknote,
    energy: Zap,
    clock: Clock,
    users: Users,
    chart: BarChart2,
    activity: Activity,
    trending: TrendingUp,
    layers: Layers,
    up: ArrowUp,
    down: ArrowDown,
    battery: BatteryCharging
}

type StatCardSize = 'sm' | 'md' | 'lg'
type StatCardColor = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger'

export interface StatCardProps {
    title: string
    value: string | number
    icon: keyof typeof iconMap
    description?: string
    change?: {
        value: number
        direction: 'up' | 'down' | 'neutral'
        label?: string
    }
    size?: StatCardSize
    className?: string
    iconClassName?: string
    colorScheme?: StatCardColor
    onClick?: () => void
}

export const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    icon,
    description,
    change,
    size = 'md',
    className = '',
    iconClassName = '',
    colorScheme = 'default',
    onClick
}) => {
    const IconComponent = iconMap[icon]

    // Size-based styles
    const sizeStyles = {
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-5'
    }

    // Color-based styles - using card background with subtle colored borders
    const colorStyles = {
        default: 'bg-card text-card-foreground border-border',
        primary: 'bg-card text-card-foreground border-primary/20',
        secondary: 'bg-card text-card-foreground border-secondary/20',
        success: 'bg-card text-card-foreground border-emerald-500/20',
        warning: 'bg-card text-card-foreground border-amber-500/20',
        danger: 'bg-card text-card-foreground border-rose-500/20'
    }

    // Icon color based on color scheme
    const iconColors = {
        default: 'text-muted-foreground',
        primary: 'text-primary',
        secondary: 'text-secondary',
        success: 'text-emerald-400',
        warning: 'text-amber-400',
        danger: 'text-rose-400'
    }

    // Change colors
    const changeColors = {
        up: 'text-emerald-400',
        down: 'text-rose-400',
        neutral: 'text-muted-foreground'
    }

    // Value sizes
    const valueSizes = {
        sm: 'text-base',
        md: 'text-lg',
        lg: 'text-2xl'
    }

    // Title sizes
    const titleSizes = {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base'
    }

    // Description sizes
    const descriptionSizes = {
        sm: 'text-xs',
        md: 'text-xs',
        lg: 'text-sm'
    }

    return (
        <Card
            className={cn(
                colorStyles[colorScheme],
                onClick && 'cursor-pointer hover:shadow-md transition-shadow duration-200',
                className
            )}
            onClick={onClick}
        >
            <CardContent className={cn(
                "flex items-start justify-between",
                sizeStyles[size]
            )}>
                <div>
                    <p className={cn(
                        "text-muted-foreground font-medium",
                        titleSizes[size]
                    )}>{title}</p>

                    <p className={cn(
                        "font-semibold",
                        valueSizes[size]
                    )}>
                        {typeof value === 'number'
                            ? value.toLocaleString(undefined, {
                                maximumFractionDigits: 2
                            })
                            : value}
                    </p>

                    {description && (
                        <p className={cn(
                            "text-muted-foreground mt-1",
                            descriptionSizes[size]
                        )}>
                            {description}
                        </p>
                    )}

                    {change && (
                        <div className={cn(
                            "flex items-center gap-1 mt-1",
                            descriptionSizes[size],
                            changeColors[change.direction]
                        )}>
                            {change.direction === 'up' && <ArrowUp className="h-3 w-3" />}
                            {change.direction === 'down' && <ArrowDown className="h-3 w-3" />}
                            <span>
                                {change.value.toLocaleString(undefined, {
                                    maximumFractionDigits: 1,
                                    style: 'percent'
                                })}
                                {change.label && ` ${change.label}`}
                            </span>
                        </div>
                    )}
                </div>

                <div className={cn(
                    "rounded-full p-2",
                    colorScheme === 'default' ? 'bg-primary/10' :
                    colorScheme === 'primary' ? 'bg-primary/10' :
                    colorScheme === 'secondary' ? 'bg-secondary/10' :
                    colorScheme === 'success' ? 'bg-emerald-500/10' :
                    colorScheme === 'warning' ? 'bg-amber-500/10' :
                    colorScheme === 'danger' ? 'bg-rose-500/10' : 'bg-primary/10'
                )}>
                    <IconComponent className={cn(
                        "h-5 w-5",
                        iconColors[colorScheme],
                        iconClassName
                    )} />
                </div>
            </CardContent>
        </Card>
    )
} 