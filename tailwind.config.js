/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      animation: {
        'translate-top': 'translate-top 0.5s ease-in-out 0s 1 normal forwards',
        'translate-bottom-with-bounce': 'translate-bottom-with-bounce 1s ease-in-out 0s normal forwards',
      },

      keyframes: {
        'translate-top': {
          '0%': { transform: 'translateY(0)' },
          '100%': { transform: 'translateY(-15%)' },
        },
        'translate-bottom-with-bounce': {
          '0%': { transform: 'translateY(-15%)' },
          '40%': { transform: 'translateY(4%)' },
          '75%': { transform: 'translateY(-5%)' },
          '100%': { transform: 'translateY(0%)' },
        },
      },
    },
  },
  plugins: [],
}
