/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{tsx,html}"],
  darkMode: ['class'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      colors: {
        // Cybertruck meets iPod meets Space Colony colors - bright with dark text
        'signet-blue': '#7DF9FF', // Bright cybertruck teal
        'signet-dark': '#0D1117', // Space-black

        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',

        cyber: {
          DEFAULT: '#7DF9FF', // Bright cybertruck teal
          dark: '#00B0BD',
          light: '#A5FDFF',
          muted: '#2A858E',
        },

        steel: {
          DEFAULT: '#8C9CA8', // Brushed steel
          dark: '#566570',
          light: '#C0CBD4',
        },

        space: {
          black: '#0D1117', // Deep space black
          dark: '#161B22',
          gray: '#21262D',
          void: '#010409',
        },

        neon: {
          blue: '#7DF9FF', // Bright cybertruck teal
          pink: '#DA2FB7',
          purple: '#8C32C1',
          green: '#36C758',
        },

        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          legacy: '#7DF9FF', // Bright cybertruck teal
          dark: '#00B0BD',
          light: '#A5FDFF',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
          legacy: '#8C9CA8', // Brushed steel
          dark: '#566570',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
          legacy: '#DA2FB7', // Toned down neon pink
          light: '#EC74D0',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))'
        },
        background: {
          dark: "#0D1117", // Space-black
          light: "#FFFFFF",
        }
      },
      fontSize: {
        xxs: '10px',
        xs: 'var(--text-xs)',
        sm: 'var(--text-sm)',
        md: 'var(--text-md)',
        lg: 'var(--text-lg)',
        xl: 'var(--text-xl)'
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'shimmer': 'shimmer 2s infinite',
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-in-up': 'slideInUp 0.5s ease-out',
        'border-pulse': 'borderPulse 2s infinite',
        'shake': 'shake 0.2s ease-in-out',
        'ping-slow': 'ping-slow 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'bounce-slow': 'bounce-slow 2s infinite',
        'particle': 'particle 1s ease-out forwards',
        'neon-pulse': 'neonPulse 2s infinite',
        'float': 'float 6s ease-in-out infinite',
        'cyber-glitch': 'cyberGlitch 1s ease-in-out infinite',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0'
          },
          to: {
            height: 'var(--radix-accordion-content-height)'
          }
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)'
          },
          to: {
            height: '0'
          }
        },
        shimmer: {
          '0%': { transform: 'translateX(var(--shimmer-from))' },
          '100%': { transform: 'translateX(var(--shimmer-to))' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.5 },
        },
        fadeIn: {
          'from': { opacity: 0 },
          'to': { opacity: 1 },
        },
        slideInUp: {
          'from': { transform: 'translateY(20px)', opacity: 0 },
          'to': { transform: 'translateY(0)', opacity: 1 },
        },
        borderPulse: {
          '0%': { borderColor: 'rgba(125, 249, 255, 0.3)' },
          '50%': { borderColor: 'rgba(125, 249, 255, 0.8)' },
          '100%': { borderColor: 'rgba(125, 249, 255, 0.3)' },
        },
        neonPulse: {
          '0%': {
            boxShadow: '0 0 5px rgba(125, 249, 255, 0.7), 0 0 10px rgba(125, 249, 255, 0.5), 0 0 15px rgba(125, 249, 255, 0.3)'
          },
          '50%': {
            boxShadow: '0 0 10px rgba(125, 249, 255, 0.8), 0 0 20px rgba(125, 249, 255, 0.6), 0 0 30px rgba(125, 249, 255, 0.4)'
          },
          '100%': {
            boxShadow: '0 0 5px rgba(125, 249, 255, 0.7), 0 0 10px rgba(125, 249, 255, 0.5), 0 0 15px rgba(125, 249, 255, 0.3)'
          },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        cyberGlitch: {
          '0%, 100%': { transform: 'translate(0)' },
          '10%': { transform: 'translate(-2px, 2px)' },
          '20%': { transform: 'translate(2px, -2px)' },
          '30%': { transform: 'translate(-2px, -2px)' },
          '40%': { transform: 'translate(2px, 2px)' },
          '50%': { transform: 'translate(-2px, 2px)' },
          '60%': { transform: 'translate(2px, -2px)' },
          '70%': { transform: 'translate(-2px, -2px)' },
          '80%': { transform: 'translate(2px, 2px)' },
          '90%': { transform: 'translate(-2px, 2px)' },
        },
        shake: {
          '0%': { transform: 'translate(1px, 1px) rotate(0deg)' },
          '10%': { transform: 'translate(-1px, -2px) rotate(-1deg)' },
          '20%': { transform: 'translate(-3px, 0px) rotate(1deg)' },
          '30%': { transform: 'translate(3px, 2px) rotate(0deg)' },
          '40%': { transform: 'translate(1px, -1px) rotate(1deg)' },
          '50%': { transform: 'translate(-1px, 2px) rotate(-1deg)' },
          '60%': { transform: 'translate(-3px, 1px) rotate(0deg)' },
          '70%': { transform: 'translate(3px, 1px) rotate(-1deg)' },
          '80%': { transform: 'translate(-1px, -1px) rotate(1deg)' },
          '90%': { transform: 'translate(1px, 2px) rotate(0deg)' },
          '100%': { transform: 'translate(1px, -2px) rotate(-1deg)' },
        },
        'ping-slow': {
          '0%': { transform: 'scale(1)', opacity: 0.5 },
          '100%': { transform: 'scale(1.5)', opacity: 0 },
        },
        'bounce-slow': {
          '0%, 100%': { transform: 'translateY(-5%)', animationTimingFunction: 'cubic-bezier(0.8, 0, 1, 1)' },
          '50%': { transform: 'translateY(0)', animationTimingFunction: 'cubic-bezier(0, 0, 0.2, 1)' },
        },
        particle: {
          '0%': { transform: 'translate(0, 0)', opacity: 1 },
          '100%': { transform: 'translate(var(--tw-translate-x), var(--tw-translate-y))', opacity: 0 },
        }
      },
      boxShadow: {
        'glow': '0 0 15px rgba(125, 249, 255, 0.7), 0 0 30px rgba(125, 249, 255, 0.4)',
        'glow-sm': '0 0 10px rgba(125, 249, 255, 0.5), 0 0 20px rgba(125, 249, 255, 0.3)',
        'neon': '0 0 5px rgba(125, 249, 255, 0.7), 0 0 10px rgba(125, 249, 255, 0.5), 0 0 15px rgba(125, 249, 255, 0.3)',
        'neon-strong': '0 0 10px rgba(125, 249, 255, 0.8), 0 0 20px rgba(125, 249, 255, 0.6), 0 0 30px rgba(125, 249, 255, 0.4)',
        'inner-neon': 'inset 0 0 5px rgba(125, 249, 255, 0.7), inset 0 0 10px rgba(125, 249, 255, 0.3)',
      },
      backgroundImage: {
        'hero-pattern': "url('/hero-pattern.svg')",
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'cyber-grid': 'linear-gradient(to right, rgba(125, 249, 255, 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(125, 249, 255, 0.1) 1px, transparent 1px)',
        'space-gradient': 'linear-gradient(to bottom, #0D1117, #161B22)',
        'blaze-pattern': "url('/images/blaze-pattern.jpg')",
        // 'circuit-pattern': "url('/images/circuit-pattern.jpg')",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};