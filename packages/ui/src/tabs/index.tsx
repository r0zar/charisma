import React, { CSSProperties } from 'react';

interface TabsProps {
    tabs: {
        id: string;
        label: string;
        content: React.ReactNode;
    }[];
    activeTab?: string;
    onTabChange: (tabId: string) => void;
    className?: string;
}

const styles = {
    root: {
        width: '100%'
    } as CSSProperties,
    list: {
        display: 'flex',
        borderBottomWidth: '1px',
        borderBottomStyle: 'solid',
        borderBottomColor: 'var(--border, #e5e7eb)',
        marginBottom: '1.5rem',
        gap: '0.5rem'
    } as CSSProperties,
    tab: {
        padding: '0.75rem 1rem',
        fontSize: '0.875rem',
        fontWeight: 500,
        color: 'var(--muted, #6b7280)',
        backgroundColor: 'transparent',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative',
        borderBottomWidth: '2px',
        borderBottomStyle: 'solid',
        borderBottomColor: 'transparent'
    } as CSSProperties,
    activeTab: {
        color: 'var(--foreground, #000000)',
        borderBottomColor: 'var(--foreground, #000000)'
    } as CSSProperties,
    content: {
        outline: 'none'
    } as CSSProperties
};

export function Tabs({ tabs, activeTab, onTabChange, className }: TabsProps) {
    // Default to first tab if none selected
    const currentTab = activeTab || tabs[0]?.id;

    return (
        <div style={styles.root} className={className}>
            <div style={styles.list} role="tablist">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        role="tab"
                        aria-selected={currentTab === tab.id}
                        aria-controls={`panel-${tab.id}`}
                        id={`tab-${tab.id}`}
                        style={{
                            ...styles.tab,
                            ...(currentTab === tab.id && styles.activeTab)
                        }}
                        onClick={() => onTabChange(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>
            {tabs.map((tab) => (
                <div
                    key={tab.id}
                    role="tabpanel"
                    id={`panel-${tab.id}`}
                    aria-labelledby={`tab-${tab.id}`}
                    hidden={currentTab !== tab.id}
                    style={styles.content}
                >
                    {tab.content}
                </div>
            ))}
        </div>
    );
} 