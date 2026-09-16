import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  CreditCard,
  Database,
  Download,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  User,
} from "lucide-react";
import { useAuth } from "../store/auth";
import { toast } from "../store/toast";
import { http } from "../lib/api";
import { cn } from "../lib/cn";
import { formatBytes, formatNumber } from "../lib/format";
import { PLANS, type Plan } from "../lib/plans";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";
import { Select } from "../components/ui/Select";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { ThemeCustomizer } from "../components/theme/ThemePicker";
import { Tabs } from "../components/ui/Tabs";
import { idbClear, idbUsage } from "../lib/idb";
import { DEFAULT_VOICES } from "../lib/voices";
import {
  getAutoPlay,
  getDefaultAspect,
  getDefaultVoice,
  getExportQuality,
  setAutoPlay,
  setDefaultAspect,
  setDefaultVoice,
  setExportQuality,
  type Aspect,
  type ExportQuality,
} from "../lib/preferences";

const TABS = [
  { id: "profile", label: "Profile", icon: <User className="h-4 w-4" />, path: "" },
  { id: "appearance", label: "Appearance", icon: <Palette className="h-4 w-4" />, path: "/appearance" },
  { id: "preferences", label: "Preferences", icon: <SlidersHorizontal className="h-4 w-4" />, path: "/preferences" },
  { id: "billing", label: "Billing", icon: <CreditCard className="h-4 w-4" />, path: "/billing" },
];

export function Settings() {
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshQuota } = useAuth();
  const active =
    TABS.find((t) => t.path && location.pathname.replace(/\/$/, "").endsWith(t.path))?.id ?? "profile";

  useEffect(() => {
    void refreshQuota();
  }, [refreshQuota]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold text-fg-strong">Settings</h1>
      <p className="mt-1 text-sm text-fg-muted">Manage your account, appearance, billing and preferences.</p>

      <Tabs
        tabs={TABS.map((t) => ({ id: t.id, label: t.label, icon: t.icon }))}
        active={active}
        onChange={(id) => navigate(`/settings${TABS.find((t) => t.id === id)?.path ?? ""}`)}
        className="mt-6"
      />

      <div className="mt-6 space-y-5">
        {active === "profile" && <ProfileTab />}
        {active === "appearance" && <AppearanceTab />}
        {active === "preferences" && <PreferencesTab />}
        {active === "billing" && <BillingTab />}
      </div>
    </div>
  );
}

// ── Profile ─────────────────────────────────────────────────────────────────
function ProfileTab() {
  const { user, setUser, loadSession, signOut } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePass, setDeletePass] = useState("");
  const [deleting, setDeleting] = useState(false);

  // The session resolves asynchronously, so seed the field from the store
  // whenever the user arrives (previously it stayed empty until a reload).
  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user?.name]);

  const saveProfile = async () => {
    if (name.trim().length < 2) {
      toast.error("Name too short", "Enter at least 2 characters.");
      return;
    }
    setSaving(true);
    try {
      const updated = await http.put<{ id: string; name: string; email: string; plan: Plan; avatarUrl: string | null; emailVerified: boolean }>(
        "/user/profile",
        { name: name.trim() },
      );
      setUser(updated);
      toast.success("Profile updated");
    } catch (e) {
      toast.error("Update failed", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (next !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    if (next.length < 8 || !/[a-z]/.test(next) || !/[A-Z]/.test(next) || !/[0-9]/.test(next) || !/[^A-Za-z0-9]/.test(next)) {
      toast.error("Weak password", "Use 8+ characters with upper, lower, number and symbol.");
      return;
    }
    setPwSaving(true);
    try {
      await http.put("/user/password", { currentPassword: current, newPassword: next });
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Password changed", "All other sessions were signed out.");
      await loadSession();
    } catch (e) {
      toast.error("Change failed", (e as Error).message);
    } finally {
      setPwSaving(false);
    }
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      await http.del("/user/account", { password: deletePass });
      setDeleteOpen(false);
      toast.success("Account deleted", "We keep your data for 30 days in case you change your mind.");
      await signOut();
      navigate("/");
    } catch (e) {
      toast.error("Delete failed", (e as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const signOutOthers = async () => {
    try {
      await http.del("/auth/sessions");
      toast.success("Signed out", "All other sessions have been signed out.");
      await loadSession();
    } catch (e) {
      toast.error("Failed", (e as Error).message);
    }
  };

  const verified = user?.emailVerified;

  return (
    <>
      <Card title="Profile" icon={<User className="h-4 w-4" />}>
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-xl font-bold text-primary-fg">
            {(user?.name ?? "U")
              .split(" ")
              .map((p) => p[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-fg-strong">{user?.name}</p>
            <p className="truncate text-sm text-fg-subtle">{user?.email}</p>
          </div>
          <Badge tone={verified ? "green" : "amber"} dot>
            {verified ? "Email verified" : "Email unverified"}
          </Badge>
        </div>
        <div className="mt-5 space-y-4">
          <TextField label="Full name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          <TextField label="Email" value={user?.email ?? ""} disabled hint="Email changes require re-verification." />
          <Button onClick={saveProfile} loading={saving} disabled={!user}>
            Save changes
          </Button>
        </div>
      </Card>

      <Card title="Change password" icon={<ShieldCheck className="h-4 w-4" />}>
        <div className="space-y-4">
          <TextField label="Current password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          <TextField label="New password" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          <TextField
            label="Confirm new password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            error={confirm.length > 0 && confirm !== next ? "Passwords don't match." : undefined}
          />
          <Button onClick={changePassword} loading={pwSaving} variant="outline" disabled={!current || !next}>
            Update password
          </Button>
          <div className="border-t border-border pt-4">
            <p className="text-sm text-fg-muted">Sign out of all other devices:</p>
            <Button onClick={signOutOthers} variant="outline" className="mt-2">
              Sign out other sessions
            </Button>
          </div>
        </div>
      </Card>

      <Card title="Danger zone" icon={<Trash2 className="h-4 w-4" />} className="border-danger/30">
        <p className="text-sm text-fg-muted">
          Deleting your account removes your cloud projects. We keep a 30-day recovery window.
        </p>
        <Button variant="danger" className="mt-3" onClick={() => setDeleteOpen(true)}>
          Delete account
        </Button>
      </Card>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete account"
        description="This action is permanent after the 30-day recovery period."
      >
        <div className="space-y-4">
          <TextField label="Confirm with your password" type="password" value={deletePass} onChange={(e) => setDeletePass(e.target.value)} />
          <Button fullWidth variant="danger" onClick={deleteAccount} loading={deleting} disabled={!deletePass}>
            Permanently delete my account
          </Button>
        </div>
      </Modal>
    </>
  );
}

// ── Appearance (themes) ─────────────────────────────────────────────────────
function AppearanceTab() {
  return (
    <Card title="Appearance" icon={<Palette className="h-4 w-4" />}>
      <p className="mb-5 text-sm text-fg-muted">
        Pick a theme, accent colour, corner radius and density. Your choice is saved in this browser and applies
        instantly everywhere — no reload needed.
      </p>
      <ThemeCustomizer />
    </Card>
  );
}

// ── Billing ─────────────────────────────────────────────────────────────────
function BillingTab() {
  const { user, quota, setUser, refreshQuota } = useAuth();
  const [changing, setChanging] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  // Whether this deployment allows switching plans without a payment provider
  // (dev/demo). Production deployments answer false and route through Stripe.
  const [demoSwitch, setDemoSwitch] = useState<boolean | null>(null);
  const plan = user?.plan ?? "FREE";
  const planDef = PLANS[plan];
  const used = quota?.used ?? 0;
  const limit = quota?.limit ?? planDef.characterLimit;
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

  useEffect(() => {
    void http
      .get<{ demoPlanSwitch?: boolean }>("/billing/plans")
      .then((r) => setDemoSwitch(Boolean(r.demoPlanSwitch)))
      .catch(() => setDemoSwitch(false));
  }, []);

  const applyPlan = async (p: "PRO" | "ENTERPRISE") => {
    setChanging(true);
    try {
      const res = await http.post<{ user: { id: string; plan: Plan; name: string; email: string } }>("/billing/apply-plan", {
        plan: p,
        billing: "monthly",
      });
      setUser({ ...(user!), plan: res.user.plan });
      await refreshQuota();
      toast.success(`Plan changed to ${p}`, "In production this goes through Stripe Checkout.");
    } catch (e) {
      toast.error("Plan change failed", (e as Error).message);
    } finally {
      setChanging(false);
    }
  };

  const openPortal = async () => {
    setCheckoutLoading(true);
    try {
      const res = await http.post<{ url?: string }>("/billing/create-portal");
      if (res?.url) window.location.assign(res.url);
      else toast.info("Billing portal unavailable", "Stripe is not configured on this deployment.");
    } catch (e) {
      toast.error("Billing portal unavailable", (e as Error).message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <>
      <Card title="Current plan" icon={<CreditCard className="h-4 w-4" />}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-lg font-bold text-fg-strong">{planDef.name}</p>
              <Badge tone="gradient">{planDef.monthlyPrice === 0 ? "Free" : `$${planDef.monthlyPrice}/mo`}</Badge>
            </div>
            <p className="mt-1 text-sm text-fg-muted">
              {formatNumber(used)} / {formatNumber(limit)} characters this month
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={openPortal} loading={checkoutLoading}>
              Manage billing
            </Button>
            {plan !== "ENTERPRISE" &&
              (demoSwitch ? (
                <Button size="sm" onClick={() => applyPlan(plan === "FREE" ? "PRO" : "ENTERPRISE")} loading={changing}>
                  Switch to {plan === "FREE" ? "Pro" : "Enterprise"} (demo)
                </Button>
              ) : (
                <Button size="sm" onClick={openPortal} loading={checkoutLoading}>
                  Upgrade to {plan === "FREE" ? "Pro" : "Enterprise"}
                </Button>
              ))}
          </div>
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Resolution" value={planDef.maxResolution} />
          <MiniStat label="Watermark" value={planDef.watermark ? "Yes" : "No"} />
          <MiniStat label="Cloud save" value={planDef.cloudSave ? "Yes" : "No"} />
          <MiniStat label="Video limit" value={`${planDef.maxVideoMb}MB`} />
        </div>
        {quota?.resetDate && (
          <p className="mt-3 text-xs text-fg-subtle">
            Quota resets on {new Date(quota.resetDate).toLocaleDateString()}.
          </p>
        )}
      </Card>

      <Card title="Payment method" icon={<CreditCard className="h-4 w-4" />}>
        <p className="text-sm text-fg-muted">
          No card on file. Payment methods are managed by the payment provider’s customer portal — raw card data never
          touches our servers.
        </p>
        {demoSwitch && (
          <p className="mt-2 text-xs text-warning">
            This deployment runs without a payment provider, so plan switches above are applied locally for
            demonstration. Nothing is charged.
          </p>
        )}
      </Card>
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-border bg-surface-inset p-3">
      <p className="text-xs text-fg-subtle">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-fg-strong">{value}</p>
    </div>
  );
}

// ── Preferences ─────────────────────────────────────────────────────────────
function PreferencesTab() {
  const [defaultVoice, setDefaultVoiceState] = useState(getDefaultVoice);
  const [exportQuality, setExportQualityState] = useState<ExportQuality>(getExportQuality);
  const [aspect, setAspect] = useState<Aspect>(getDefaultAspect);
  const [autoPlay, setAutoPlayState] = useState(getAutoPlay);
  const [storageUsage, setStorageUsage] = useState(0);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    void idbUsage().then(setStorageUsage);
  }, []);

  // Persist immediately — no "Save" button to forget.
  useEffect(() => {
    setDefaultVoice(defaultVoice);
  }, [defaultVoice]);
  useEffect(() => {
    setExportQuality(exportQuality);
  }, [exportQuality]);
  useEffect(() => {
    setDefaultAspect(aspect);
  }, [aspect]);
  useEffect(() => {
    setAutoPlay(autoPlay);
  }, [autoPlay]);

  const downloadData = async () => {
    try {
      const res = await fetch("/api/v1/user/data-export", { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "soundwave-data.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success("Data exported", "soundwave-data.json downloaded.");
    } catch (e) {
      toast.error("Export failed", (e as Error).message);
    }
  };

  const clearLocal = async () => {
    setClearing(true);
    try {
      await idbClear();
      setStorageUsage(await idbUsage());
      toast.success("Local data cleared", "Projects and audio cached in this browser were removed.");
    } catch (e) {
      toast.error("Couldn't clear local data", (e as Error).message);
    } finally {
      setClearing(false);
    }
  };

  return (
    <>
      <Card title="Studio defaults" icon={<SlidersHorizontal className="h-4 w-4" />}>
        <div className="space-y-4">
          <div>
            <label className="sw-label">Default voice</label>
            <Select
              value={defaultVoice}
              onChange={setDefaultVoiceState}
              options={DEFAULT_VOICES.map((v) => ({ value: v.id, label: `${v.displayName} (${v.gender}, ${v.accent})` }))}
              ariaLabel="Default voice"
            />
            <p className="mt-1.5 text-xs text-fg-subtle">Pre-selected every time you open the Studio.</p>
          </div>
          <div>
            <label className="sw-label">Default export quality</label>
            <Select
              value={exportQuality}
              onChange={(v) => setExportQualityState(v as ExportQuality)}
              options={[
                { value: "low", label: "Low — fastest, smallest files" },
                { value: "medium", label: "Medium — balanced (recommended)" },
                { value: "high", label: "High — slowest, best quality" },
              ]}
              ariaLabel="Default export quality"
            />
          </div>
          <div>
            <label className="sw-label">Default video aspect</label>
            <div className="flex flex-wrap gap-2">
              {(["16:9", "9:16"] as Aspect[]).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAspect(a)}
                  className={cn("sw-chip", aspect === a && "sw-chip-active")}
                >
                  {a === "16:9" ? "Landscape 16:9" : "Portrait 9:16"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-card border border-border bg-surface-inset px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg">Auto-play new generations</p>
              <p className="text-xs text-fg-subtle">Start playing as soon as the audio is ready.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoPlay}
              aria-label="Auto-play new generations"
              onClick={() => setAutoPlayState((v) => !v)}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
                autoPlay ? "bg-primary" : "bg-surface-3",
              )}
            >
              <span
                className={cn(
                  "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                  autoPlay ? "translate-x-[22px]" : "translate-x-0.5",
                )}
              />
            </button>
          </div>
        </div>
      </Card>

      <Card title="Data & privacy" icon={<Database className="h-4 w-4" />}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg">Download my data</p>
              <p className="text-xs text-fg-subtle">GDPR — exports your profile, projects and usage logs.</p>
            </div>
            <Button size="sm" variant="outline" icon={<Download className="h-4 w-4" />} onClick={downloadData}>
              Export
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg">Browser storage</p>
              <p className="text-xs text-fg-subtle">
                This browser is using <span className="text-fg">{formatBytes(storageUsage)}</span> for local projects and audio.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={clearLocal} loading={clearing}>
              Clear local data
            </Button>
          </div>
        </div>
      </Card>
    </>
  );
}

function Card({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("sw-card sw-card-pad", className)}>
      <div className="mb-5 flex items-center gap-2">
        {icon && <span className="text-primary">{icon}</span>}
        <h2 className="text-lg font-semibold text-fg-strong">{title}</h2>
      </div>
      {children}
    </div>
  );
}
