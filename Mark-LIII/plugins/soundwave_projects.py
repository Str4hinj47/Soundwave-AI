"""
Soundwave AI Projects — Mark LIII Plugin

Teaches JARVIS to manage Soundwave AI projects (TTS, Subtitle, Video).

Soundwave projects (server/src/routes/projects.ts):
- Schema: title (1-120), type TTS|SUBTITLE|VIDEO, textContent (20k max), voiceId, voiceSettings, characterCount, duration, subtitleData, subtitleStyle, videoBackgroundUrl, audioUrl, status DRAFT|PROCESSING|COMPLETED|FAILED, storageType CLOUD|LOCAL
- Endpoints: GET /api/v1/projects (list), POST / (create, Pro+), GET /:id, PUT /:id, PUT /:id/subtitles, DELETE /:id, POST /:id/duplicate
- Free plan: local only (IndexedDB + localProjects.ts), Pro: cloud save
- Frontend: Dashboard shows recent, Projects page lists all, Studio saves via saveLocalProject or cloud API

This plugin lets JARVIS:
- List local Soundwave projects (~/Soundwave/projects/)
- Create project structure
- Duplicate, delete
- Show project stats

Install: pip install requests
"""

PLUGIN = {
    "name": "soundwave_projects",
    "description": (
        "Manages Soundwave AI projects — TTS, Subtitle, Video projects. "
        "Use when user asks to list projects, show my projects, create project, duplicate project, delete project, project status, my soundwave projects. "
        "Projects are stored locally ~/Soundwave/projects/ + optionally cloud via Soundwave API (Pro+). "
        "Trigger phrases: list projects, my projects, soundwave projects, create project, show projects, project status."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {"type": "STRING", "description": "Action: list, create, show, duplicate, delete, stats. Default list."},
            "title": {"type": "STRING", "description": "Project title for create"},
            "type": {"type": "STRING", "description": "Project type: TTS, SUBTITLE, VIDEO. Default TTS"},
            "project_id": {"type": "STRING", "description": "Project id or folder name for show/duplicate/delete"},
        },
        "required": [],
    },
}

def run(parameters: dict, player=None, session_memory=None) -> str:
    action = (parameters.get("action", "list") or "list").lower()
    title = parameters.get("title", "") or "Untitled Project"
    proj_type = (parameters.get("type", "TTS") or "TTS").upper()
    project_id = parameters.get("project_id", "") or ""

    try:
        from pathlib import Path
        import json
        import time
        import shutil

        base_dir = Path.home() / "Soundwave" / "projects"
        base_dir.mkdir(parents=True, exist_ok=True)

        if action == "list":
            projects = []
            for p in base_dir.iterdir():
                if p.is_dir():
                    meta_file = p / "project.json"
                    if meta_file.exists():
                        try:
                            meta = json.loads(meta_file.read_text(encoding="utf-8"))
                            projects.append({"folder": p.name, "meta": meta, "path": str(p)})
                        except Exception:
                            projects.append({"folder": p.name, "meta": {"title": p.name}, "path": str(p)})
                    else:
                        projects.append({"folder": p.name, "meta": {"title": p.name}, "path": str(p)})

            if not projects:
                result = f"No Soundwave projects found in {base_dir}. Create one via soundwave_projects action=create title=\"My First Voiceover\" or via soundwave_studio action=create_project."
            else:
                lines = [f"Found {len(projects)} Soundwave projects in {base_dir}:"]
                for proj in projects[:20]:
                    meta = proj["meta"]
                    lines.append(f"• {meta.get('title', proj['folder'])} ({meta.get('type', 'TTS')}) — {proj['folder']} — {meta.get('created', '')} — voice {meta.get('voice', 'Jenny')}")
                if len(projects) > 20:
                    lines.append(f"... and {len(projects)-20} more")
                result = "\n".join(lines)

            if player:
                try:
                    player.write_log(f"JARVIS: {result}")
                except Exception:
                    pass
            return result

        elif action == "create":
            safe_title = "".join(c if c.isalnum() or c in (" ", "_", "-") else "_" for c in title)[:50]
            folder_name = f"{safe_title.replace(' ', '_')}_{int(time.time())}"
            proj_dir = base_dir / folder_name
            proj_dir.mkdir(parents=True, exist_ok=True)
            info = {
                "title": title,
                "type": proj_type if proj_type in ("TTS", "SUBTITLE", "VIDEO") else "TTS",
                "created": time.strftime("%Y-%m-%d %H:%M:%S"),
                "status": "DRAFT",
                "storageType": "LOCAL",
                "voiceId": "en-US-JennyNeural",
                "characterCount": 0,
            }
            (proj_dir / "project.json").write_text(json.dumps(info, indent=2), encoding="utf-8")
            result = f"Created Soundwave project '{title}' ({proj_type}) at {proj_dir}. Use soundwave_studio action=tts to generate audio into this project."
            if player:
                try:
                    player.write_log(f"JARVIS: {result}")
                except Exception:
                    pass
            return result

        elif action == "show" and project_id:
            # Find project
            target = None
            for p in base_dir.iterdir():
                if project_id in p.name or p.name == project_id:
                    target = p
                    break
            if not target or not target.exists():
                return f"Project '{project_id}' not found in {base_dir}. List via action=list."
            meta_file = target / "project.json"
            if meta_file.exists():
                meta = json.loads(meta_file.read_text(encoding="utf-8"))
                result = f"Project {target.name}:\n{json.dumps(meta, indent=2)}\nPath: {target}\nFiles: {', '.join([f.name for f in target.iterdir()][:10])}"
            else:
                result = f"Project {target.name} at {target} — no metadata, files: {', '.join([f.name for f in target.iterdir()][:10])}"
            return result

        elif action == "duplicate" and project_id:
            target = None
            for p in base_dir.iterdir():
                if project_id in p.name:
                    target = p
                    break
            if not target:
                return f"Project '{project_id}' not found."
            new_name = f"{target.name}_copy_{int(time.time())}"
            new_dir = base_dir / new_name
            shutil.copytree(target, new_dir)
            return f"Duplicated {target.name} → {new_name} at {new_dir}"

        elif action == "delete" and project_id:
            target = None
            for p in base_dir.iterdir():
                if project_id in p.name:
                    target = p
                    break
            if not target:
                return f"Project '{project_id}' not found."
            # Safety: use send2trash if available, else rmtree
            try:
                import send2trash
                send2trash.send2trash(str(target))
                return f"Moved project {target.name} to trash (send2trash)."
            except Exception:
                shutil.rmtree(target)
                return f"Deleted project {target.name} at {target}."

        elif action == "stats":
            total = len(list(base_dir.iterdir()))
            # Count by type
            types = {}
            for p in base_dir.iterdir():
                if p.is_dir():
                    mf = p / "project.json"
                    if mf.exists():
                        try:
                            meta = json.loads(mf.read_text(encoding="utf-8"))
                            t = meta.get("type", "UNKNOWN")
                            types[t] = types.get(t, 0) + 1
                        except Exception:
                            pass
            result = f"Soundwave Projects Stats: {total} total in {base_dir}. By type: {types}. Storage: LOCAL (free) + CLOUD (Pro+ via API /api/v1/projects). Quotas: Free 10k chars/mo, Pro 200k, Enterprise 2M."
            return result

        else:
            return (
                "Soundwave Projects — manage TTS/SUBTITLE/VIDEO projects.\n"
                "Actions:\n"
                "• list: show all projects in ~/Soundwave/projects/\n"
                "• create: title + type (TTS/SUBTITLE/VIDEO) → creates folder + project.json\n"
                "• show: project_id (folder name substring) → details\n"
                "• duplicate: project_id → copy\n"
                "• delete: project_id → trash/delete\n"
                "• stats: counts by type\n"
                f"Base dir: {base_dir}\n"
                "Cloud: via Soundwave API GET /api/v1/projects (auth, Pro+), POST / (create), etc."
            )

    except Exception as e:
        return f"Soundwave projects failed: {e}"
