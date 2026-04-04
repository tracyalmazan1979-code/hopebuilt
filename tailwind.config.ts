import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:  ['var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        mono:  ['var(--font-dm-mono)', 'monospace'],
        syne:  ['var(--font-syne)',    'system-ui', 'sans-serif'],
      },
      colors: {
        app:       '#0D1117',
        surface: {
          DEFAULT: '#161B22',
          2:       '#1C2230',
          3:       '#21293A',
        },
        border: {
          DEFAULT: 'rgba(255,255,255,0.07)',
          strong:  'rgba(255,255,255,0.12)',
        },
        brand: {
          amber:  '#F59E0B',
          teal:   '#22D3EE',
        },
      },
      borderRadius: {
        DEFAULT: '10px',
        sm:      '6px',
        xs:      '4px',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease forwards',
      },
    },
  },
  plugins: [],
}

export default config
