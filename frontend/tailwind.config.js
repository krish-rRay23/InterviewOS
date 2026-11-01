/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        darkBg: '#09090b',
        cardBg: '#121215',
        cardSurface: '#18181b',
        borderCol: '#27272a',
        accentBlue: '#0284c7',
        accentCyan: '#06b6d4',
        accentGreen: '#10b981',
        accentAmber: '#f59e0b',
        accentRed: '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
