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
import { idbUsage } from "../lib/idb";
import { DEFAULT_VOICES } from "../lib/voices";

const TABS = [
  { id: "profile", label: "Profile", icon: <User className="h-4 w-4" /> },
  { id: "billing", label: "Billing", icon: <CreditCard className="h-4 w-4" /> },
  { id: "preferences", label: "Preferences", icon: <SlidersHorizontal className="h-4 w-4" /> },
];

export function Settings() {
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshQuota } = useAuth();
  const active = location.pathname.includes("/billing") ? "billing" : location.pathname.includes("/preferences") ? "preferences" : "profile";

  useEffect(() => {
    void refreshQuota();
  }, [refreshQuota]);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold text-white">Settings</h1>
      <p className="mt-1 text-sm text-gray-400">Manage your account, billing, and preferences.</p>

      <div className="mt-6 flex gap-1 overflow-x-auto rounded-card border border-gray-800 bg-gray-900/60 p-1" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            onClick={() => navigate(`/settings/${t.id === "profile" ? "" : t.id}`)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-md px-3.5 py-2 text-sm font-medium transition-all duration-200",
              active === t.id ? "bg-gradient-to-r from-blue-500/20 to-violet-500/20 text-white" : "text-gray-400 hover:text-gray-200",
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-5">
        {active === "profile" && <ProfileTab />}
        {active === "billing" && <BillingTab />}
        {active === "preferences" && <PreferencesTab />}
      </div>
    </div>
  );
}

// ── Profile ─────────────────────────────────────────────────────────────────
function ProfileTab() {
  const { user, setUser, loadSession } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePass, setDeletePass] = useState("");

  const saveProfile = async () => {
    setSaving(true);
    try {
      const updated = await http.put<{ id: string; name: string; email: string; plan: Plan; avatarUrl: string | null; emailVerified: boolean }>("/user/profile", { name });
      setUser(updated);
      toast.success("Profile updated");
    } catch (e) {
      toast.error("Update failed", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    if (!next || next !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setPwSaving(true);
    try {
      await http.put("/user/password", { currentPassword: current, newPassword: next });
      setCurrent(""); setNext(""); setConfirm("");
      toast.success("Password changed", "All other sessions remain active. You can sign out others below.");
    } catch (e) {
      toast.error("Change failed", (e as Error).message);
    } finally {
      setPwSaving(false);
    }
  };

  const deleteAccount = async () => {
    try {
      await http.del("/user/account", { password: deletePass });
      toast.success("Account deleted", "We'll keep your data for 30 days in case you change your mind.");
      await loadSession();
    } catch (e) {
      toast.error("Delete failed", (e as Error).message);
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

  return (
    <>
      <Card title="Profile" icon={<User className="h-4 w-4" />}>
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-xl font-bold text-white">
            {(user?.name ?? "U").split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-white">{user?.name}</p>
            <p className="truncate text-sm text-gray-500">{user?.email}</p>
          </div>
        </div>
        <div className="mt-5 space-y-4">
          <TextField label="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField label="Email" value={user?.email ?? ""} disabled hint="Email changes require re-verification." />
          <Button onClick={saveProfile} loading={saving}>Save changes</Button>
        </div>
      </Card>

      <Card title="Change password" icon={<ShieldCheck className="h-4 w-4" />}>
        <div className="space-y-4">
          <TextField label="Current password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          <TextField label="New password" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          <TextField label="Confirm new password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          <Button onClick={changePassword} loading={pwSaving} variant="outline">Update password</Button>
          <div className="border-t border-gray-800 pt-4">
            <p className="text-sm text-gray-400">Sign out of all other devices:</p>
            <Button onClick={signOutOthers} variant="outline" className="mt-2">Sign out all other sessions</Button>
          </div>
        </div>
      </Card>

      <Card title="Danger zone" icon={<Trash2 className="h-4 w-4" />} className="border-red-500/30">
        <p className="text-sm text-gray-400">Deleting your account removes your cloud projects. We keep a 30-day recovery window.</p>
        <Button variant="danger" className="mt-3" onClick={() => setDeleteOpen(true)}>Delete account</Button>
      </Card>

      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete account" description="This action is permanent after the 30-day recovery period.">
        <div className="space-y-4">
          <TextField label="Confirm with your password" type="password" value={deletePass} onChange={(e) => setDeletePass(e.target.value)} />
          <Button fullWidth variant="danger" onClick={deleteAccount}>Permanently delete my account</Button>
        </div>
      </Modal>
    </>
  );
}

// ── Billing ─────────────────────────────────────────────────────────────────
function BillingTab() {
  const { user, quota, setUser, refreshQuota } = useAuth();
  const [changing, setChanging] = useState(false);
  const plan = user?.plan ?? "FREE";
  const planDef = PLANS[plan];
  const used = quota?.used ?? 0;
  const limit = quota?.limit ?? planDef.characterLimit;
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

  const applyPlan = async (p: "PRO" | "ENTERPRISE") => {
    setChanging(true);
    try {
      const res = await http.post<{ user: { id: string; plan: Plan; name: string; email: string } }>("/billing/apply-plan", { plan: p, billing: "monthly" });
      setUser({ ...(user!), plan: res.user.plan });
      await refreshQuota();
      toast.success(`Plan changed to ${p}`, "In production this goes through Stripe Checkout.");
    } catch (e) {
      toast.error("Failed", (e as Error).message);
    } finally {
      setChanging(false);
    }
  };

  return (
    <>
      <Card title="Current plan" icon={<CreditCard className="h-4 w-4" />}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-lg font-bold text-white">{planDef.name}</p>
              <Badge tone="gradient">{planDef.monthlyPrice === 0 ? "Free" : `$${planDef.monthlyPrice}/mo`}</Badge>
            </div>
            <p className="mt-1 text-sm text-gray-400">
              {formatNumber(used)} / {formatNumber(limit)} characters this month
            </p>
          </div>
          {plan !== "ENTERPRISE" && (
            <Button size="sm" onClick={() => applyPlan(plan === "FREE" ? "PRO" : "ENTERPRISE")} loading={changing}>
              Upgrade to {plan === "FREE" ? "Pro" : "Enterprise"}
            </Button>
          )}
        </div>
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-800">
          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Resolution" value={planDef.maxResolution} />
          <MiniStat label="Watermark" value={planDef.watermark ? "Yes" : "No"} />
          <MiniStat label="Cloud save" value={planDef.cloudSave ? "Yes" : "No"} />
          <MiniStat label="Video limit" value={`${planDef.maxVideoMb}MB`} />
        </div>
      </Card>

      <Card title="Payment method" icon={<CreditCard className="h-4 w-4" />}>
        <p className="text-sm text-gray-400">No card on file. In production, payment methods are managed via Stripe Customer Portal (no raw card data ever touches our servers).</p>
      </Card>

      <Card title="Billing history" icon={<CreditCard className="h-4 w-4" />}>
        <p className="text-sm text-gray-500">No invoices yet.</p>
      </Card>

      <Card title="Cancel subscription" icon={<Trash2 className="h-4 w-4" />}>
        <p className="text-sm text-gray-400">You can cancel anytime from the Stripe Customer Portal. Your access continues until the end of the billing period.</p>
      </Card>
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-gray-800 bg-gray-900/60 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

// ── Preferences ─────────────────────────────────────────────────────────────
function PreferencesTab() {
  const [defaultVoice, setDefaultVoice] = useState(() => localStorage.getItem("sw.default_voice") ?? "en-US-ChristopherNeural");
  const [exportQuality, setExportQuality] = useState(() => localStorage.getItem("sw.export_quality") ?? "medium");
  const [orbMode, setOrbMode] = useState(() => localStorage.getItem("soundwave_orb_mode") ?? "auto");
  const [storageUsage, setStorageUsage] = useState(0);

  useEffect(() => {
    void idbUsage().then(setStorageUsage);
  }, []);

  const savePrefs = () => {
    localStorage.setItem("sw.default_voice", defaultVoice);
    localStorage.setItem("sw.export_quality", exportQuality);
    localStorage.setItem("soundwave_orb_mode", orbMode);
    toast.success("Preferences saved");
  };

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
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Export failed", (e as Error).message);
    }
  };

  return (
    <>
      <Card title="Defaults & Agent Appearance" icon={<Palette className="h-4 w-4" />}>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-gray-300">Default voice (Male default)</label>
            <Select
              value={defaultVoice}
              onChange={setDefaultVoice}
              options={DEFAULT_VOICES.map((v) => ({ value: v.id, label: `${v.displayName} (${v.gender}, ${v.accent})` }))}
              ariaLabel="Default voice"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-300">Thinking Orb Visualizer Mode</label>
            <Select
              value={orbMode}
              onChange={setOrbMode}
              options={[
                { value: "auto", label: "Auto Sync (Default — dynamic reactive states)" },
                { value: "breathing", label: "Breathing (Morphing gentle standby ring)" },
                { value: "listening", label: "Listening (Rolling rings waveform)" },
                { value: "solving", label: "Solving (Scrambled concentric bands)" },
                { value: "searching", label: "Searching (Sweeping scan meridian)" },
                { value: "connecting", label: "Connecting (Constellation network)" },
                { value: "weaving", label: "Weaving (Luminous triple plait)" },
                { value: "composing", label: "Composing (Harmonic multi-band sash)" },
                { value: "working", label: "Working (High-speed particle orbits)" },
                { value: "shaping", label: "Shaping (Geometric metamorphosis)" },
              ]}
              ariaLabel="Orb mode"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-gray-300">Default export quality</label>
            <Select
              value={exportQuality}
              onChange={setExportQuality}
              options={[{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }]}
              ariaLabel="Default export quality"
            />
          </div>
          <Button onClick={savePrefs}>Save preferences</Button>
        </div>
      </Card>

      <Card title="Data & privacy" icon={<Database className="h-4 w-4" />}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">Download my data</p>
              <p className="text-xs text-gray-500">GDPR — exports your profile, projects, and usage logs.</p>
            </div>
            <Button size="sm" variant="outline" icon={<Download className="h-4 w-4" />} onClick={downloadData}>Export</Button>
          </div>
          <p className="text-xs text-gray-500">
            This browser is using <span className="text-white">{formatBytes(storageUsage)}</span> for local audio and projects.
          </p>
        </div>
      </Card>
    </>
  );
}

function Card({ title, icon, children, className }: { title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-card border border-gray-800 bg-panel p-5 sm:p-6", className)}>
      <div className="mb-5 flex items-center gap-2">
        {icon && <span className="text-blue-400">{icon}</span>}
        <h2 className="text-lg font-semibold text-white">{title}</h2>
      </div>
      {children}
    </div>
  );
}
