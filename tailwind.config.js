/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#00684A",
        secondary: "#023430",
        accent: "#00ED64",
        dark: "#001E2B",
        light: "#E3FCF7"
      }
    },
  },
  plugins: [],
}

