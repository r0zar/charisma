export type Theme = 'light' | 'dark' | 'system';

export interface ThemeProviderState {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

export interface ThemeProviderProps {
    children: React.ReactNode;
    defaultTheme?: Theme;
    storageKey?: string;
} 