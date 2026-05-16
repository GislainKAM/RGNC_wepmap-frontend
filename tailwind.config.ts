import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'rgnc-foret': {
          50:  '#EEF6F1',
          100: '#E4EFE9',
          200: '#CDE4D6',
          300: '#92C0A6',
          400: '#5BA37A',
          500: '#2F8855',
          600: '#266E45',
          700: '#1F5D3A',
          800: '#143F26',
          900: '#0E2E1C',
        },
        'rgnc-laterite': {
          50:  '#FDF5EF',
          100: '#FAEAE0',
          200: '#F3D7C6',
          300: '#DDA188',
          400: '#CC7A53',
          500: '#B85729',
          700: '#8E3E1C',
          900: '#5A2410',
        },
        'rgnc-encre': {
          50:  '#EEF1F3',
          100: '#DDE2E5',
          200: '#BFC6CB',
          300: '#9BA5AC',
          400: '#7B8690',
          500: '#5A6770',
          600: '#3D4A53',
          700: '#26343C',
          800: '#182530',
          900: '#0E1B22',
        },
        'rgnc-paper-base':     '#F5F1E8',
        'rgnc-paper-surface':  '#FBFAF6',
        'rgnc-paper-elevated': '#FFFFFF',
        'rgnc-paper-sunken':   '#EDE8DC',
      },
      fontFamily: {
        display: ['var(--font-bricolage)', 'Bricolage Grotesque', 'system-ui', 'sans-serif'],
        body:    ['var(--font-public-sans)', 'Public Sans', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-jetbrains)', 'JetBrains Mono', 'monospace'],
        map:     ['var(--font-ibm-plex)', 'IBM Plex Sans Condensed', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
