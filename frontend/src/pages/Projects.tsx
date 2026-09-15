import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { FolderKanban, Grid3X3, List, Search, Trash2 } from "lucide-react";
import { http } from "../lib/api";
import { useAuth } from "../store/auth";
import { toast } from "../store/toast";
import { cn } from "../lib/cn";
import { formatDate, formatDuration } from "../lib/format";
import { displayNameFor } from "../lib/voices";
import { listLocalProjects, deleteLocalProject } from "../lib/localProjects";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { SkeletonCard } from "../components/ui/Skeleton";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import type { ProjectMeta } from "../lib/types";

type SortKey = "updated" | "created" | "name" | "duration";

export function Projects() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("updated");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
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
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = projects.filter(
      (p) =>
        (typeFilter === "all" || p.type === typeFilter) &&
        (!q || p.title.toLowerCase().includes(q) || p.textContent.toLowerCase().includes(q)),
    );
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "created": return b.createdAt.localeCompare(a.createdAt);
        case "name": return a.title.localeCompare(b.title);
        case "duration": return (b.duration ?? 0) - (a.duration ?? 0);
        default: return b.updatedAt.localeCompare(a.updatedAt);
      }
    });
    return list;
  }, [projects, query, typeFilter, sort]);

  const toggleSelect = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const deleteSelected = async () => {
    for (const id of selected) {
      const p = projects.find((x) => x.id === id);
      if (!p) continue;
      try {
        if (p.storageType === "LOCAL") await deleteLocalProject(id);
        else await http.del(`/projects/${id}`);
      } catch {
        toast.error("Delete failed", p.title);
      }
    }
    setProjects((prev) => prev.filter((p) => !selected.has(p.id)));
    setSelected(new Set());
    toast.success("Deleted", `${selected.size} project(s) removed.`);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold text-fg">My Projects</h1>
        <Link
          to="/studio"
          className="inline-flex h-11 items-center rounded-btn bg-accent px-5 font-semibold text-accent-ink hover:bg-accent-strong"
        >
          New Project
        </Link>
      </div>

      {/* Toolbar */}
      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setParams(e.target.value ? { q: e.target.value } : {});
            }}
            placeholder="Search projects…"
            className="w-full rounded-input border border-line-strong bg-sunken py-2 pl-9 pr-3 text-sm text-fg placeholder-faint"
            aria-label="Search projects"
          />
        </div>
        <Select
          value={typeFilter}
          onChange={setTypeFilter}
          className="w-40"
          options={[
            { value: "all", label: "All types" },
            { value: "TTS", label: "Text-to-Speech" },
            { value: "SUBTITLE", label: "Subtitles" },
            { value: "VIDEO", label: "Video" },
          ]}
          ariaLabel="Filter by type"
        />
        <Select
          value={sort}
          onChange={(v) => setSort(v as SortKey)}
          className="w-44"
          options={[
            { value: "updated", label: "Last modified" },
            { value: "created", label: "Date created" },
            { value: "name", label: "Name" },
            { value: "duration", label: "Duration" },
          ]}
          ariaLabel="Sort projects"
        />
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setView("grid")} aria-label="Grid view" aria-pressed={view === "grid"} className={cn("rounded-md p-2 transition-colors", view === "grid" ? "bg-tint-strong text-fg" : "text-muted hover:text-fg")}>
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button onClick={() => setView("list")} aria-label="List view" aria-pressed={view === "list"} className={cn("rounded-md p-2 transition-colors", view === "list" ? "bg-tint-strong text-fg" : "text-muted hover:text-fg")}>
            <List className="h-4 w-4" />
          </button>
          {selected.size > 0 && (
            <Button size="sm" variant="danger" onClick={deleteSelected} icon={<Trash2 className="h-4 w-4" />}>
              Delete ({selected.size})
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="mt-5">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-card border border-line bg-surface">
            <EmptyState
              icon={<FolderKanban className="h-8 w-8" />}
              title={query || typeFilter !== "all" ? "No matching projects" : "No projects yet"}
              description={query || typeFilter !== "all" ? "Try a different search or filter." : "Create your first project from the Studio."}
              action={
                <Link to="/studio" className="inline-flex h-11 items-center rounded-btn bg-accent px-5 font-semibold text-accent-ink hover:bg-accent-strong">
                  Create a project
                </Link>
              }
            />
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <ProjectGridCard key={p.id} project={p} selected={selected.has(p.id)} onSelect={() => toggleSelect(p.id)} />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            {filtered.map((p) => (
              <ProjectListRow key={p.id} project={p} selected={selected.has(p.id)} onSelect={() => toggleSelect(p.id)} />
            ))}
          </div>
        )}
      </div>

      {user?.plan === "FREE" && projects.some((p) => p.storageType === "LOCAL") && (
        <p className="mt-4 text-sm text-faint">
          <Badge tone="amber" dot>Local Only</Badge> projects are stored in your browser.{" "}
          <Link to="/pricing" className="text-accent hover:text-accent-strong">Upgrade to sync to cloud</Link>.
        </p>
      )}
    </div>
  );
}

function ProjectGridCard({ project, selected, onSelect }: { project: ProjectMeta; selected: boolean; onSelect: () => void }) {
  const open = () => {
    try { localStorage.setItem("soundwave:last_project_id", project.id); } catch {}
    const to = project.type === "SUBTITLE" ? "/studio/subtitles" : project.type === "VIDEO" ? "/studio/video" : "/studio";
    window.location.assign(to);
  };
  return (
    <div className={cn("rounded-card border bg-surface p-4 transition-all cursor-pointer", selected ? "border-accent" : "border-line hover:border-line-emphasis")} onClick={open}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-fg">{project.title}</p>
          <p className="text-xs text-faint">{formatDate(project.createdAt)}</p>
        </div>
        <input type="checkbox" checked={selected} onChange={(e) => { e.stopPropagation(); onSelect(); }} onClick={(e) => e.stopPropagation()} aria-label={`Select ${project.title}`} className="mt-0.5 h-4 w-4 accent-accent" />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge tone="blue">{project.type}</Badge>
        <Badge tone="gray">{displayNameFor(project.voiceId)}</Badge>
        {project.duration != null && <Badge tone="gray">{formatDuration(project.duration)}</Badge>}
        {project.storageType === "LOCAL" && <Badge tone="amber" dot>Local Only</Badge>}
      </div>
    </div>
  );
}

function ProjectListRow({ project, selected, onSelect }: { project: ProjectMeta; selected: boolean; onSelect: () => void }) {
  const open = () => {
    try { localStorage.setItem("soundwave:last_project_id", project.id); } catch {}
    const to = project.type === "SUBTITLE" ? "/studio/subtitles" : project.type === "VIDEO" ? "/studio/video" : "/studio";
    window.location.assign(to);
  };
  return (
    <div className={cn("flex items-center gap-3 border-b border-line px-4 py-3 last:border-0 cursor-pointer hover:bg-tint/50", selected && "bg-accent/5")} onClick={open}>
      <input type="checkbox" checked={selected} onChange={(e) => { e.stopPropagation(); onSelect(); }} onClick={(e) => e.stopPropagation()} aria-label={`Select ${project.title}`} className="h-4 w-4 accent-accent" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-fg">{project.title}</p>
        <p className="truncate text-xs text-faint">{formatDate(project.createdAt)}</p>
      </div>
      <Badge tone="blue" className="hidden sm:inline-flex">{project.type}</Badge>
      <Badge tone="gray" className="hidden md:inline-flex">{displayNameFor(project.voiceId)}</Badge>
      {project.duration != null && <span className="hidden font-mono text-xs text-faint md:inline">{formatDuration(project.duration)}</span>}
      {project.storageType === "LOCAL" && <Badge tone="amber" dot>Local</Badge>}
    </div>
  );
}
