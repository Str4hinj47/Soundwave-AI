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
          <h1 className="text-3xl font-bold text-white">Welcome back, {firstName}</h1>
          <p className="mt-1 text-sm text-gray-400">{today}</p>
        </div>
        <Link
          to="/studio"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-btn bg-gradient-to-r from-blue-500 to-violet-500 px-5 font-semibold text-white shadow-glow transition-all duration-200 hover:from-blue-400 hover:to-violet-400"
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
              <Link to="/pricing" className="mt-1 inline-block text-sm text-blue-400 hover:text-blue-300">
                Upgrade →
              </Link>
            ) : undefined
          }
        />
      </div>

      {/* Quick actions */}
      <h2 className="mt-10 text-lg font-semibold text-white">Quick actions</h2>
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
        <h2 className="text-lg font-semibold text-white">Recent projects</h2>
        <Link to="/projects" className="text-sm text-blue-400 hover:text-blue-300">
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
          <div className="rounded-card border border-gray-800 bg-panel">
            <EmptyState
              icon={<Mic className="h-8 w-8" />}
              title="Create your first project"
              description="Generate your first voice clip — it takes seconds and runs entirely in your browser."
              action={
                <Link
                  to="/studio"
                  className="inline-flex h-11 items-center rounded-btn bg-gradient-to-r from-blue-500 to-violet-500 px-5 font-semibold text-white hover:from-blue-400 hover:to-violet-400"
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
    <div className="rounded-card border border-gray-800 bg-panel p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{title}</p>
        <span className="text-blue-400">{icon}</span>
      </div>
      <p className="mt-2 truncate text-2xl font-bold text-white">{value}</p>
      {footer}
    </div>
  );
}

function QuickAction({ icon, title, desc, to }: { icon: React.ReactNode; title: string; desc: string; to: string }) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-4 rounded-card border border-gray-800 bg-panel p-5 transition-all duration-200 hover:border-blue-500/50"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 to-violet-500/20 text-blue-300 transition-colors group-hover:text-blue-200">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-semibold text-white">{title}</span>
        <span className="mt-0.5 block text-sm text-gray-400">{desc}</span>
      </span>
    </Link>
  );
}

function ProjectCard({ project, onOpen, onDelete }: { project: ProjectMeta; onOpen: () => void; onDelete: () => void }) {
  const [deleted, setDeleted] = useState(false);
  if (deleted) return null;
  return (
    <div className="rounded-card border border-gray-800 bg-panel p-4 transition-all duration-200 hover:border-blue-500/50">
      <div className="flex items-start justify-between gap-2">
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="truncate font-semibold text-white">{project.title}</p>
          <p className="mt-0.5 text-xs text-gray-500">{formatDate(project.createdAt)}</p>
        </button>
        <Dropdown
          align="right"
          label="Project actions"
          trigger={
            <button aria-label="Project actions" className="rounded p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white">
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
        <p className="mt-3 line-clamp-2 text-sm text-gray-500">{truncate(project.textContent, 160)}</p>
      )}
    </div>
  );
}

