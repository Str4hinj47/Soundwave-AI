import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  Captions,
  Film,
  FolderKanban,
  Mic,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../store/auth";
import { http } from "../lib/api";
import { formatDate, formatDuration, formatNumber, truncate } from "../lib/format";
import { displayNameFor } from "../lib/voices";
import { ProgressBar } from "../components/ui/ProgressBar";
import { SkeletonCard } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { Badge } from "../components/ui/Badge";
import { listLocalProjects } from "../lib/localProjects";
import type { ProjectMeta } from "../lib/types";
import { Dropdown } from "../components/ui/Dropdown";
import { toast } from "../store/toast";

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
          http.get<{ projects: ProjectMeta[] }>("/projects").then((r) => r.projects).catch(() => []),
          listLocalProjects(),
        ]);
        setProjects([...cloud, ...local]);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshQuota]);

  const firstName = (user?.name ?? "there").split(" ")[0];
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const used = quota?.used ?? 0;
  const limit = quota?.limit ?? 10_000;
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;

  const totalDuration = useMemo(() => projects.reduce((a, p) => a + (p.duration ?? 0), 0), [projects]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-fg">Welcome back, {firstName}</h1>
          <p className="mt-1 text-sm text-muted">{today}</p>
        </div>
        <Link
          to="/studio"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-btn bg-accent px-5 font-semibold text-accent-ink transition-colors duration-200 hover:bg-accent-strong"
        >
          <Sparkles className="h-4 w-4" /> New Text-to-Speech
        </Link>
      </div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Characters this month"
          value={`${formatNumber(used)} / ${formatNumber(limit)}`}
          icon={<Mic className="h-5 w-5" />}
          footer={<ProgressBar value={pct} tone={pct > 95 ? "danger" : pct > 80 ? "warning" : "default"} className="mt-3" />}
        />
        <StatCard title="Projects created" value={String(projects.length)} icon={<FolderKanban className="h-5 w-5" />} />
        <StatCard title="Audio generated" value={formatDuration(totalDuration)} icon={<Captions className="h-5 w-5" />} />
        <StatCard
          title="Current plan"
          value={user?.plan ?? "FREE"}
          icon={<ArrowUpRight className="h-5 w-5" />}
          footer={
            user?.plan !== "ENTERPRISE" ? (
              <Link to="/pricing" className="mt-1 inline-block text-sm text-accent hover:text-accent-strong">
                Upgrade →
              </Link>
            ) : undefined
          }
        />
      </div>

      {/* Quick actions */}
      <h2 className="mt-10 text-lg font-semibold text-fg">Quick actions</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <QuickAction
          icon={<Mic className="h-6 w-6" />}
          title="New Text-to-Speech"
          desc="Generate speech with any Microsoft Neural voice."
          to="/studio"
        />
        <QuickAction
          icon={<Captions className="h-6 w-6" />}
          title="New Subtitle Project"
          desc="Style and sync subtitles to your audio."
          to="/studio/subtitles"
        />
        <QuickAction
          icon={<Film className="h-6 w-6" />}
          title="New Video Export"
          desc="Burn subtitles onto a video background."
          to="/studio/video"
        />
      </div>

      {/* Recent projects */}
      <div className="mt-10 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-fg">Recent projects</h2>
        <Link to="/projects" className="text-sm text-accent hover:text-accent-strong">
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
          <div className="rounded-card border border-line bg-surface">
            <EmptyState
              icon={<Mic className="h-8 w-8" />}
              title="Create your first project"
              description="Generate your first voice clip — it takes seconds and runs entirely in your browser."
              action={
                <Link
                  to="/studio"
                  className="inline-flex h-11 items-center rounded-btn bg-accent px-5 font-semibold text-accent-ink hover:bg-accent-strong"
                >
                  Start creating
                </Link>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.slice(0, 6).map((p) => (
              <ProjectCard key={p.id} project={p} onOpen={() => navigate("/studio")} onDelete={() => setProjects((prev) => prev.filter((x) => x.id !== p.id))} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, footer }: { title: string; value: string; icon: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{title}</p>
        <span className="text-accent">{icon}</span>
      </div>
      <p className="mt-2 truncate text-2xl font-semibold text-fg">{value}</p>
      {footer}
    </div>
  );
}

function QuickAction({ icon, title, desc, to }: { icon: React.ReactNode; title: string; desc: string; to: string }) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-4 rounded-card border border-line bg-surface p-5 transition-all duration-200 hover:border-line-emphasis"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent transition-colors group-hover:text-accent-strong">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-semibold text-fg">{title}</span>
        <span className="mt-0.5 block text-sm text-muted">{desc}</span>
      </span>
    </Link>
  );
}

function ProjectCard({ project, onOpen, onDelete }: { project: ProjectMeta; onOpen: () => void; onDelete: () => void }) {
  const [deleted, setDeleted] = useState(false);
  if (deleted) return null;
  return (
    <div className="rounded-card border border-line bg-surface p-4 transition-all duration-200 hover:border-line-emphasis">
      <div className="flex items-start justify-between gap-2">
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="truncate font-semibold text-fg">{project.title}</p>
          <p className="mt-0.5 text-xs text-faint">{formatDate(project.createdAt)}</p>
        </button>
        <Dropdown
          align="right"
          label="Project actions"
          trigger={
            <button aria-label="Project actions" className="rounded p-1.5 text-muted hover:bg-tint hover:text-fg">
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
                    const { deleteLocalProject } = await import("../lib/localProjects");
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
        {project.storageType === "LOCAL" && <Badge tone="amber" dot>Local Only</Badge>}
      </div>
      {project.textContent && (
        <p className="mt-3 line-clamp-2 text-sm text-faint">{truncate(project.textContent, 160)}</p>
      )}
    </div>
  );
}

