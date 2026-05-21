import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "midnight-sky": "#0D141E",
        "slate-canvas": "#1A2332",
        "clean-border": "#2E3C50",
        "refreshing-teal": "#2DD4BF",
        "dawn-gold": "#FBBF24",
        "starlight-text": "#F8FAFC",
        "coral-danger": "#F43F5E",
        "muted-text": "#8A9BB0",
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'sans-serif'],
        display: ['"Source Sans 3"', 'sans-serif'],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
    },
  },
  plugins: [],
};

export default config;