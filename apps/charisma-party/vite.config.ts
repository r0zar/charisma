import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    root: '.',
    publicDir: 'public',
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: './index.html',
            external: [
                'blaze-sdk/realtime'
            ]
        }
    },
    define: {
        'process.env.NEXT_PUBLIC_TOKEN_CACHE_URL': JSON.stringify(process.env.NEXT_PUBLIC_TOKEN_CACHE_URL || 'https://tokens.charisma.rocks'),
        'process.env.TOKEN_CACHE_URL': JSON.stringify(process.env.TOKEN_CACHE_URL || 'https://tokens.charisma.rocks'),
        'process.env': {}
    }
}); 