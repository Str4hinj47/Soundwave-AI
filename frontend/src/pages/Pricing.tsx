import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Minus } from "lucide-react";
import { Navbar } from "../components/layout/Navbar";
import { cn } from "../lib/cn";

interface FeatureRow {
  label: string;
  free: string | boolean;
  pro: string | boolean;
  enterprise: string | boolean;
}

const FEATURES: FeatureRow[] = [
  { label: "Characters per month", free: "10,000", pro: "200,000", enterprise: "2,000,000" },
  { label: "Microsoft Neural voices", free: "All 6", pro: "All 6", enterprise: "All 6" },
  { label: "Subtitle fonts & presets", free: "All", pro: "All", enterprise: "All" },
  { label: "Video export resolution", free: "720p", pro: "Up to 1080p", enterprise: "Up to 4K" },
  { label: "Portrait 9:16 export", free: true, pro: true, enterprise: true },
  { label: "Exports per hour", free: "2", pro: "20", enterprise: "100" },
  { label: "Watermark", free: "Yes", pro: "No", enterprise: "No" },
  { label: "Project storage", free: "Up to 50 in this browser", pro: "Unlimited + cloud save", enterprise: "Unlimited + cloud save" },
  { label: "YouTube background import", free: true, pro: true, enterprise: true },
  { label: "Voice cloning (self-hosted sidecar)", free: "Optional", pro: "Optional", enterprise: "Optional" },
  { label: "API access", free: false, pro: false, enterprise: "API keys" },
  { label: "Dedicated support", free: false, pro: false, enterprise: true },
];

const FAQS = [
  {
    q: "Why is the character limit higher than other TTS tools?",
    a: "Microsoft Neural voices are rendered on our servers with no model downloads and no GPU required on your device, so the cost per character stays low — and we pass that on to you.",
  },
  {
    q: "What happens to my script and my audio?",
    a: "Your text is sent to our API only to synthesise the audio, and it is never stored. The MP3 that comes back stays in your browser. Audio is uploaded to our servers only when you explicitly start a video export, and the temporary files are deleted once the render finishes.",
  },
  {
    q: "What happens if I exceed my character limit?",
    a: "Generation is paused until your quota resets at the start of the next cycle — or you can upgrade to continue immediately. Usage is counted per character of text you submit for synthesis.",
  },
  {
    q: "Do I need to install or download anything?",
    a: "No. Voices are synthesised on our servers with Microsoft Neural voices and streamed straight to your browser. Video export needs FFmpeg on the machine running the API — the Docker image and the repo both ship it.",
  },
  {
    q: "Can I change how the app looks?",
    a: "Yes — seven built-in themes, a custom accent colour, corner radius and density are all available under Settings → Appearance, and they apply instantly to the whole workspace.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from the billing portal at any time. Your access continues until the end of the billing period.",
  },
];

function Cell({ value }: { value: string | boolean }) {
  if (value === false) return <Minus className="mx-auto h-4 w-4 text-fg-subtle" />;
  if (value === true) return <Check className="mx-auto h-5 w-5 text-success" />;
  return <span className="text-sm text-fg-muted">{value}</span>;
}

export function Pricing() {
  const [annual, setAnnual] = useState(false);

  const plans = [
    {
      name: "Free",
      monthly: 0,
      desc: "For trying things out.",
      cta: "Get Started",
      to: "/signup",
      highlight: false,
      badge: null,
    },
    {
      name: "Pro",
      monthly: 12,
      desc: "For creators shipping voice content.",
      cta: "Subscribe Now",
      to: "/signup",
      highlight: true,
      badge: "MOST POPULAR",
    },
    {
      name: "Enterprise",
      monthly: 39,
      desc: "For teams at scale.",
      cta: "Contact Sales",
      to: "/signup",
      highlight: false,
      badge: "BEST VALUE",
    },
  ];

  return (
    <div className="min-h-screen bg-app">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-32 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-fg-strong sm:text-5xl">Simple, honest pricing</h1>
          <p className="mx-auto mt-4 max-w-xl text-fg-muted">
            Neural synthesis, subtitle rendering and video export all run on our infrastructure — you only pay for the
            volume and quality you actually need.
          </p>

          <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-border-strong bg-surface p-1">
            <button
              onClick={() => setAnnual(false)}
              aria-pressed={!annual}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                !annual ? "bg-surface-3 text-fg-strong" : "text-fg-muted hover:text-fg",
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              aria-pressed={annual}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                annual ? "bg-surface-3 text-fg-strong" : "text-fg-muted hover:text-fg",
              )}
            >
              Annual <span className="text-success">−20%</span>
            </button>
          </div>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {plans.map((p) => {
            const price = annual ? p.monthly * 0.8 : p.monthly;
            return (
              <div
                key={p.name}
                className={cn(
                  "relative rounded-card border p-7",
                  p.highlight
                    ? "border-primary/50 bg-surface shadow-glow lg:scale-[1.03]"
                    : "border-border bg-surface shadow-card",
                )}
              >
                {p.badge && (
                  <div
                    className={cn(
                      "absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-semibold text-fg-strong",
                      p.highlight ? "bg-gradient-to-r from-primary to-accent" : "bg-surface-3",
                    )}
                  >
                    {p.badge}
                  </div>
                )}
                <p className="text-lg font-semibold text-fg-strong">{p.name}</p>
                <p className="mt-1 min-h-[2.5rem] text-sm text-fg-muted">{p.desc}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-fg-strong">${price.toFixed(price % 1 === 0 ? 0 : 2)}</span>
                  <span className="text-fg-subtle">/month</span>
                </div>
                {annual && p.monthly > 0 && (
                  <p className="mt-1 text-xs text-success">Billed annually (${(price * 12).toFixed(0)}/yr)</p>
                )}
                <Link
                  to={p.to}
                  className={cn(
                    "mt-6 inline-flex h-11 w-full items-center justify-center rounded-btn font-semibold transition-all duration-200",
                    p.highlight
                      ? "bg-gradient-to-r from-primary to-accent text-fg-strong hover:brightness-110"
                      : "border border-border-strong text-fg hover:border-primary/70 hover:text-fg-strong",
                  )}
                >
                  {p.cta}
                </Link>
              </div>
            );
          })}
        </div>

        {/* Feature comparison */}
        <div className="mt-16 overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-4 text-sm font-medium text-fg-muted">Feature</th>
                {["Free", "Pro", "Enterprise"].map((n) => (
                  <th key={n} className="px-5 py-4 text-center text-sm font-semibold text-fg-strong">{n}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f) => (
                <tr key={f.label} className="border-b border-border last:border-0">
                  <td className="px-5 py-3.5 text-sm text-fg-muted">{f.label}</td>
                  <td className="px-5 py-3.5 text-center"><Cell value={f.free} /></td>
                  <td className="px-5 py-3.5 text-center bg-primary/5"><Cell value={f.pro} /></td>
                  <td className="px-5 py-3.5 text-center"><Cell value={f.enterprise} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* FAQ */}
        <div className="mx-auto mt-16 max-w-3xl">
          <h2 className="text-center text-3xl font-bold text-fg-strong">Frequently asked questions</h2>
          <div className="mt-8 space-y-3">
            {FAQS.map((f) => (
              <FaqItem key={f.q} q={f.q} a={f.a} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="font-medium text-fg-strong">{q}</span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-fg-muted transition-transform duration-200", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <p className="px-5 pb-4 text-sm leading-relaxed text-fg-muted">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
