/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        sidebar: {
          bg: "#13102A",
          surface: "#1A1635",
          border: "#2A2550",
          text: "#F1EEFF",
          sub: "#A89FC8",
          muted: "#6B5F8F",
        },
        accent: {
          DEFAULT: "#5B21B6",
          light: "#7C3AED",
        },
        gold: {
          DEFAULT: "#B45309",
          vivid: "#D97706",
        },
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        serif: ["Georgia", "serif"],
      },
      borderRadius: {
        card: "16px",
        button: "10px",
        pill: "20px",
      },
      width: {
        sidebar: "230px",
      },
    },
  },
  plugins: [],
};
