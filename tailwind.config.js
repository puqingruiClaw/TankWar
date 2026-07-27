/** @type {import('tailwindcss').Config} */

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    container: {
      center: true,
    },
    extend: {
      colors: {
        stage: '#000000',
        surface: '#1a1a1a',
        muted: '#4a4a4a',
        outline: '#8a8a8a',
        tank: {
          player: '#e6e62e',
          player2: '#3ab34a',
          enemyBasic: '#d9d9d9',
          enemyFast: '#f2b431',
          enemyPower: '#8a8a8a',
          enemyArmor: '#c65fbf',
        },
        terrain: {
          brick: '#b34a20',
          brickShadow: '#5c2610',
          steel: '#8a8a8a',
          steelShadow: '#3a3a3a',
          water: '#3c6bf0',
          waterHi: '#7fa8ff',
          grass: '#5fbb1e',
          ice: '#c3e8ff',
          base: '#e6e62e',
        },
        hud: {
          bg: '#8a8a8a',
          text: '#000000',
          accent: '#e6e62e',
          danger: '#d63a2f',
        },
      },
      fontFamily: {
        pixel: [
          '"Press Start 2P"',
          '"VT323"',
          '"Zpix"',
          '"ZCOOL KuaiLe"',
          'ui-monospace',
          'Menlo',
          'monospace',
        ],
        display: ['"Press Start 2P"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'pixel-xs': ['8px', { lineHeight: '10px', letterSpacing: '0.02em' }],
        'pixel-sm': ['10px', { lineHeight: '14px', letterSpacing: '0.02em' }],
        'pixel-base': ['12px', { lineHeight: '16px', letterSpacing: '0.04em' }],
        'pixel-lg': ['16px', { lineHeight: '20px', letterSpacing: '0.06em' }],
        'pixel-xl': ['24px', { lineHeight: '28px', letterSpacing: '0.08em' }],
        'pixel-2xl': ['32px', { lineHeight: '36px', letterSpacing: '0.1em' }],
        'pixel-3xl': ['48px', { lineHeight: '52px', letterSpacing: '0.12em' }],
      },
      spacing: {
        tile: '32px',
        'tile-2': '64px',
        'tile-4': '128px',
        stage: '640px',
        'stage-h': '480px',
        canvas: '416px',
        hud: '224px',
      },
      width: {
        stage: '640px',
        canvas: '416px',
        hud: '224px',
      },
      height: {
        stage: '480px',
        canvas: '416px',
      },
      boxShadow: {
        pixel: '0 0 0 2px #000000, 0 0 0 4px #e6e62e',
        'pixel-inset': 'inset 0 0 0 2px #000000, inset 0 0 0 4px #8a8a8a',
        'pixel-danger': '0 0 0 2px #000000, 0 0 0 4px #d63a2f',
        'pixel-soft': '2px 2px 0 0 #000000',
      },
      keyframes: {
        blink: {
          '0%, 49%': { opacity: '1' },
          '50%, 100%': { opacity: '0' },
        },
        'pixel-pulse': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.04)' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      animation: {
        blink: 'blink 1s steps(1, end) infinite',
        'blink-fast': 'blink 400ms steps(1, end) infinite',
        'pixel-pulse': 'pixel-pulse 1.2s ease-in-out infinite',
        scanline: 'scanline 8s linear infinite',
      },
    },
  },
  plugins: [],
}
