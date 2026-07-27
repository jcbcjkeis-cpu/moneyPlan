/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        husband: '#3B82F6',
        wife: '#F43F5E',
        joint: '#9333EA',
      }
    },
  },
  plugins: [],
}