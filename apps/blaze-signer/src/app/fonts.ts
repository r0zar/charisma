import localFont from 'next/font/local';

export const inter = localFont({
    src: [
        {
            path: './fonts/Inter-Regular.woff2',
            weight: '400',
            style: 'normal',
        },
        {
            path: './fonts/Inter-Medium.woff2',
            weight: '500',
            style: 'normal',
        },
        {
            path: './fonts/Inter-Bold.woff2',
            weight: '700',
            style: 'normal',
        },
    ],
    display: 'swap',
    variable: '--font-inter',
}); 