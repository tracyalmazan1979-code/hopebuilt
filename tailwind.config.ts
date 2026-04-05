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
        app:       '#F5F7FA',
        surface: {
          DEFAULT: '#FFFFFF',
          2:       '#F0F2F5',
          3:       '#E8ECF0',
        },
        border: {
          DEFAULT: 'rgba(0,0,0,0.08)',
          strong:  'rgba(0,0,0,0.15)',
        },
        brand: {
          DEFAULT: '#003DA5',
          light:   '#1A5BC4',
          amber:   '#C8971D',
          gold:    '#E5B84B',
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
