import React, { useState } from 'react';
import { Tabs } from './index';

// Example icons (you would import real icons in an actual application)
const AccountIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>;
const SettingsIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>;
const ProfileIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M16 13H8"></path><path d="M16 17H8"></path><path d="M10 9H8"></path></svg>;

// Basic example with different variants
export function TabsExample() {
    const [activeTab, setActiveTab] = useState('tab1');

    const tabs = [
        {
            id: 'tab1',
            label: 'Account',
            icon: <AccountIcon />,
            content: <div className="p-4 bg-card rounded-md border border-border">Account Content</div>
        },
        {
            id: 'tab2',
            label: 'Settings',
            icon: <SettingsIcon />,
            content: <div className="p-4 bg-card rounded-md border border-border">Settings Content</div>
        },
        {
            id: 'tab3',
            label: 'Profile',
            icon: <ProfileIcon />,
            content: <div className="p-4 bg-card rounded-md border border-border">Profile Content</div>
        }
    ];

    const tabsWithoutIcons = tabs.map(({ icon, ...rest }) => rest);

    return (
        <div className="space-y-10">
            <div>
                <h3 className="text-lg font-semibold mb-4">Default Tabs</h3>
                <Tabs
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />
            </div>

            <div>
                <h3 className="text-lg font-semibold mb-4">Pills Variant</h3>
                <Tabs
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    variant="pills"
                />
            </div>

            <div>
                <h3 className="text-lg font-semibold mb-4">Underline Variant</h3>
                <Tabs
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    variant="underline"
                />
            </div>

            <div>
                <h3 className="text-lg font-semibold mb-4">Centered Alignment (No Icons)</h3>
                <Tabs
                    tabs={tabsWithoutIcons}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    variant="default"
                    alignment="center"
                />
            </div>

            <div>
                <h3 className="text-lg font-semibold mb-4">Right Alignment</h3>
                <Tabs
                    tabs={tabsWithoutIcons}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    variant="default"
                    alignment="end"
                />
            </div>

            <div>
                <h3 className="text-lg font-semibold mb-4">Different Sizes</h3>
                <div className="space-y-6">
                    <Tabs
                        tabs={tabs}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        variant="pills"
                        size="sm"
                    />
                    <Tabs
                        tabs={tabs}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        variant="pills"
                        size="default"
                    />
                    <Tabs
                        tabs={tabs}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        variant="pills"
                        size="lg"
                    />
                </div>
            </div>

            <div className="p-8 bg-muted/20 rounded-lg">
                <h3 className="text-lg font-semibold mb-4">On Dark Background</h3>
                <Tabs
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    variant="pills"
                />
            </div>
        </div>
    );
} 