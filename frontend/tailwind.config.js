/** @type {import('tailwindcss').Config} */

/**
 * Every colour below is a reference to a CSS custom property defined in
 * `src/index.css` for both themes (`[data-theme="dark"]` / `[data-theme="light"]`).
 * Because the variables hold raw RGB channels, Tailwind's opacity modifiers
 * (`bg-accent/10`, `border-line/60`, …) keep working.
 */
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ── Surfaces ──────────────────────────────────────────────────────
        canvas: token("canvas"), // page background
        surface: token("surface"), // cards, panels, sidebar
        raised: token("raised"), // sticky headers, popovers
        sunken: token("sunken"), // inputs, wells

        // ── Lines ─────────────────────────────────────────────────────────
        line: {
          DEFAULT: token("line"),
          strong: token("line-strong"),
          emphasis: token("line-emphasis"),
        },

        // ── Subtle fills (hover states, tracks, off-states) ───────────────
        tint: {
          DEFAULT: token("tint"),
          strong: token("tint-strong"),
        },

        // ── Text ──────────────────────────────────────────────────────────
        fg: {
          DEFAULT: token("fg"),
          soft: token("fg-soft"),
        },
        muted: token("muted"),
        faint: token("faint"),

        // ── Brand ─────────────────────────────────────────────────────────
        accent: {
          DEFAULT: token("accent"),
          strong: token("accent-strong"),
          ink: token("accent-ink"),
        },
        secondary: token("secondary"),

        // ── Status ────────────────────────────────────────────────────────
        success: token("success"),
        danger: token("danger"),
        warning: token("warning"),
        info: token("accent"),

        // ── Neutral ramp (theme aware: text shades invert, surface shades
        //    stay light-on-light / dark-on-dark) ────────────────────────────
        gray: {
          50: token("gray-50"),
          100: token("gray-100"),
          200: token("gray-200"),
          300: token("gray-300"),
          400: token("gray-400"),
          500: token("gray-500"),
          600: token("gray-600"),
          700: token("gray-700"),
          800: token("gray-800"),
          900: token("gray-900"),
          950: token("gray-950"),
        },

        // ── Legacy aliases (kept so older markup keeps working) ───────────
        navy: token("canvas"),
        panel: token("surface"),
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
        "3xl": ["30px", "38px"],
        "4xl": ["36px", "44px"],
        "5xl": ["46px", "54px"],
        "6xl": ["56px", "64px"],
      },
      letterSpacing: {
        snug: "-0.015em",
      },
      borderRadius: {
        card: "12px",
        btn: "8px",
        input: "8px",
      },
      boxShadow: {
        // Soft, low-contrast elevation — no coloured glow anywhere.
        card: "0 1px 2px rgb(var(--c-shadow) / 0.04), 0 6px 20px -14px rgb(var(--c-shadow) / 0.16)",
        pop: "0 1px 2px rgb(var(--c-shadow) / 0.05), 0 18px 40px -20px rgb(var(--c-shadow) / 0.30)",
        inset: "inset 0 1px 2px rgb(var(--c-shadow) / 0.06)",
        glow: "0 1px 2px rgb(var(--c-shadow) / 0.05), 0 10px 30px -18px rgb(var(--c-shadow) / 0.28)",
        "glow-violet":
          "0 1px 2px rgb(var(--c-shadow) / 0.05), 0 10px 30px -18px rgb(var(--c-shadow) / 0.28)",
      },
      transitionTimingFunction: {
        calm: "cubic-bezier(0.4, 0, 0.2, 1)",
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
        eq1: "eq1 1.6s ease-in-out infinite",
        eq2: "eq2 1.4s ease-in-out infinite",
        eq3: "eq3 1.8s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
