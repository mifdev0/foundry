import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: '#fef7fd',
        'surface-dim': '#ded8dd',
        'surface-bright': '#fef7fd',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f8f2f7',
        'surface-container': '#f2ecf1',
        'surface-container-high': '#ece6ec',
        'surface-container-highest': '#e7e1e6',
        'on-surface': '#1d1b1e',
        'on-surface-variant': '#49454e',
        'inverse-surface': '#322f33',
        'inverse-on-surface': '#f5eff4',
        outline: '#7b757f',
        'outline-variant': '#cbc4cf',
        'surface-tint': '#685589',
        primary: '#000000',
        'on-primary': '#ffffff',
        'primary-container': '#231041',
        'on-primary-container': '#8f7ab1',
        'inverse-primary': '#d4bcf8',
        secondary: '#8127cf',
        'on-secondary': '#ffffff',
        'secondary-container': '#9c48ea',
        'on-secondary-container': '#fffbff',
        tertiary: '#000000',
        'on-tertiary': '#ffffff',
        'tertiary-container': '#2c1602',
        'on-tertiary-container': '#a17d5d',
        error: '#ba1a1a',
        'on-error': '#ffffff',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',
        'primary-fixed': '#ecdcff',
        'primary-fixed-dim': '#d4bcf8',
        'on-primary-fixed': '#231041',
        'on-primary-fixed-variant': '#503d70',
        'secondary-fixed': '#f0dbff',
        'secondary-fixed-dim': '#ddb7ff',
        'on-secondary-fixed': '#2c0051',
        'on-secondary-fixed-variant': '#6900b3',
        'tertiary-fixed': '#ffdcc1',
        'tertiary-fixed-dim': '#e9be9b',
        'on-tertiary-fixed': '#2c1602',
        'on-tertiary-fixed-variant': '#5e4026',
        background: '#fef7fd',
        'on-background': '#1d1b1e',
        'surface-variant': '#e7e1e6'
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "Plus Jakarta Sans", "sans-serif"],
        display: ["Plus Jakarta Sans", "sans-serif"]
      },
      borderRadius: {
        sm: "0.25rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.5rem",
        "2xl": "1.25rem", // Based on DESIGN.md Primary Cards 20px
        full: "9999px"
      },
      boxShadow: {
        ambient: "0 10px 20px rgba(0, 0, 0, 0.03)",
        "soft-ambient": "0 10px 20px rgba(0, 0, 0, 0.03)", // Blur 20, Y 10, Opacity 0.05 approx
        glow: "0 0 24px 4px rgba(129, 39, 207, 0.15)",
        "secondary-glow": "0 10px 30px rgba(129, 39, 207, 0.2)"
      },
      spacing: {
        'card-padding': '24px',
        'sidebar-width': '280px',
        'gutter': '16px',
        'canvas-margin': '40px'
      }
    }
  },
  plugins: []
};

export default config;
