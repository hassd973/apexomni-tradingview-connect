module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        navy: '#0a0e17',
        carbon: '#1c1f23',
        accent: '#38bdf8',
        muted: '#64748b',
        green: {
          300: '#00FF00',
          400: '#00FF00',
          500: '#00FF00',
          DEFAULT: '#00FF00'
        },
        brand: {
          light: 'var(--green-light)',
          DEFAULT: 'var(--green)',
          dark: 'var(--green-dark)'
        }
      },
      backdropBlur: {
        xs: '2px'
      }
    }
  },
  plugins: []
};
