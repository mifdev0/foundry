import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#F8F7FF",
        surface: "#FAF8FF",
        "surface-lowest": "#FFFFFF",
        "surface-low": "#F2F3FF",
        "surface-container": "#EAEDFF",
        "surface-high": "#E2E7FF",
        "surface-highest": "#DAE2FD",
        "on-surface": "#131B2E",
        "on-variant": "#4A4455",
        outline: "#7B7487",
        "outline-variant": "#CCC3D8",
        primary: "#630ED4",
        "primary-container": "#7C3AED",
        success: "#10B981",
        warning: "#F59E0B"
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
        geist: ["var(--font-geist)", "Geist", "sans-serif"]
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem"
      },
      boxShadow: {
        ambient: "0 10px 25px -8px rgba(31, 41, 55, 0.16)",
        glow: "0 0 24px 4px rgba(124, 58, 237, 0.24)"
      }
    }
  },
  plugins: []
};

export default config;
