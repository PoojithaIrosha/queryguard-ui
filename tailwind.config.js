/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0f172a",
        surface: "#111827",
        border: "#1f2937",
        text: "#e5e7eb",
        muted: "#9ca3af",

        primary: "#10b981",
        danger: "#ef4444",
      }
    },
  },
  plugins: [],
}

