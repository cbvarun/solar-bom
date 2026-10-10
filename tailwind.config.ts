import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f7f3", 100: "#dcece2", 200: "#b9d9c6", 300: "#8bbfa1", 400: "#5a9e7a",
          500: "#3b805d", 600: "#2b6649", 700: "#22523c", 800: "#1c4231", 900: "#163527", 950: "#0c1f17",
        },
        solar: { 50: "#fffbea", 100: "#fff3c4", 200: "#fde68a", 300: "#fcd34d", 400: "#f5c02c", 500: "#e0a812", 600: "#b9860b", 700: "#8a630d" },
        ink: { DEFAULT: "#1d2521", muted: "#5b6660", faint: "#8a948f" },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
