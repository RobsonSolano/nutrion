/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // backgrounds em camadas (do mais profundo ao mais elevado)
        bg: {
          DEFAULT: '#07080B',
          deep: '#040507',
          elevated: '#0F1115',
        },
        surface: {
          DEFAULT: '#12141A',
          raised: '#1A1D25',
          muted: '#0B0D12',
        },

        // bordas
        border: {
          DEFAULT: '#1F232B',
          strong: '#2B313C',
          subtle: '#151921',
        },

        // textos
        text: {
          DEFAULT: '#F4F5F7',
          dim: '#A1A6B2',
          muted: '#6B7180',
          inverse: '#0A0B0E',
        },

        // brand (verde neon) e variações
        accent: {
          DEFAULT: '#39FF14',
          soft: '#7BFF5C',
          deep: '#1DB954',
          glow: 'rgba(57,255,20,0.25)',
        },

        // secundário (violeta elétrico) — pra balancear o verde
        violet: {
          DEFAULT: '#8B5CF6',
          soft: '#A78BFA',
          deep: '#6D28D9',
        },

        // estados
        danger: '#F43F5E',
        warn: '#F59E0B',
        info: '#38BDF8',
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
