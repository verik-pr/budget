import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-schibsted)", "system-ui", "sans-serif"],
        serif: ["var(--font-fraunces)", "Georgia", "serif"],
      },
      colors: {
        paper: "#f6f1e8",
        card: "#fffdf9",
        rule: "#e7dfd1",
        ink: "#1c1916",
        inkPanel: "#171411",
        inkSoft: "#4a443c",
        muted: "#8d8474",
        faint: "#b3a995",
        pine: "#16734a",
        pineDark: "#0f5a39",
        pineSoft: "#e3eee5",
        cream: "#f3ead9",
        blood: "#c2453a",
      },
      boxShadow: {
        card: "0 1px 2px rgba(28,25,22,0.04), 0 4px 16px rgba(28,25,22,0.05)",
        fab: "0 6px 20px rgba(22,115,74,0.35), 0 2px 6px rgba(22,115,74,0.25)",
        navbar: "0 -1px 0 rgba(28,25,22,0.06), 0 12px 32px rgba(28,25,22,0.16)",
      },
    },
  },
  plugins: [],
}

export default config
