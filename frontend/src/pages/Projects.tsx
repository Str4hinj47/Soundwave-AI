import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FolderKanban, Grid3X3, List, Search, Trash2 } from "lucide-react";
import { http } from "../lib/api";
import { useAuth } from "../store/auth";
import { toast } from "../store/toast";
import { cn } from "../lib/cn";
import { formatDate, formatDuration } from "../lib/format";
import { displayNameFor } from "../lib/voices";
import { listLocalProjects, deleteLocalProject } from "../lib/localProjects";
import { openProject } from "../lib/openProject";
import { Play } from "lucide-react";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { SkeletonCard } from "../components/ui/Skeleton";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import type { ProjectMeta } from "../lib/types";

type SortKey = "updated" | "created" | "name" | "duration";

export function Projects() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
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

  // Keep the box in sync when the query comes from elsewhere (AppShell search).
  useEffect(() => {
    const urlQuery = params.get("q") ?? "";
    setQuery((current) => (current === urlQuery ? current : urlQuery));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = projects.filter(
      (p) =>
        (typeFilter === "all" || p.type === typeFilter) &&
        (!q || p.title.toLowerCase().includes(q) || p.textContent.toLowerCase().includes(q)),
    );
    const stamp = (p: ProjectMeta) => new Date(p.updatedAt ?? p.createdAt).getTime() || 0;
    const created = (p: ProjectMeta) => new Date(p.createdAt).getTime() || 0;
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "created": return created(b) - created(a);
        case "name": return a.title.localeCompare(b.title);
        case "duration": return (b.duration ?? 0) - (a.duration ?? 0);
        default: return stamp(b) - stamp(a);
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
        <h1 className="text-3xl font-bold text-fg-strong">My Projects</h1>
        <Link
          to="/studio"
          className="inline-flex h-11 items-center rounded-btn bg-gradient-to-r from-primary to-accent px-5 font-semibold text-fg-strong hover:brightness-110"
        >
          New Project
        </Link>
      </div>

      {/* Toolbar */}
      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setParams(e.target.value ? { q: e.target.value } : {});
            }}
            placeholder="Search projects…"
            className="w-full rounded-input border border-border-strong bg-surface-inset py-2 pl-9 pr-3 text-sm text-fg-strong placeholder:text-fg-subtle"
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
          <button onClick={() => setView("grid")} aria-label="Grid view" aria-pressed={view === "grid"} className={cn("rounded-md p-2 transition-colors", view === "grid" ? "bg-surface-3 text-fg-strong" : "text-fg-muted hover:text-fg-strong")}>
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button onClick={() => setView("list")} aria-label="List view" aria-pressed={view === "list"} className={cn("rounded-md p-2 transition-colors", view === "list" ? "bg-surface-3 text-fg-strong" : "text-fg-muted hover:text-fg-strong")}>
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
          <div className="rounded-card border border-border bg-surface">
            <EmptyState
              icon={<FolderKanban className="h-8 w-8" />}
              title={query || typeFilter !== "all" ? "No matching projects" : "No projects yet"}
              description={query || typeFilter !== "all" ? "Try a different search or filter." : "Create your first project from the Studio."}
              action={
                <Link to="/studio" className="inline-flex h-11 items-center rounded-btn bg-gradient-to-r from-primary to-accent px-5 font-semibold text-fg-strong hover:brightness-110">
                  Create a project
                </Link>
              }
            />
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <ProjectGridCard
                key={p.id}
                project={p}
                selected={selected.has(p.id)}
                onSelect={() => toggleSelect(p.id)}
                onOpen={() => openProject(p, navigate)}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-card border border-border bg-surface">
            {filtered.map((p) => (
              <ProjectListRow
                key={p.id}
                project={p}
                selected={selected.has(p.id)}
                onSelect={() => toggleSelect(p.id)}
                onOpen={() => openProject(p, navigate)}
              />
            ))}
          </div>
        )}
      </div>

      {user?.plan === "FREE" && projects.some((p) => p.storageType === "LOCAL") && (
        <p className="mt-4 text-sm text-fg-subtle">
          <Badge tone="amber" dot>Local Only</Badge> projects are stored in your browser.{" "}
          <Link to="/pricing" className="sw-link">Upgrade to sync to cloud</Link>.
        </p>
      )}
    </div>
  );
}

function ProjectGridCard({
  project,
  selected,
  onSelect,
  onOpen,
}: {
  project: ProjectMeta;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  return (
    <div className={cn("rounded-card border bg-surface p-4 shadow-card transition-all", selected ? "border-primary" : "border-border hover:border-border-strong hover:shadow-lift")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-fg-strong">{project.title}</p>
          <p className="text-xs text-fg-subtle">{formatDate(project.updatedAt ?? project.createdAt)}</p>
        </div>
        <input type="checkbox" checked={selected} onChange={onSelect} aria-label={`Select ${project.title}`} className="mt-0.5 h-4 w-4 accent-primary" />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge tone="blue">{project.type}</Badge>
        <Badge tone="gray">{displayNameFor(project.voiceId)}</Badge>
        {project.duration != null && <Badge tone="gray">{formatDuration(project.duration)}</Badge>}
        {project.storageType === "LOCAL" && <Badge tone="amber" dot>Local Only</Badge>}
      </div>
      <button
        onClick={onOpen}
        className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-btn border border-border-strong text-sm font-medium text-fg-muted transition-colors hover:border-primary/60 hover:text-fg-strong"
      >
        <Play className="h-3.5 w-3.5" /> Open in Studio
      </button>
    </div>
  );
}

function ProjectListRow({
  project,
  selected,
  onSelect,
  onOpen,
}: {
  project: ProjectMeta;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  return (
    <div className={cn("sw-table-row flex items-center gap-3 border-b border-border px-4 py-3 last:border-0", selected && "bg-primary/5")}>
      <input type="checkbox" checked={selected} onChange={onSelect} aria-label={`Select ${project.title}`} className="h-4 w-4 accent-primary" />
      <button onClick={onOpen} className="min-w-0 flex-1 text-left">
        <p className="truncate font-medium text-fg-strong">{project.title}</p>
        <p className="truncate text-xs text-fg-subtle">{formatDate(project.updatedAt ?? project.createdAt)}</p>
      </button>
      <Badge tone="blue" className="hidden sm:inline-flex">{project.type}</Badge>
      <Badge tone="gray" className="hidden md:inline-flex">{displayNameFor(project.voiceId)}</Badge>
      {project.duration != null && <span className="hidden font-mono text-xs text-fg-subtle md:inline">{formatDuration(project.duration)}</span>}
      {project.storageType === "LOCAL" && <Badge tone="amber" dot>Local</Badge>}
    </div>
  );
}
