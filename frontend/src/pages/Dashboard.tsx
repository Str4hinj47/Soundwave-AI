import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Captions,
  Film,
  FolderKanban,
  Gauge,
  Mic,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "../store/auth";
import { http } from "../lib/api";
import { formatDate, formatDuration, formatNumber, truncate } from "../lib/format";
import { displayNameFor } from "../lib/voices";
import { ProgressBar } from "../components/ui/ProgressBar";
import { SkeletonCard } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { Badge } from "../components/ui/Badge";
import { deleteLocalProject, listLocalProjects } from "../lib/localProjects";
import type { ProjectMeta } from "../lib/types";
import { Dropdown } from "../components/ui/Dropdown";
import { toast } from "../store/toast";
import { openProject } from "../lib/openProject";

export function Dashboard() {
  const { user, quota, refreshQuota } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void refreshQuota();
    void (async () => {
      try {
        const [cloud, local] = await Promise.all([
          http
            .get<{ projects: ProjectMeta[] }>("/projects")
            .then((r) => r.projects)
            .catch(() => []),
          listLocalProjects(),
        ]);
        // Cloud first, then local — newest first within each source.
        const all = [...cloud, ...local].sort(
          (a, b) => new Date(b.updatedAt ?? b.createdAt).getTime() - new Date(a.updatedAt ?? a.createdAt).getTime(),
        );
        setProjects(all);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshQuota]);

  const firstName = (user?.name ?? "there").trim().split(" ")[0] || "there";
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const used = quota?.used ?? 0;
  const limit = quota?.limit ?? 10_000;
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

  const totalDuration = useMemo(() => projects.reduce((a, p) => a + (p.duration ?? 0), 0), [projects]);
  const localCount = useMemo(() => projects.filter((p) => p.storageType === "LOCAL").length, [projects]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="sw-eyebrow">{today}</p>
          <h1 className="mt-1 text-3xl font-bold text-fg-strong">Welcome back, {firstName}</h1>
          <p className="mt-1 text-sm text-fg-muted">
            {projects.length === 0
              ? "Generate your first voiceover to get started."
              : `You have ${projects.length} project${projects.length === 1 ? "" : "s"} — ${localCount} stored locally.`}
          </p>
        </div>
        <Link
          to="/studio"
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-btn bg-gradient-to-r from-primary to-accent px-5 font-semibold text-primary-fg shadow-glow transition-all duration-200 hover:brightness-110"
        >
          <Sparkles className="h-4 w-4" /> New voiceover
        </Link>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Characters this month"
          value={`${formatNumber(used)} / ${formatNumber(limit)}`}
          icon={<Mic className="h-5 w-5" />}
          footer={
            <ProgressBar
              value={pct}
              tone={pct > 95 ? "danger" : pct > 80 ? "warning" : "default"}
              className="mt-3"
              label="Monthly character usage"
            />
          }
        />
        <StatCard
          title="Projects"
          value={String(projects.length)}
          icon={<FolderKanban className="h-5 w-5" />}
          footer={<p className="mt-1 text-xs text-fg-subtle">{localCount} local · {projects.length - localCount} cloud</p>}
        />
        <StatCard
          title="Audio generated"
          value={formatDuration(totalDuration)}
          icon={<Captions className="h-5 w-5" />}
          footer={<p className="mt-1 text-xs text-fg-subtle">across saved projects</p>}
        />
        <StatCard
          title="Current plan"
          value={user?.plan ?? "FREE"}
          icon={<Gauge className="h-5 w-5" />}
          footer={
            user?.plan !== "ENTERPRISE" ? (
              <Link to="/pricing" className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:brightness-110">
                Upgrade <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <p className="mt-1 text-xs text-fg-subtle">Everything unlocked</p>
            )
          }
        />
      </div>

      {/* Quick actions */}
      <h2 className="mt-10 text-lg font-semibold text-fg-strong">Quick actions</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <QuickAction
          icon={<Mic className="h-6 w-6" />}
          title="New text-to-speech"
          desc="Generate speech with any Microsoft Neural voice."
          to="/studio"
        />
        <QuickAction
          icon={<Captions className="h-6 w-6" />}
          title="Style subtitles"
          desc="Cue and design captions for your audio."
          to="/studio/subtitles"
        />
        <QuickAction
          icon={<Film className="h-6 w-6" />}
          title="Export video"
          desc="Burn subtitles onto footage or a colour background."
          to="/studio/video"
        />
      </div>

      {/* Recent projects */}
      <div className="mt-10 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-fg-strong">Recent projects</h2>
        <Link to="/projects" className="sw-link text-sm">
          View all →
        </Link>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : projects.length === 0 ? (
          <div className="sw-card">
            <EmptyState
              icon={<Mic className="h-8 w-8" />}
              title="Create your first project"
              description="Generate a voiceover — it takes seconds, uses your free monthly characters, and comes with word-level timings for subtitles."
              action={
                <Link
                  to="/studio"
                  className="inline-flex h-11 items-center rounded-btn bg-gradient-to-r from-primary to-accent px-5 font-semibold text-primary-fg hover:brightness-110"
                >
                  Start creating
                </Link>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.slice(0, 6).map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onOpen={() => openProject(p, navigate)}
                onDelete={() => setProjects((prev) => prev.filter((x) => x.id !== p.id))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  footer,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-card border border-border bg-surface p-5 shadow-card transition-transform duration-200 hover:-translate-y-0.5">
      <span
        className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 blur-xl transition-opacity duration-300 group-hover:opacity-100 opacity-60"
        aria-hidden="true"
      />
      <div className="relative flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm text-fg-muted">{title}</p>
        <span className="text-primary">{icon}</span>
      </div>
      <p className="relative mt-2 truncate text-2xl font-bold text-fg-strong">{value}</p>
      {footer}
    </div>
  );
}

function QuickAction({ icon, title, desc, to }: { icon: React.ReactNode; title: string; desc: string; to: string }) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-4 rounded-card border border-border bg-surface p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lift"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent/20 text-primary transition-transform group-hover:scale-105">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-semibold text-fg-strong">{title}</span>
        <span className="mt-0.5 block text-sm text-fg-muted">{desc}</span>
      </span>
      <TrendingUp className="ml-auto h-4 w-4 shrink-0 text-fg-subtle transition-colors group-hover:text-primary" />
    </Link>
  );
}

function ProjectCard({
  project,
  onOpen,
  onDelete,
}: {
  project: ProjectMeta;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [deleted, setDeleted] = useState(false);
  if (deleted) return null;
  return (
    <div className="group rounded-card border border-border bg-surface p-4 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lift">
      <div className="flex items-start justify-between gap-2">
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="truncate font-semibold text-fg-strong">{project.title}</p>
          <p className="mt-0.5 text-xs text-fg-subtle">{formatDate(project.updatedAt ?? project.createdAt)}</p>
        </button>
        <Dropdown
          align="right"
          label="Project actions"
          trigger={
            <button aria-label="Project actions" className="rounded p-1.5 text-fg-subtle transition-colors hover:bg-surface-2 hover:text-fg-strong">
              ⋯
            </button>
          }
          items={[
            { key: "open", label: "Open", onClick: onOpen },
            {
              key: "delete",
              label: "Delete",
              danger: true,
              onClick: async () => {
                try {
                  if (project.storageType === "LOCAL") {
                    await deleteLocalProject(project.id);
                  } else {
                    await http.del(`/projects/${project.id}`);
                  }
                  toast.success("Project deleted");
                  setDeleted(true);
                  onDelete();
                } catch {
                  toast.error("Couldn't delete project");
                }
              },
            },
          ]}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge tone="blue">{project.type}</Badge>
        <Badge tone="gray">{displayNameFor(project.voiceId)}</Badge>
        {project.duration != null && <Badge tone="gray">{formatDuration(project.duration)}</Badge>}
        {project.storageType === "LOCAL" && (
          <Badge tone="amber" dot>
            Local Only
          </Badge>
        )}
      </div>
      {project.textContent && (
        <p className="mt-3 line-clamp-2 text-sm text-fg-subtle">{truncate(project.textContent, 160)}</p>
      )}
    </div>
  );
}
