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
        darkBg: '#05070d',       // Deep midnight navy
        cardBg: '#0b101b',       // Elevated panel
        cardSurface: '#101726',  // Secondary surface
        borderCol: '#1b263b',    // Precision crisp borders
        borderHighlight: '#2a3b5c',
        accentBlue: '#0284c7',   // Ocean blue
        accentCyan: '#00f2fe',   // Electric Cyan
        accentTeal: '#05d5b2',   // Refined Teal
        accentAmber: '#f59e0b',  // Warm amber highlight
        accentRose: '#f43f5e',   // Precision rose
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        pixel: ['"Press Start 2P"', '"VT323"', 'monospace'],
      },
      boxShadow: {
        'pixel-sm': '1px 1px 0px 0px #1b263b',
        'pixel-md': '2px 2px 0px 0px #1b263b',
        'pixel-glow': '0 0 20px -3px rgba(0, 242, 254, 0.25)',
        'amber-glow': '0 0 20px -3px rgba(245, 158, 11, 0.25)',
      },
    },
  },
  plugins: [],
}
