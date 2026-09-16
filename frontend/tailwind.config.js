/**
 * Soundwave AI — Tailwind theme.
 *
 * Every colour resolves to a CSS custom property (`--sw-*`) so the whole UI
 * re-skins at runtime: theme presets, custom accents, radius and density are
 * all applied as variables on <html> (see src/lib/themes.ts + index.css).
 *
 * Channel values are stored as space-separated RGB triplets
 * ("59 130 246") so Tailwind's opacity modifiers keep working —
 * e.g. `bg-primary/10` → `rgb(var(--sw-primary) / 0.1)`.
 *
 * @type {import('tailwindcss').Config}
 */
const rgb = (v) => `rgb(var(--sw-${v}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["class", '[data-appearance="dark"]'],
  theme: {
    extend: {
      colors: {
        // Surfaces & text — semantic names, themed at runtime.
        app: rgb("bg"),
        "app-deep": rgb("bg-deep"),
        surface: {
          DEFAULT: rgb("surface"),
          2: rgb("surface-2"),
          3: rgb("surface-3"),
          inset: rgb("surface-inset"),
        },
        border: {
          DEFAULT: rgb("border"),
          strong: rgb("border-strong"),
        },
        fg: {
          DEFAULT: rgb("fg"),
          strong: rgb("fg-strong"),
          muted: rgb("fg-muted"),
          subtle: rgb("fg-subtle"),
          inverse: rgb("fg-inverse"),
        },
        primary: {
          DEFAULT: rgb("primary"),
          soft: rgb("primary-soft"),
          fg: rgb("primary-fg"),
        },
        accent: {
          DEFAULT: rgb("accent"),
          soft: rgb("accent-soft"),
        },
        success: { DEFAULT: rgb("success"), soft: rgb("success-soft") },
        warning: { DEFAULT: rgb("warning"), soft: rgb("warning-soft") },
        danger: { DEFAULT: rgb("danger"), soft: rgb("danger-soft") },
        info: { DEFAULT: rgb("info"), soft: rgb("info-soft") },
        // Legacy aliases (kept so older markup keeps rendering correctly).
        navy: rgb("bg"),
        panel: rgb("surface"),
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
        display: [
          "Inter",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
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
        card: "var(--sw-radius-card)",
        btn: "var(--sw-radius-btn)",
        input: "var(--sw-radius-input)",
      },
      boxShadow: {
        glow: "0 0 0 1px rgb(var(--sw-primary) / .35), 0 10px 40px -10px rgb(var(--sw-primary) / .5)",
        "glow-accent":
          "0 0 0 1px rgb(var(--sw-accent) / .35), 0 10px 40px -10px rgb(var(--sw-accent) / .5)",
        card: "var(--sw-shadow-card)",
        lift: "var(--sw-shadow-lift)",
        pop: "var(--sw-shadow-pop)",
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, rgb(var(--sw-primary)), rgb(var(--sw-accent)))",
      },
      ringColor: {
        DEFAULT: rgb("ring"),
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
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
        "pulse-ring": {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "70%": { transform: "scale(1.35)", opacity: "0" },
          "100%": { transform: "scale(1.35)", opacity: "0" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      animation: {
        "fade-in": "fade-in .3s ease-in-out",
        "fade-up": "fade-up .4s cubic-bezier(.22,1,.36,1)",
        shimmer: "shimmer 1.6s linear infinite",
        eq1: "eq1 1.1s ease-in-out infinite",
        eq2: "eq2 0.9s ease-in-out infinite",
        eq3: "eq3 1.3s ease-in-out infinite",
        "pulse-ring": "pulse-ring 2s ease-out infinite",
        float: "float 6s ease-in-out infinite",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(.22,1,.36,1)",
      },
    },
  },
  plugins: [],
};
