/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#1B3A5C',
          600: '#163250',
          700: '#122A44',
          800: '#0E2137',
          900: '#0A192B',
        },
        success: {
          50: '#ECFDF5', 100: '#D1FAE5', 500: '#10B981', 600: '#059669', 700: '#047857',
        },
        warning: {
          50: '#FFFBEB', 100: '#FEF3C7', 500: '#F59E0B', 600: '#D97706', 700: '#B45309',
        },
        danger: {
          50: '#FFF1F2', 100: '#FFE4E6', 500: '#F43F5E', 600: '#E11D48', 700: '#BE123C',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          from: { opacity: '0', transform: 'translateX(-12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulse2: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        countUp: {
          from: { opacity: '0', transform: 'translateY(10px) scale(0.8)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 15px rgba(16, 185, 129, 0.15)' },
          '50%': { boxShadow: '0 0 30px rgba(16, 185, 129, 0.3)' },
        },
        progressBar: {
          from: { width: '0%' },
          to: { width: 'var(--progress)' },
        },
        revealRight: {
          from: { opacity: '0', transform: 'translateX(-20px)', clipPath: 'inset(0 100% 0 0)' },
          to: { opacity: '1', transform: 'translateX(0)', clipPath: 'inset(0 0 0 0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-out',
        slideIn: 'slideIn 0.3s ease-out',
        scaleIn: 'scaleIn 0.2s ease-out',
        slideUp: 'slideUp 0.5s cubic-bezier(0.16,1,0.3,1) both',
        slideDown: 'slideDown 0.3s ease-out both',
        shimmer: 'shimmer 2s linear infinite',
        pulse2: 'pulse2 2s ease-in-out infinite',
        float: 'float 3s ease-in-out infinite',
        countUp: 'countUp 0.6s cubic-bezier(0.16,1,0.3,1) both',
        glow: 'glow 2s ease-in-out infinite',
        progressBar: 'progressBar 1s cubic-bezier(0.16,1,0.3,1) both',
        revealRight: 'revealRight 0.5s cubic-bezier(0.16,1,0.3,1) both',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.04), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        'card-hover': '0 4px 12px 0 rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.04)',
      },
    },
  },
  plugins: [],
};
