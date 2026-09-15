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
  { label: "Voices", free: "All 6 voices", pro: "All voices + future", enterprise: "All voices + future" },
  { label: "Subtitle styling", free: "Basic (3 fonts)", pro: "Full (20+ fonts)", enterprise: "Full + shared presets" },
  { label: "Video export resolution", free: "720p", pro: "Up to 1080p", enterprise: "Up to 4K" },
  { label: "Watermark", free: "Yes", pro: "No", enterprise: "No" },
  { label: "Projects", free: "3 local", pro: "Unlimited + cloud save", enterprise: "Unlimited + cloud save" },
  { label: "Export queue", free: "Standard", pro: "Priority", enterprise: "Priority" },
  { label: "API access", free: false, pro: false, enterprise: "Video export API" },
  { label: "Dedicated support", free: false, pro: false, enterprise: true },
  { label: "SSO", free: false, pro: false, enterprise: "Coming soon" },
];

const FAQS = [
  {
    q: "Why is the character limit higher than other TTS tools?",
    a: "Microsoft Neural voices are generated securely on our servers with no model downloads or GPU required on your device, so the cost per character stays low and we pass that on to you.",
  },
  {
    q: "Where is my audio generated?",
    a: "Audio is synthesized on our servers using Microsoft Neural voices (24 kHz MP3). Your text is used only to synthesize the audio and is never stored. Audio is streamed back to your browser for download, and only uploaded again if you explicitly initiate a video export where FFmpeg composites it with your background video and subtitles.",
  },
  {
    q: "What happens if I exceed my character limit?",
    a: "Generation is paused until the next billing cycle, or you can upgrade your plan to continue immediately. The limit is enforced server-side before synthesis.",
  },
  {
    q: "Do I need to install or download anything?",
    a: "No. Voices are synthesized on our servers with Microsoft Neural voices and streamed straight to your browser — no model downloads, no GPU, no API keys.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from the billing portal at any time. Your access continues until the end of the billing period.",
  },
];

function Cell({ value }: { value: string | boolean }) {
  if (value === false) return <Minus className="mx-auto h-4 w-4 text-faint" />;
  if (value === true) return <Check className="mx-auto h-5 w-5 text-success" />;
  return <span className="text-sm text-fg-soft">{value}</span>;
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
    <div className="min-h-screen bg-canvas">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-32 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl font-semibold text-fg sm:text-5xl">Simple, honest pricing</h1>
          <p className="mx-auto mt-4 max-w-xl text-muted">
            We run Microsoft Neural voices on our servers — no setup for you. You pay for characters, storage, video rendering, and pro features.
          </p>

          <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-line-strong bg-surface p-1">
            <button
              onClick={() => setAnnual(false)}
              className={cn("rounded-full px-4 py-1.5 text-sm font-medium transition-all", !annual ? "bg-tint text-fg" : "text-muted")}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={cn("rounded-full px-4 py-1.5 text-sm font-medium transition-all", annual ? "bg-tint text-fg" : "text-muted")}
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
                    ? "border-line bg-surface shadow-card"
                    : "border-line bg-surface",
                )}
              >
                {p.badge && (
                  <div
                    className={cn(
                      "absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-xs font-medium tracking-wide",
                      p.highlight ? "bg-accent text-accent-ink" : "bg-tint text-fg-soft",
                    )}
                  >
                    {p.badge}
                  </div>
                )}
                <p className="text-lg font-semibold text-fg">{p.name}</p>
                <p className="mt-1 min-h-[2.5rem] text-sm text-muted">{p.desc}</p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-5xl font-semibold tracking-snug text-fg">${price.toFixed(price % 1 === 0 ? 0 : 2)}</span>
                  <span className="text-faint">/month</span>
                </div>
                {annual && p.monthly > 0 && (
                  <p className="mt-1 text-xs text-success">Billed annually (${(price * 12).toFixed(0)}/yr)</p>
                )}
                <Link
                  to={p.to}
                  className={cn(
                    "mt-6 inline-flex h-11 w-full items-center justify-center rounded-btn font-semibold transition-all duration-200",
                    p.highlight
                      ? "bg-accent text-accent-ink hover:bg-accent-strong"
                      : "border border-line-emphasis text-fg-soft hover:border-accent/70 hover:text-fg",
                  )}
                >
                  {p.cta}
                </Link>
              </div>
            );
          })}
        </div>

        {/* Feature comparison */}
        <div className="mt-16 overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="border-b border-line">
                <th className="px-5 py-4 text-sm font-medium text-muted">Feature</th>
                {["Free", "Pro", "Enterprise"].map((n) => (
                  <th key={n} className="px-5 py-4 text-center text-sm font-semibold text-fg">{n}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f) => (
                <tr key={f.label} className="border-b border-line/60 last:border-0">
                  <td className="px-5 py-3.5 text-sm text-fg-soft">{f.label}</td>
                  <td className="px-5 py-3.5 text-center"><Cell value={f.free} /></td>
                  <td className="px-5 py-3.5 text-center bg-accent/5"><Cell value={f.pro} /></td>
                  <td className="px-5 py-3.5 text-center"><Cell value={f.enterprise} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* FAQ */}
        <div className="mx-auto mt-16 max-w-3xl">
          <h2 className="text-center text-3xl font-semibold text-fg">Frequently asked questions</h2>
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
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="font-medium text-fg">{q}</span>
        <ChevronDown className={cn("h-5 w-5 shrink-0 text-muted transition-transform duration-200", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <p className="px-5 pb-4 text-sm leading-relaxed text-muted">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
