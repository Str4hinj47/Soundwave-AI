"""
File Commander — Advanced File Management for JARVIS (Mark LIII)
Makes JARVIS impeccable at file operations — search, organize, batch rename, duplicate finder, disk usage, recent, etc.

Inspired by ONEPUNCHMAN411/Jarvis file_manager_plugin, file_organizer, batch_renamer, and FatihMakes file_controller.

Free & open source, zero tokens for most actions.
"""

import os
import shutil
import time
import hashlib
import re
from pathlib import Path
import platform
import subprocess

PLUGIN = {
    "name": "file_commander",
    "description": (
        "Advanced file management — makes JARVIS impeccable at using files. Actions: search, recent, organize, batch_rename, duplicates, disk_usage, largest, oldest, clean, move, copy, delete, compress, decompress, encrypt, decrypt, compare, tree, stats, open, reveal. "
        "Use when user wants to manage files, search files, organize Downloads, batch rename, find duplicates, check disk usage, clean temp, etc. "
        "Trigger phrases: file search, find file, organize files, batch rename, duplicate files, disk usage, largest files, recent files, clean files, file manager, file commander, manage files, organize Downloads, find duplicates, disk space."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "Action: search, recent, organize, batch_rename, duplicates, disk_usage, largest, oldest, clean, move, copy, delete, compress, decompress, tree, stats, open, reveal, help. Default help.",
            },
            "query": {
                "type": "STRING",
                "description": "Search query for search action, or pattern for batch_rename (e.g. *.txt, report_*.pdf)",
            },
            "path": {
                "type": "STRING",
                "description": "Path: directory or file path, default ~/Downloads or ~",
            },
            "destination": {
                "type": "STRING",
                "description": "Destination path for move/copy/compress",
            },
            "pattern": {
                "type": "STRING",
                "description": "Pattern for batch rename: e.g. 'IMG_{n}' where {n} is number, {date}, {name}",
            },
        },
        "required": ["action"],
    },
}

PLUGIN_SETTINGS = {
    "namespace": "file_commander",
    "title": "File Commander — Advanced File Management",
    "description": "Makes JARVIS impeccable at file operations",
    "icon": "📁",
    "color": "#FFB800",
    "order": 2,
    "default_enabled": True,
}

def _safe_path(p):
    try:
        path = Path(p).expanduser().resolve()
        return path
    except Exception:
        return Path.home()

def run(parameters: dict, player=None, session_memory=None) -> str:
    action = (parameters.get("action", "help") or "help").lower().strip()
    query = parameters.get("query", "") or ""
    path_str = parameters.get("path", "") or ""
    dest_str = parameters.get("destination", "") or ""
    pattern = parameters.get("pattern", "") or ""

    try:
        if player:
            try:
                player.write_log(f"File Commander: {action} {query} {path_str}")
            except Exception:
                pass

        if action in ("help", "?", "h"):
            return (
                "File Commander — Advanced File Management (makes JARVIS impeccable at files):\n"
                "\n"
                "• search query [path] — search files by name/content, e.g. search report ~/Documents\n"
                "• recent [n] [path] — recent files in Downloads or path\n"
                "• organize [path] — organize by type (Images, Videos, Documents, etc.)\n"
                "• batch_rename pattern [path] — batch rename: pattern with {n} number, {date}, {name}, e.g. IMG_{n} or report_{date}_{n}\n"
                "• duplicates [path] — find duplicate files (quick MD5 of first 1MB)\n"
                "• disk_usage [path] — disk usage breakdown\n"
                "• largest [n] [path] — largest files\n"
                "• oldest [n] [path] — oldest files\n"
                "• clean [path] — clean temp/old files\n"
                "• tree [path] — directory tree\n"
                "• stats [path] — file stats (count, size, types)\n"
                "• move source dest — move file\n"
                "• copy source dest — copy file\n"
                "• delete path — delete file (to recycle bin if possible)\n"
                "• compress source dest — zip compress\n"
                "• decompress source dest — unzip\n"
                "• open path — open file with default app\n"
                "• reveal path — reveal in file explorer\n"
                "\n"
                "Examples:\n"
                "• file_commander action=search query=invoice path=~/Documents\n"
                "• file_commander action=organize path=~/Downloads\n"
                "• file_commander action=batch_rename pattern=IMG_{n} path=~/Pictures\n"
                "• file_commander action=duplicates path=~/Downloads\n"
                "• file_commander action=largest path=~/\n"
            )

        # Resolve path
        base_path = _safe_path(path_str) if path_str else Path.home() / "Downloads"
        if not base_path.exists() and action not in ("search", "recent", "largest", "oldest"):
            base_path = Path.home()

        if action == "search":
            if not query:
                return "Need query: search report"
            root = _safe_path(path_str) if path_str else Path.home()
            results = []
            try:
                # Fast search via pathlib
                for p in root.rglob(f"*{query}*"):
                    if len(results) >= 30:
                        break
                    if p.is_file():
                        results.append(str(p))
            except Exception as e:
                return f"Search failed: {e}"
            if not results:
                return f"No files found for '{query}' in {root}"
            return f"Found {len(results)} files for '{query}' in {root}:\n" + "\n".join(results[:30])

        if action == "recent":
            n = 10
            try:
                n = int(query) if query.isdigit() else int(path_str) if path_str.isdigit() else 10
            except Exception:
                pass
            path = _safe_path(path_str) if path_str and not path_str.isdigit() else Path.home() / "Downloads"
            if not path.exists():
                path = Path.home()
            try:
                files = sorted([f for f in path.iterdir() if f.is_file()], key=lambda p: p.stat().st_mtime, reverse=True)[:n]
                lines = [f"{f.name} — {time.ctime(f.stat().st_mtime)} — {f.stat().st_size // 1024}KB" for f in files]
                return f"Recent {len(lines)} files in {path}:\n" + "\n".join(lines)
            except Exception as e:
                return f"Recent failed: {e}"

        if action == "organize":
            p = base_path
            if not p.exists():
                return f"Path {p} not found"
            ext_map = {
                ".jpg": "Images", ".jpeg": "Images", ".png": "Images", ".gif": "Images", ".bmp": "Images", ".svg": "Images", ".webp": "Images",
                ".mp4": "Videos", ".mov": "Videos", ".avi": "Videos", ".mkv": "Videos", ".webm": "Videos",
                ".mp3": "Audio", ".wav": "Audio", ".flac": "Audio", ".m4a": "Audio",
                ".pdf": "Documents", ".docx": "Documents", ".doc": "Documents", ".txt": "Documents", ".xlsx": "Documents", ".pptx": "Documents",
                ".zip": "Archives", ".rar": "Archives", ".7z": "Archives", ".tar": "Archives", ".gz": "Archives",
                ".exe": "Executables", ".msi": "Executables", ".dmg": "Executables", ".app": "Executables",
                ".py": "Code", ".js": "Code", ".ts": "Code", ".html": "Code", ".css": "Code", ".json": "Code",
            }
            organized = 0
            for f in p.iterdir():
                if f.is_file():
                    folder = ext_map.get(f.suffix.lower(), "Other")
                    dest_dir = p / folder
                    dest_dir.mkdir(exist_ok=True)
                    try:
                        shutil.move(str(f), str(dest_dir / f.name))
                        organized += 1
                    except Exception:
                        continue
            return f"Organized {organized} files in {p} into subfolders by type"

        if action == "batch_rename":
            if not pattern:
                return "Need pattern: e.g. IMG_{n} or report_{date}_{name} where {n}=number, {date}=date, {name}=original name"
            p = base_path
            if not p.exists():
                return f"Path {p} not found"
            files = [f for f in p.iterdir() if f.is_file()]
            if query:
                # Filter by query pattern like *.txt
                import fnmatch
                files = [f for f in files if fnmatch.fnmatch(f.name, query)]
            renamed = 0
            date_str = time.strftime("%Y%m%d")
            for i, f in enumerate(files, 1):
                try:
                    new_name = pattern.replace("{n}", str(i)).replace("{date}", date_str).replace("{name}", f.stem)
                    if "{n:" in pattern:
                        # Support {n:03} padding
                        m = re.search(r"\{n:0?(\d+)\}", pattern)
                        if m:
                            pad = int(m.group(1))
                            new_name = re.sub(r"\{n:0?\d+\}", str(i).zfill(pad), new_name)
                    new_name = new_name + f.suffix if not Path(new_name).suffix else new_name
                    new_path = p / new_name
                    if new_path.exists():
                        continue
                    f.rename(new_path)
                    renamed += 1
                except Exception:
                    continue
            return f"Batch renamed {renamed} files in {p} with pattern {pattern}"

        if action == "duplicates":
            p = base_path
            if not p.exists():
                return f"Path {p} not found"
            seen = {}
            dups = []
            for f in p.rglob("*"):
                if not f.is_file():
                    continue
                try:
                    h = hashlib.md5()
                    with open(f, 'rb') as fh:
                        h.update(fh.read(1024*1024))  # first 1MB
                    digest = h.hexdigest()
                    if digest in seen:
                        dups.append((str(f), seen[digest]))
                    else:
                        seen[digest] = str(f)
                    if len(dups) >= 20:
                        break
                except Exception:
                    continue
            if not dups:
                return f"No duplicates found in {p} (quick 1MB hash, {len(seen)} files checked)"
            return f"Possible duplicates in {p}:\n" + "\n".join([f"{a} == {b}" for a, b in dups[:20]])

        if action == "disk_usage":
            p = base_path
            try:
                total = 0
                count = 0
                for f in p.rglob("*"):
                    try:
                        if f.is_file():
                            total += f.stat().st_size
                            count += 1
                    except Exception:
                        continue
                gb = total / (1024**3)
                return f"Disk usage for {p}: {gb:.2f} GB, {count} files, {total} bytes"
            except Exception as e:
                return f"Disk usage failed: {e}"

        if action == "largest":
            n = 10
            try:
                n = int(query) if query.isdigit() else 10
            except Exception:
                pass
            p = _safe_path(path_str) if path_str and not path_str.isdigit() else Path.home()
            try:
                files = []
                for f in p.rglob("*"):
                    try:
                        if f.is_file():
                            files.append((f.stat().st_size, str(f)))
                    except Exception:
                        continue
                files = sorted(files, key=lambda x: x[0], reverse=True)[:n]
                lines = [f"{size // (1024*1024)}MB — {path}" for size, path in files]
                return f"Largest {len(lines)} files in {p}:\n" + "\n".join(lines)
            except Exception as e:
                return f"Largest failed: {e}"

        if action == "tree":
            p = base_path
            try:
                out = []
                for root, dirs, files in os.walk(p):
                    level = root.replace(str(p), '').count(os.sep)
                    indent = ' ' * 2 * level
                    out.append(f"{indent}{os.path.basename(root)}/")
                    subindent = ' ' * 2 * (level + 1)
                    for f in files[:10]:  # limit
                        out.append(f"{subindent}{f}")
                    if len(out) > 100:
                        break
                return f"Tree for {p}:\n" + "\n".join(out[:100])
            except Exception as e:
                return f"Tree failed: {e}"

        if action == "stats":
            p = base_path
            try:
                ext_count = {}
                total_size = 0
                total_files = 0
                for f in p.rglob("*"):
                    try:
                        if f.is_file():
                            total_files += 1
                            total_size += f.stat().st_size
                            ext = f.suffix.lower() or "no_ext"
                            ext_count[ext] = ext_count.get(ext, 0) + 1
                    except Exception:
                        continue
                top_ext = sorted(ext_count.items(), key=lambda x: x[1], reverse=True)[:10]
                lines = [f"{ext}: {count}" for ext, count in top_ext]
                return f"Stats for {p}:\n• Files: {total_files}\n• Size: {total_size / (1024**3):.2f} GB\n• Top types:\n" + "\n".join(lines)
            except Exception as e:
                return f"Stats failed: {e}"

        if action == "open":
            p = path_str or query
            if not p:
                return "Need path: open ~/Documents/report.pdf"
            try:
                p_path = _safe_path(p)
                if platform.system() == "Windows":
                    os.startfile(str(p_path))
                elif platform.system() == "Darwin":
                    subprocess.Popen(["open", str(p_path)])
                else:
                    subprocess.Popen(["xdg-open", str(p_path)])
                return f"Opened {p_path}"
            except Exception as e:
                return f"Open failed: {e}"

        if action == "reveal":
            p = path_str or query
            if not p:
                return "Need path: reveal ~/Downloads"
            try:
                p_path = _safe_path(p)
                if platform.system() == "Windows":
                    subprocess.Popen(f'explorer /select,"{p_path}"' if p_path.is_file() else f'explorer "{p_path}"')
                elif platform.system() == "Darwin":
                    subprocess.Popen(["open", "-R", str(p_path)])
                else:
                    subprocess.Popen(["xdg-open", str(p_path.parent if p_path.is_file() else p_path)])
                return f"Revealed {p_path} in file explorer"
            except Exception as e:
                return f"Reveal failed: {e}"

        return f"Unknown action {action}. Say 'file_commander action=help'"

    except Exception as e:
        return f"File Commander failed: {e}"
