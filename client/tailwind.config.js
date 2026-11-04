/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        tv: {
          dark: '#070a10',
          card: '#121927',
          cardHover: '#1c283e',
          accent: '#e50914',
          accentHover: '#f40612',
          cyan: '#00d1ff',
          cyanGlow: '#00d1ff80',
          purple: '#8b5cf6',
          muted: '#8e9bae',
          surface: '#0d1322',
        },
      },
      fontFamily: {
        tv: ['-apple-system', 'BlinkMacSystemFont', '"SamsungOne"', '"SF Pro Display"', 'Roboto', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        tvFocus: '0 0 0 3px #00d1ff, 0 15px 35px -5px rgba(0, 209, 255, 0.45)',
        tvFocusRed: '0 0 0 3px #e50914, 0 15px 35px -5px rgba(229, 9, 20, 0.55)',
        liquidGlass: 'inset 0 1px 1px rgba(255, 255, 255, 0.35), 0 20px 40px rgba(0, 0, 0, 0.5)',
        liquidGlow: '0 0 30px rgba(0, 209, 255, 0.35)',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.03)' },
        },
        orbFloat1: {
          '0%, 100%': { transform: 'translate(0px, 0px) scale(1)' },
          '50%': { transform: 'translate(50px, 40px) scale(1.15)' },
        },
        orbFloat2: {
          '0%, 100%': { transform: 'translate(0px, 0px) scale(1)' },
          '50%': { transform: 'translate(-40px, -50px) scale(1.2)' },
        },
        orbFloat3: {
          '0%, 100%': { transform: 'translate(0px, 0px) scale(1)' },
          '50%': { transform: 'translate(30px, -30px) scale(0.9)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
      },
      animation: {
        glow: 'pulseGlow 3s ease-in-out infinite',
        orb1: 'orbFloat1 18s ease-in-out infinite',
        orb2: 'orbFloat2 24s ease-in-out infinite',
        orb3: 'orbFloat3 20s ease-in-out infinite',
        shimmer: 'shimmer 2.5s infinite',
      },
    },
  },
  plugins: [],
};
