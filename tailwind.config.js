/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { 950: '#07080f', 900: '#0a0b1a', 800: '#10122a', 700: '#171a38', 600: '#232750' },
        violet: { 450: '#8b5cf6' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'], display: ['Sora', 'Inter', 'sans-serif'] },
      boxShadow: { glow: '0 0 24px -4px rgba(139,92,246,.55)', cyan: '0 0 24px -6px rgba(34,211,238,.5)' },
    },
  },
  plugins: [],
}
