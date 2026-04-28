import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["system-ui", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "monospace"],
      },
      colors: {
        gold: {
          DEFAULT: "#d4af37",
          light: "#f4e4bc",
          dark: "#9a7b2a",
          dim: "#6b5a2d",
        },
      },
      boxShadow: {
        gold: "0 0 20px rgba(212, 175, 55, 0.15)",
        "gold-sm": "0 0 10px rgba(212, 175, 55, 0.1)",
      },
      animation: {
        "success-pop": "successPop 0.5s ease-out forwards",
      },
      keyframes: {
        successPop: {
          "0%": { transform: "scale(0.8)", opacity: "0" },
          "50%": { transform: "scale(1.05)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
