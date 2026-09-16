import { Link } from "react-router-dom";
import { FileText, ShieldCheck } from "lucide-react";
import { Navbar } from "../components/layout/Navbar";
import { cn } from "../lib/cn";

// ── Legal pages ─────────────────────────────────────────────────────────────
// Plain-language Terms of Service and Privacy Policy. They describe what the
// code in this repository actually does (see server/src/lib/plans.ts for the
// plan limits and server/src/routes/* for the data flows), so keep them in
// sync when the behaviour changes.

const UPDATED = "September 2026";

export function Legal({ kind }: { kind: "terms" | "privacy" }) {
  const isTerms = kind === "terms";
  return (
    <div className="min-h-screen bg-app">
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 pb-24 pt-28 sm:px-6">
        <p className="sw-eyebrow">Legal</p>
        <h1 className="mt-1 text-3xl font-bold text-fg-strong sm:text-4xl">
          {isTerms ? "Terms of Service" : "Privacy Policy"}
        </h1>
        <p className="mt-2 text-sm text-fg-subtle">Last updated {UPDATED}.</p>

        <nav className="mt-6 flex gap-2" aria-label="Legal documents">
          <DocTab to="/terms" active={isTerms} icon={<FileText className="h-4 w-4" />}>
            Terms
          </DocTab>
          <DocTab to="/privacy" active={!isTerms} icon={<ShieldCheck className="h-4 w-4" />}>
            Privacy
          </DocTab>
        </nav>

        <div className="sw-card sw-card-pad mt-6 space-y-5 leading-relaxed text-fg-muted [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-fg-strong [&_h3]:font-semibold [&_h3]:text-fg [&_li]:mt-1 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
          {isTerms ? <Terms /> : <Privacy />}
        </div>

        <p className="mt-6 text-sm text-fg-subtle">
          Questions about this document?{" "}
          <a href="mailto:hello@soundwave.ai" className="sw-link">
            hello@soundwave.ai
          </a>
          .
        </p>
      </div>
    </div>
  );
}

function DocTab({
  to,
  active,
  icon,
  children,
}: {
  to: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
        active
          ? "border-primary/60 bg-primary/15 font-medium text-fg-strong"
          : "border-border-strong text-fg-muted hover:text-fg-strong",
      )}
    >
      {icon}
      {children}
    </Link>
  );
}

function Terms() {
  return (
    <>
      <p>
        Soundwave AI (“the service”) is an open-source text-to-speech and video toolkit. This document is written in
        plain language on purpose; it is not legal advice and, if you self-host the service, the operator of that
        deployment — not this repository — is the party you are using it through.
      </p>

      <h2>1. Your account</h2>
      <ul>
        <li>You need an account to generate audio, save projects and export video.</li>
        <li>You must be at least 13 years old, and old enough to consent to data processing where you live.</li>
        <li>Keep your password to yourself. You are responsible for activity under your account and should report anything suspicious.</li>
        <li>We may suspend accounts that abuse the service, attack the infrastructure, or break the law.</li>
      </ul>

      <h2>2. Plans, limits and billing</h2>
      <ul>
        <li>
          <strong>Free</strong> — 10,000 characters per month, exports up to 720p with a small watermark, 2 exports per
          hour, projects kept in your browser only.
        </li>
        <li>
          <strong>Pro</strong> — 200,000 characters per month, exports up to 1080p without a watermark, 20 exports per
          hour, unlimited projects with cloud save.
        </li>
        <li>
          <strong>Enterprise</strong> — 2,000,000 characters per month, 4K exports, 100 exports per hour and API keys.
        </li>
        <li>Character quotas reset at the start of each monthly cycle. Unused characters do not roll over.</li>
        <li>Paid plans are billed through our payment provider; you can cancel at any time and keep access until the end of the period you paid for.</li>
      </ul>

      <h2>3. Acceptable use</h2>
      <ul>
        <li>Only upload video, audio and images you have the right to use.</li>
        <li>
          Voice cloning is available only through a self-hosted sidecar and only with the consent of the person whose
          voice it is. Impersonation, fraud, harassment and non-consensual cloning are forbidden.
        </li>
        <li>Do not use the service to produce illegal content, spam, or content that infringes someone else’s rights.</li>
        <li>Do not try to bypass quotas, rate limits or plan restrictions, and do not resell capacity you have not been granted.</li>
        <li>Automated access must go through API keys (Enterprise) and stay within the rate limits.</li>
      </ul>

      <h2>4. Your content</h2>
      <ul>
        <li>You keep all rights to the scripts, audio and video you create.</li>
        <li>
          We need a narrow licence to operate the service: to send your text to the speech engine, to store cloud
          projects you ask us to save, and to render and deliver exports you request.
        </li>
        <li>The application code itself is distributed under the licence in the repository.</li>
      </ul>

      <h2>5. Availability and warranty</h2>
      <ul>
        <li>The service is provided “as is”, without warranties of any kind.</li>
        <li>
          Speech synthesis depends on Microsoft’s Neural voice service and video export depends on FFmpeg on the host.
          Either can be unavailable, and we do not promise uninterrupted or error-free operation.
        </li>
        <li>To the maximum extent permitted by law we are not liable for indirect or consequential losses, or for loss of data you did not save to the cloud.</li>
      </ul>

      <h2>6. Changes and termination</h2>
      <ul>
        <li>We may update these terms; material changes will be announced in the app or by email.</li>
        <li>
          You can delete your account at any time from Settings → Danger zone. Deletion is soft for 30 days (so a
          mistake can be undone), after which the data is removed.
        </li>
      </ul>
    </>
  );
}

function Privacy() {
  return (
    <>
      <p>
        The short version: your script is used to make audio and is not kept, the audio stays in your browser, and the
        only personal data we hold is what an account needs. The detail:
      </p>

      <h2>What we store</h2>
      <ul>
        <li>
          <strong>Account</strong> — name, email address, a bcrypt hash of your password (never the password), your
          plan, an optional avatar, and whether your email is verified. Accounts created through Google sign-in store
          no password at all.
        </li>
        <li>
          <strong>Sessions</strong> — one record per signed-in device: the device’s user-agent string, the IP address
          it signed in from, and its last-active time. Sessions are listed in Settings and can be ended individually.
        </li>
        <li>
          <strong>Usage</strong> — per-generation character counts, voice IDs and audio durations, used to enforce
          monthly quotas and shown to you under Settings → Usage.
        </li>
        <li>
          <strong>Projects</strong> — only when you explicitly save to the cloud (Pro and above). Free plans keep
          projects in this browser.
        </li>
        <li>
          <strong>Billing</strong> — invoices and subscription status if you pay for a plan. Card details never touch
          our servers; they go to the payment provider.
        </li>
        <li>
          <strong>API keys</strong> — a SHA-256 hash and prefix. The key itself is shown once when created and cannot
          be recovered afterwards.
        </li>
      </ul>

      <h2>What we do not store</h2>
      <ul>
        <li>
          <strong>The text you synthesise.</strong> It is sent to the API, rendered to audio and discarded. It is never
          written to the database or to disk.
        </li>
        <li>
          <strong>Your generated audio.</strong> The MP3 is streamed back to your browser. Audio is uploaded to the
          server only when you start a video export, and the temporary render files are deleted when the job finishes.
        </li>
      </ul>

      <h2>Third parties</h2>
      <ul>
        <li>
          <strong>Microsoft Edge Neural voices</strong> — your text is transmitted to Microsoft’s speech service to be
          synthesised. Do not put secrets in a script.
        </li>
        <li>
          <strong>Google OAuth</strong> — only if you choose to sign in with Google; we receive your name, email and
          avatar URL.
        </li>
        <li>
          <strong>Email provider</strong> — your address is used to send verification and password-reset mail.
        </li>
        <li>
          <strong>Payment provider</strong> — only for paid plans.
        </li>
        <li>
          <strong>Voice-clone sidecar</strong> — an optional, self-hosted service. Reference clips and cloned-voice
          audio live on whichever machine runs that sidecar, not on our servers.
        </li>
      </ul>

      <h2>Cookies and browser storage</h2>
      <ul>
        <li>
          <code>access_token</code> and <code>refresh_token</code> are httpOnly cookies that keep you signed in.{" "}
          <code>csrf_token</code> is readable by the app so it can mirror it into a request header — that
          double-submit pair is what blocks cross-site request forgery.
        </li>
        <li>
          We do not run analytics or advertising cookies. The app stores your theme, voice/export preferences and
          locally saved projects in this browser, and it never sends them to the server.
        </li>
        <li>Clearing site data signs you out and removes locally saved projects — export them first if you need them.</li>
      </ul>

      <h2>Your rights</h2>
      <ul>
        <li>
          Export everything we hold: Settings → Usage → “Export my data”, or{" "}
          <code>GET /api/v1/user/data-export</code>.
        </li>
        <li>Delete your account and its data by emailing hello@soundwave.ai or using the API.</li>
        <li>
          Depending on where you live you may also have the right to correct, restrict or object to processing, and to
          complain to your local data-protection authority.
        </li>
      </ul>

      <h2>Security and retention</h2>
      <ul>
        <li>Passwords use bcrypt, tokens are hashed before storage, sessions rotate on refresh, and requests are rate-limited.</li>
        <li>Usage logs are pruned with the account; deleted accounts are hard-deleted after the 30-day recovery window.</li>
        <li>No system is perfect — if you spot a vulnerability, please email us before disclosing it publicly.</li>
      </ul>
    </>
  );
}
