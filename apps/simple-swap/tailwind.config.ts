import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/app/**/*.{js,ts,jsx,tsx}",
        "./src/components/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            screens: {
                '3xl': '1600px',
            },
            keyframes: {
                "slide-in-from-right": {
                    "0%": { transform: "translateX(100%)" },
                    "100%": { transform: "translateX(0)" },
                },
                "slide-out-to-right": {
                    "0%": { transform: "translateX(0)" },
                    "100%": { transform: "translateX(100%)" },
                },
                "fade-in": {
                    "0%": { opacity: "0" },
                    "100%": { opacity: "1" },
                },
                "fade-out": {
                    "0%": { opacity: "1" },
                    "100%": { opacity: "0" },
                },
            },
            animation: {
                "slide-in-from-right": "slide-in-from-right 0.3s ease-out",
                "slide-out-to-right": "slide-out-to-right 0.3s ease-in",
                "fade-in": "fade-in 0.3s ease-out",
                "fade-out": "fade-out 0.3s ease-in",
            },
            colors: {
                border: "hsl(var(--border))",
                input: "hsl(var(--input))",
                ring: "hsl(var(--ring))",
                background: "hsl(var(--background))",
                foreground: "hsl(var(--foreground))",
                primary: {
                    DEFAULT: "hsl(var(--primary))",
                    foreground: "hsl(var(--primary-foreground))",
                    50: "#fff4e6",
                    100: "#ffe8cc",
                    200: "#ffd8a8",
                    300: "#ffc078",
                    400: "#ffa94d",
                    500: "#ff922b",
                    600: "#fd7e14",
                    700: "#f76707",
                    800: "#e8590c",
                    900: "#d9480f",
                    950: "#7c2d03",
                },
                secondary: {
                    DEFAULT: "hsl(var(--secondary))",
                    foreground: "hsl(var(--secondary-foreground))",
                    50: "#fff5f5",
                    100: "#ffe3e3",
                    200: "#ffc9c9",
                    300: "#ffa8a8",
                    400: "#ff8787",
                    500: "#ff6b6b",
                    600: "#fa5252",
                    700: "#f03e3e",
                    800: "#e03131",
                    900: "#c92a2a",
                    950: "#7d0000",
                },
                destructive: {
                    DEFAULT: "hsl(var(--destructive))",
                    foreground: "hsl(var(--destructive-foreground))",
                },
                muted: {
                    DEFAULT: "hsl(var(--muted))",
                    foreground: "hsl(var(--muted-foreground))",
                },
                accent: {
                    DEFAULT: "hsl(var(--accent))",
                    foreground: "hsl(var(--accent-foreground))",
                },
                popover: {
                    DEFAULT: "hsl(var(--popover))",
                    foreground: "hsl(var(--popover-foreground))",
                },
                card: {
                    DEFAULT: "hsl(var(--card))",
                    foreground: "hsl(var(--card-foreground))",
                },
                dark: {
                    100: "#1e1e20",
                    200: "#2d2d30",
                    300: "#3e3e42",
                    400: "#686868",
                    500: "#7f7f7f",
                    600: "#a5a5a5",
                    700: "#d4d4d4",
                    800: "#efefef",
                    900: "#f9f9f9",
                },
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 2px)",
                sm: "calc(var(--radius) - 4px)",
                "4xl": "2rem",
            },
            boxShadow: {
                glass: "0 4px 30px rgba(0, 0, 0, 0.1)",
                subtle: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
                highlight: "inset 0 1px 0 0 rgb(255 255 255 / 0.05)",
            },
            backgroundImage: {
                "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
            },
        },
    },
    darkMode: "class",
    plugins: [],
};

export default config; 