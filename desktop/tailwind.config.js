/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Themeable palette — driven by CSS variables (see src/index.css).
        panel: "var(--panel)",
        card: "rgb(var(--card-rgb) / <alpha-value>)",
        sunken: "rgb(var(--sunken-rgb) / <alpha-value>)",
        ink: "rgb(var(--ink-rgb) / <alpha-value>)",
        muted: "var(--muted)",
        faint: "rgb(var(--faint-rgb) / <alpha-value>)",
        line: "var(--line)",
        accent: "rgb(var(--accent-rgb) / <alpha-value>)",
        "accent-ink": "var(--accent-ink)",
        "accent-soft": "var(--accent-soft)",
        good: "rgb(var(--good-rgb) / <alpha-value>)",
        wall: "var(--wall)",
        "wall-2": "var(--wall-2)",
      },
      fontFamily: {
        sans: [
          "ui-rounded",
          "SF Pro Rounded",
          "Inter",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        panel: "0 40px 80px -24px rgba(28, 20, 10, 0.45), 0 12px 28px -12px rgba(28, 20, 10, 0.35)",
        card: "0 1px 2px rgba(38, 30, 18, 0.06), 0 4px 14px -6px rgba(38, 30, 18, 0.12)",
        pill: "0 2px 8px -2px rgba(38, 30, 18, 0.18)",
      },
      keyframes: {
        blink: {
          "0%, 92%, 100%": { transform: "scaleY(1)" },
          "95%": { transform: "scaleY(0.08)" },
          "97%": { transform: "scaleY(1)" },
        },
        glance: {
          "0%, 38%, 100%": { transform: "translateX(0)" },
          "44%, 58%": { transform: "translateX(3.5px)" },
          "66%, 78%": { transform: "translateX(-3.5px)" },
        },
        bob: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
        talkbar: {
          "0%, 100%": { transform: "scaleY(0.35)" },
          "50%": { transform: "scaleY(1)" },
        },
        ringpulse: {
          "0%": { transform: "scale(0.92)", opacity: "0.7" },
          "100%": { transform: "scale(1.35)", opacity: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        blink: "blink 5.5s ease-in-out infinite",
        glance: "glance 7s ease-in-out infinite",
        bob: "bob 3.6s ease-in-out infinite",
        "fade-in": "fade-in 0.25s ease-out both",
      },
    },
  },
  plugins: [],
};
