import React from 'react';
import * as LucideIcons from 'lucide-react';

// Create wrapped components for all Lucide icons
type IconProps = React.ComponentProps<typeof LucideIcons.AlertCircle>; // Using any icon as base for props
const wrapIcon = (Icon: any) => (props: IconProps) => <Icon {...props} />;

// Export all icons as wrapped components
export const icons = Object.entries(LucideIcons).reduce((acc, [name, Icon]) => ({
    ...acc,
    [name]: wrapIcon(Icon)
}), {} as Record<keyof typeof LucideIcons, (props: IconProps) => JSX.Element>);

// Re-export all icons individually for convenience
export const {
    Copy,
    Loader2,
    CheckCircle2,
    ChevronRight,
    Zap,
    Lock,
    Layers,
    Check,
    // Add any other icons you want to export directly here
    ...otherIcons
} = icons; 