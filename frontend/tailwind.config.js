/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#0A0F1C",
        panel: "#111827",
        accent: {
          DEFAULT: "#3B82F6",
          violet: "#8B5CF6",
        },
        success: "#10B981",
        danger: "#EF4444",
        warning: "#F59E0B",
      },
      fontFamily: {
        sans: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      fontSize: {
        // Strict type scale — 12/14/16/18/20/24/30/36/48/60
        xs: ["12px", "16px"],
        sm: ["14px", "20px"],
        base: ["16px", "24px"],
        lg: ["18px", "28px"],
        xl: ["20px", "28px"],
        "2xl": ["24px", "32px"],
        "3xl": ["30px", "36px"],
        "4xl": ["36px", "44px"],
        "5xl": ["48px", "56px"],
        "6xl": ["60px", "68px"],
      },
      borderRadius: {
        card: "8px",
        btn: "6px",
        input: "4px",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(59,130,246,.35), 0 8px 40px -8px rgba(59,130,246,.35)",
        "glow-violet":
          "0 0 0 1px rgba(139,92,246,.35), 0 8px 40px -8px rgba(139,92,246,.35)",
        card: "0 1px 2px rgba(0,0,0,.5), 0 8px 24px -12px rgba(0,0,0,.6)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        eq1: {
          "0%,100%": { transform: "scaleY(0.3)" },
          "50%": { transform: "scaleY(1)" },
        },
        eq2: {
          "0%,100%": { transform: "scaleY(0.7)" },
          "50%": { transform: "scaleY(0.25)" },
        },
        eq3: {
          "0%,100%": { transform: "scaleY(0.45)" },
          "50%": { transform: "scaleY(0.9)" },
        },
      },
      animation: {
        "fade-in": "fade-in .3s ease-in-out",
        shimmer: "shimmer 1.6s linear infinite",
        eq1: "eq1 1.1s ease-in-out infinite",
        eq2: "eq2 0.9s ease-in-out infinite",
        eq3: "eq3 1.3s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
