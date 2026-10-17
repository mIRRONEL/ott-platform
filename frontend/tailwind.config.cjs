/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./index.html"],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        display: ['"Bebas Neue"', '"Outfit"', 'Impact', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308', // Sonalu Golden Yellow
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
          sonalu: '#eab308',
          neon: '#a3e635', // Sonalu Chartreuse / Lime Green
          lime: '#84cc16',
          yellow: '#facc15',
          emerald: '#10b981',
          netflix: '#e50914',
          rose: '#f43f5e',
          amber: '#f59e0b',
        },
        dark: {
          950: '#050a06', // Deep forest obsidian background
          900: '#0a140d',
          850: '#0f1e13',
          800: '#142719',
          750: '#1a3321',
          700: '#25472e',
          600: '#345e3f',
        },
        primary: '#eab308',
        secondary: '#a3e635',
      },
      boxShadow: {
        'glow-sm': '0 0 15px rgba(234, 179, 8, 0.3)',
        'glow': '0 0 30px rgba(234, 179, 8, 0.4), 0 0 50px rgba(163, 230, 53, 0.25)',
        'glow-lime': '0 0 30px rgba(163, 230, 53, 0.4)',
        'glow-lg': '0 0 50px rgba(250, 204, 21, 0.5), 0 0 80px rgba(132, 204, 22, 0.3)',
        'glow-netflix': '0 0 30px rgba(229, 9, 20, 0.4)',
        'card-hover': '0 12px 35px -5px rgba(0, 0, 0, 0.9), 0 0 25px rgba(163, 230, 53, 0.25)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: 0.4, transform: 'scale(1)' },
          '50%': { opacity: 0.8, transform: 'scale(1.05)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'pulse-glow': 'pulseGlow 4s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s infinite',
      }
    },
  },
  plugins: [],
}

