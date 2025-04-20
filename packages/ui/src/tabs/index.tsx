import React from 'react';
import { cn } from '../utils';

interface TabsProps {
    tabs: {
        id: string;
        label: string;
        content: React.ReactNode;
        icon?: React.ReactNode;
    }[];
    activeTab?: string;
    onTabChange: (tabId: string) => void;
    className?: string;
    variant?: 'default' | 'pills' | 'underline';
    size?: 'default' | 'sm' | 'lg';
    alignment?: 'start' | 'center' | 'end';
}

export function Tabs({
    tabs,
    activeTab,
    onTabChange,
    className,
    variant = 'default',
    size = 'default',
    alignment = 'start'
}: TabsProps) {
    // Default to first tab if none selected
    const currentTab = activeTab || tabs[0]?.id;

    // Define styles based on variant
    const getTabStyles = (tabId: string) => {
        // Base styles for all variants
        const baseStyles = "text-sm font-medium transition-all duration-200 relative outline-none flex items-center gap-2";

        // Size styles
        const sizeStyles = {
            sm: "py-1.5 px-3 text-xs",
            default: "py-2.5 px-4",
            lg: "py-3 px-6 text-base"
        };

        // Variant specific styles
        const variantStyles = {
            default: `
                text-muted-foreground hover:text-foreground
                ${currentTab === tabId
                    ? "text-foreground font-medium after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary"
                    : "hover:bg-muted/40"}
                transition-colors duration-200 rounded-t-md relative after:opacity-0 after:content-[''] 
                ${currentTab === tabId ? "after:opacity-100" : ""}
            `,
            pills: `
                rounded-md
                ${currentTab === tabId
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/80"}
                transition-colors duration-200
            `,
            underline: `
                border-b-2 border-transparent
                text-muted-foreground hover:text-foreground
                ${currentTab === tabId
                    ? "text-foreground border-foreground"
                    : "hover:border-border/50"}
                transition-colors duration-200
            `
        };

        return cn(
            baseStyles,
            sizeStyles[size],
            variantStyles[variant]
        );
    };

    // Define container styles based on variant
    const getContainerStyles = () => {
        const baseStyles = "flex mb-6 gap-1";

        const variantStyles = {
            default: "",
            pills: "p-1 bg-muted/30 rounded-lg",
            underline: "border-b border-border"
        };

        const alignmentStyles = {
            start: "justify-start",
            center: "justify-center",
            end: "justify-end"
        };

        return cn(baseStyles, variantStyles[variant], alignmentStyles[alignment]);
    };

    return (
        <div className={cn("w-full", className)}>
            <div
                className={getContainerStyles()}
                role="tablist"
            >
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        role="tab"
                        aria-selected={currentTab === tab.id}
                        aria-controls={`panel-${tab.id}`}
                        id={`tab-${tab.id}`}
                        className={cn(
                            getTabStyles(tab.id),
                            "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        )}
                        onClick={() => onTabChange(tab.id)}
                    >
                        {tab.icon && <span className="opacity-80">{tab.icon}</span>}
                        {tab.label}
                    </button>
                ))}
            </div>
            <div className="transition-opacity duration-200">
                {tabs.map((tab) => (
                    <div
                        key={tab.id}
                        role="tabpanel"
                        id={`panel-${tab.id}`}
                        aria-labelledby={`tab-${tab.id}`}
                        hidden={currentTab !== tab.id}
                        className={cn(
                            "outline-none",
                            currentTab === tab.id ? "animate-in fade-in-0 duration-300" : "animate-out fade-out-0 duration-150"
                        )}
                    >
                        {tab.content}
                    </div>
                ))}
            </div>
        </div>
    );
} 