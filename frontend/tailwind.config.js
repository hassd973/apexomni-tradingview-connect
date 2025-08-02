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
        muted: '#64748b'
      },
      backdropBlur: {
        xs: '2px'
      }
    }
  },
  plugins: []
};
