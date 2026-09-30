/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: {
          950: '#080B14',
          900: '#0C1018',
          850: '#111620',
          800: '#161C28',
          750: '#1B2330',
          700: '#222B3A',
          600: '#2E3949',
          500: '#3D4A5C',
        },
        accent: {
          50: '#EEF6FF',
          100: '#D9EAFF',
          200: '#BCD8FF',
          300: '#8EC0FF',
          400: '#599BFF',
          500: '#3377FF',
          600: '#1E5BE6',
          700: '#1745B8',
          800: '#173A92',
          900: '#193374',
        },
        emerald2: {
          400: '#34D399',
          500: '#10B981',
        },
        rose2: {
          400: '#FB7185',
          500: '#F43F5E',
        },
        amber2: {
          400: '#FBBF24',
          500: '#F59E0B',
        },
      },
      boxShadow: {
        'glow-sm': '0 0 12px rgba(51, 119, 255, 0.15)',
        'glow': '0 0 24px rgba(51, 119, 255, 0.20)',
        'glow-lg': '0 0 40px rgba(51, 119, 255, 0.25)',
        'card': '0 2px 12px rgba(0,0,0,0.25), 0 0 1px rgba(255,255,255,0.04)',
        'card-hover': '0 8px 32px rgba(0,0,0,0.35), 0 0 1px rgba(255,255,255,0.06)',
        'modal': '0 24px 64px rgba(0,0,0,0.5), 0 0 1px rgba(255,255,255,0.06)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'fade-in-up': 'fadeInUp 0.4s ease-out',
        'slide-up': 'slideUp 0.35s cubic-bezier(0.16,1,0.3,1)',
        'scale-in': 'scaleIn 0.25s cubic-bezier(0.16,1,0.3,1)',
        'shimmer': 'shimmer 2.5s linear infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'spin-slow': 'spin 1.2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
      },
      backgroundImage: {
        'grid-faint': "linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px)",
      },
      backgroundSize: {
        'grid-40': '40px 40px',
      },
    },
  },
  plugins: [],
};
