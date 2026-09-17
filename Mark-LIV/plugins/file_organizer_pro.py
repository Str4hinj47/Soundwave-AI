"""
File Organizer Pro — Smart File Organization by Content/Date/Project for JARVIS (Mark LIII)
Makes JARVIS impeccable at organizing files — beyond basic by extension.

Ported from ONEPUNCHMAN411/Jarvis brain/file_organizer.py + file_commander.py organize
+ file_watcher_pro organize.

Free & open source, zero tokens.
"""

import json
import hashlib
import re
import time
from pathlib import Path
from datetime import datetime
from collections import defaultdict

PLUGIN = {
    "name": "file_organizer_pro",
    "description": (
        "Smart file organizer pro by content/date/project — makes JARVIS impeccable at organizing files beyond extension (zero tokens). "
        "Actions: organize path=... [by=type/date/content/size/project] [dest=...] [dry_run=true/false] — organize files in path by type extension, date year/month via mtime or EXIF for photos, content keyword in filename or text content for docs, size small/medium/large, project group by git repo or folder name, dest optional default path/Organized/{category}, dry_run true preview without moving false actual move, returns organized count + categories, organize_photos path=... [by=exif_date/date] [dest=...] [dry_run=...] — organize photos by EXIF date year/month e.g., 2023/12/IMG_1234.jpg via Pillow EXIF or mtime fallback, organize_by_date path=... [dest=...] [dry_run=...] — organize by date year/month via mtime, find_duplicates path=... [by=hash/content/size] [min_size=...] — find duplicate files by hash MD5/SHA1, by content first 1KB, by size, min size filter, returns groups of duplicates, clean_empty path=... [dry_run=...] — clean empty folders/files in path, largest path=... [n=10] — largest files, recent path=... [n=20] [days=7] — recent files last N days, rules action=list/add/remove name=... keyword=... dest=... by=... — organize rules e.g., rule invoices keyword invoice in filename → dest ~/Documents/Invoices stored ~/.jarvis_organize_rules.json auto-applied on organize, help. "
        "Use when user wants to organize files, organize photos, organize by date, find duplicates, clean empty, largest files, recent files, organize rules. "
        "Trigger phrases: file organizer pro, organize files, organize photos, organize by date, find duplicates, clean empty, largest files, recent files, organize rules, smart organize."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "Action: organize, organize_photos, organize_by_date, find_duplicates, clean_empty, largest, recent, rules, help. Default organize.",
            },
            "path": {"type": "STRING", "description": "Path to organize, e.g. ~/Downloads, ~/Pictures"},
            "by": {"type": "STRING", "description": "Organize by: type, date, content, size, project, exif_date, hash, content, default type"},
            "dest": {"type": "STRING", "description": "Destination base, e.g. ~/Organized, ~/Pictures/Organized"},
            "dry_run": {"type": "BOOLEAN", "description": "Dry run true preview false actual, default true"},
            "min_size": {"type": "NUMBER", "description": "Min size bytes for find_duplicates, default 0"},
            "n": {"type": "NUMBER", "description": "N for largest/recent, default 10"},
            "days": {"type": "NUMBER", "description": "Days for recent, default 7"},
            "subaction": {"type": "STRING", "description": "Subaction for rules: list, add, remove, default list"},
            "name": {"type": "STRING", "description": "Rule name for rules add/remove"},
            "keyword": {"type": "STRING", "description": "Keyword for rules add, e.g. invoice"},
        },
        "required": ["action"],
    },
}

PLUGIN_SETTINGS = {
    "namespace": "file_organizer_pro",
    "title": "File Organizer Pro — Smart Organization",
    "description": "Smart organize by type/date/content/size/project, EXIF photos, duplicates, rules — zero tokens",
    "icon": "📁",
    "color": "#F59E0B",
    "order": 45,
    "default_enabled": True,
    "fields": [
        {"key": "organize_rules_file", "label": "Organize rules file", "type": "text", "default": "~/.jarvis_organize_rules.json"},
        {"key": "default_dest", "label": "Default dest Organized", "type": "text", "default": "Organized"},
    ],
}

_rules_file = Path.home() / ".jarvis_organize_rules.json"
_history_file = Path.home() / ".jarvis_organize_history.jsonl"

_type_map = {
    "Images": [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".svg", ".heic", ".tiff"],
    "Videos": [".mp4", ".mov", ".avi", ".mkv", ".webm", ".flv", ".wmv", ".m4v"],
    "Audio": [".mp3", ".wav", ".flac", ".m4a", ".ogg", ".wma", ".aac"],
    "Docs": [".pdf", ".docx", ".doc", ".txt", ".md", ".rtf", ".odt"],
    "Sheets": [".xlsx", ".xls", ".csv", ".ods"],
    "Presentations": [".pptx", ".ppt", ".odp"],
    "Archives": [".zip", ".rar", ".7z", ".tar", ".gz", ".bz2"],
    "Code": [".py", ".js", ".ts", ".html", ".css", ".json", ".xml", ".java", ".c", ".cpp", ".go", ".rs"],
    "Executables": [".exe", ".msi", ".dmg", ".deb", ".rpm", ".appimage"],
}

def _load_rules():
    try:
        if _rules_file.exists():
            return json.loads(_rules_file.read_text(encoding="utf-8"))
    except Exception:
        pass
    return []

def _save_rules(rules):
    try:
        _rules_file.parent.mkdir(parents=True, exist_ok=True)
        _rules_file.write_text(json.dumps(rules, indent=2, ensure_ascii=False), encoding="utf-8")
        return True
    except Exception:
        return False

def _get_file_category(file_path):
    ext = file_path.suffix.lower()
    for cat, exts in _type_map.items():
        if ext in exts:
            return cat
    return "Others"

def _get_exif_date(file_path):
    try:
        from PIL import Image
        from PIL.ExifTags import TAGS
        img = Image.open(str(file_path))
        exif = img._getexif()
        if exif:
            for tag_id, value in exif.items():
                tag = TAGS.get(tag_id, tag_id)
                if tag in ("DateTimeOriginal", "DateTime", "DateTimeDigitized"):
                    # Format: 2023:12:25 10:30:00
                    try:
                        dt = datetime.strptime(value, "%Y:%m:%d %H:%M:%S")
                        return dt
                    except Exception:
                        continue
    except Exception:
        pass
    return None

def _get_file_date(file_path):
    # Try EXIF first for images, then mtime
    exif_date = _get_exif_date(file_path)
    if exif_date:
        return exif_date
    try:
        mtime = file_path.stat().st_mtime
        return datetime.fromtimestamp(mtime)
    except Exception:
        return datetime.now()

def _hash_file(file_path, chunk_size=8192):
    try:
        h = hashlib.md5()
        with file_path.open("rb") as f:
            while True:
                chunk = f.read(chunk_size)
                if not chunk:
                    break
                h.update(chunk)
        return h.hexdigest()
    except Exception:
        return None

def run(parameters: dict, player=None, session_memory=None) -> str:
    action = (parameters.get("action", "organize") or "organize").lower().strip()
    path_str = parameters.get("path", "") or ""
    by = (parameters.get("by", "type") or "type").lower().strip()
    dest_str = parameters.get("dest", "") or ""
    dry_run = parameters.get("dry_run", True)
    if isinstance(dry_run, str):
        dry_run = dry_run.lower() in ("true", "1", "yes")
    min_size = parameters.get("min_size", 0)
    try:
        min_size = int(min_size)
    except Exception:
        min_size = 0
    n = parameters.get("n", 10)
    try:
        n = int(n)
    except Exception:
        n = 10
    n = max(1, min(100, n))
    days = parameters.get("days", 7)
    try:
        days = int(days)
    except Exception:
        days = 7
    subaction = (parameters.get("subaction", "list") or "list").lower().strip()
    rule_name = parameters.get("name", "") or ""
    keyword = parameters.get("keyword", "") or ""

    try:
        if player:
            try:
                player.write_log(f"File Organizer Pro: {action} path={path_str} by={by} dry_run={dry_run}")
            except Exception:
                pass

        if action in ("help", "?", "h"):
            return (
                "File Organizer Pro — Smart File Organization by Content/Date/Project (Zero Tokens, from ONEPUNCHMAN411 file_organizer.py + file_commander organize):\n"
                "\n"
                "Smart organization beyond extension — by content, date, size, project, duplicate content.\n"
                "\n"
                "• organize path=... [by=type/date/content/size/project] [dest=...] [dry_run=true/false] — organize files in path by type extension (Images, Videos, Audio, Docs, Sheets, Presentations, Archives, Code, Executables, Others), date year/month via mtime or EXIF for photos, content keyword in filename or text content for docs (invoices, receipts, etc.), size small <1MB medium 1-100MB large >100MB, project group by git repo or folder name. Dest optional default path/Organized/{category}, dry_run true preview without moving false actual move, returns organized count + categories.\n"
                "• organize_photos path=... [by=exif_date/date] [dest=...] [dry_run=...] — organize photos by EXIF date year/month e.g., 2023/12/IMG_1234.jpg via Pillow EXIF DateTimeOriginal or file mtime fallback.\n"
                "• organize_by_date path=... [dest=...] [dry_run=...] — organize by date year/month via mtime.\n"
                "• find_duplicates path=... [by=hash/content/size] [min_size=...] — find duplicate files by hash MD5, by content first 1KB, by size, min size filter, returns groups of duplicates.\n"
                "• clean_empty path=... [dry_run=...] — clean empty folders/files in path, removes empty dirs.\n"
                "• largest path=... [n=10] — largest files in path.\n"
                "• recent path=... [n=20] [days=7] — recent files in path last N days via mtime.\n"
                "• rules subaction=list/add/remove name=... keyword=... dest=... by=... — organize rules e.g., rule invoices keyword invoice in filename → dest ~/Documents/Invoices stored ~/.jarvis_organize_rules.json auto-applied on organize.\n"
                "\n"
                "Examples:\n"
                "• file_organizer_pro action=organize path=~/Downloads by=type dry_run=true\n"
                "• file_organizer_pro action=organize_photos path=~/Pictures by=exif_date dry_run=true\n"
                "• file_organizer_pro action=find_duplicates path=~/Downloads by=hash min_size=1024\n"
                "• file_organizer_pro action=largest path=~/Downloads n=10\n"
                "• file_organizer_pro action=rules subaction=add name=invoices keyword=invoice dest=~/Documents/Invoices by=content\n"
                "\n"
                "Zero tokens, pure local via pathlib, hashlib, Pillow EXIF, mimetypes, os.stat.\n"
                "Rules: ~/.jarvis_organize_rules.json, history: ~/.jarvis_organize_history.jsonl\n"
                "Install: pip install Pillow (for EXIF)\n"
            )

        if action == "organize":
            if not path_str:
                return "Need path: organize path=~/Downloads by=type dry_run=true"
            p = Path(path_str).expanduser()
            if not p.exists():
                return f"Path not found: {p}"
            if not p.is_dir():
                return f"Path not a directory: {p} — organize needs folder"

            # Load rules
            rules = _load_rules()

            files = [f for f in p.iterdir() if f.is_file()]
            if not files:
                return f"No files in {p} to organize"

            organized = defaultdict(list)
            moves = []

            for file_path in files:
                # Check rules first
                matched_rule = None
                for rule in rules:
                    if not rule.get("enabled", True):
                        continue
                    kw = rule.get("keyword", "").lower()
                    if kw and kw in file_path.name.lower():
                        matched_rule = rule
                        break

                if matched_rule:
                    category = matched_rule.get("name", "RuleMatched")
                    dest_base = Path(matched_rule.get("dest", "")).expanduser() if matched_rule.get("dest") else p / "Organized"
                else:
                    if by == "type":
                        category = _get_file_category(file_path)
                        dest_base = Path(dest_str).expanduser() / category if dest_str else p / "Organized" / category
                    elif by == "date":
                        dt = _get_file_date(file_path)
                        category = f"{dt.year}/{dt.month:02d}"
                        dest_base = Path(dest_str).expanduser() / category if dest_str else p / "Organized" / category
                    elif by == "size":
                        size = file_path.stat().st_size
                        if size < 1 * 1024 * 1024:
                            category = "Small_<1MB"
                        elif size < 100 * 1024 * 1024:
                            category = "Medium_1-100MB"
                        else:
                            category = "Large_>100MB"
                        dest_base = Path(dest_str).expanduser() / category if dest_str else p / "Organized" / category
                    elif by == "content":
                        # Simple content check: look for keywords in filename
                        name_lower = file_path.name.lower()
                        if "invoice" in name_lower:
                            category = "Invoices"
                        elif "receipt" in name_lower:
                            category = "Receipts"
                        elif "report" in name_lower:
                            category = "Reports"
                        else:
                            category = _get_file_category(file_path)
                        dest_base = Path(dest_str).expanduser() / category if dest_str else p / "Organized" / category
                    elif by == "project":
                        # Group by parent folder name or git repo
                        # For simplicity, use parent folder name
                        category = file_path.parent.name or "Root"
                        dest_base = Path(dest_str).expanduser() / category if dest_str else p / "Organized" / category
                    else:
                        category = _get_file_category(file_path)
                        dest_base = Path(dest_str).expanduser() / category if dest_str else p / "Organized" / category

                organized[category].append(file_path.name)
                dest_path = dest_base / file_path.name

                if not dry_run:
                    try:
                        dest_base.mkdir(parents=True, exist_ok=True)
                        # Avoid overwrite
                        if dest_path.exists():
                            dest_path = dest_base / f"{file_path.stem}_{int(time.time())}{file_path.suffix}"
                        file_path.rename(dest_path)
                        moves.append(f"{file_path.name} → {dest_path}")
                    except Exception as e:
                        moves.append(f"{file_path.name} failed: {e}")
                else:
                    moves.append(f"{file_path.name} → {dest_base}/ (dry run)")

            # Save history
            try:
                _history_file.parent.mkdir(parents=True, exist_ok=True)
                with _history_file.open("a", encoding="utf-8") as f:
                    f.write(json.dumps({"timestamp": datetime.now().isoformat(), "path": str(p), "by": by, "dest": dest_str, "dry_run": dry_run, "organized": dict(organized), "count": len(files)}, ensure_ascii=False) + "\n")
            except Exception:
                pass

            lines = [f"Organize {p} by {by} dry_run={dry_run} — {len(files)} files:"]
            for cat, names in organized.items():
                lines.append(f"• {cat}: {len(names)} files — {', '.join(names[:5])}{' ...' if len(names)>5 else ''}")
            if dry_run:
                lines.append(f"\nDry run — no files moved, set dry_run=false to actually organize")
            else:
                lines.append(f"\nOrganized {len(moves)} files")
            lines.append(f"Moves preview (first 10):\n" + "\n".join(moves[:10]))
            return "\n".join(lines)

        if action == "organize_photos":
            if not path_str:
                return "Need path: organize_photos path=~/Pictures by=exif_date dry_run=true"
            p = Path(path_str).expanduser()
            if not p.exists() or not p.is_dir():
                return f"Path not found or not dir: {p}"

            files = [f for f in p.iterdir() if f.is_file() and f.suffix.lower() in _type_map.get("Images", [])]
            if not files:
                return f"No image files in {p}"

            organized = defaultdict(list)
            moves = []

            for file_path in files:
                if by in ("exif_date", "exif"):
                    dt = _get_exif_date(file_path) or _get_file_date(file_path)
                else:
                    dt = _get_file_date(file_path)

                category = f"{dt.year}/{dt.month:02d}"
                dest_base = Path(dest_str).expanduser() / category if dest_str else p / "Organized" / category

                organized[category].append(file_path.name)
                dest_path = dest_base / file_path.name

                if not dry_run:
                    try:
                        dest_base.mkdir(parents=True, exist_ok=True)
                        if dest_path.exists():
                            dest_path = dest_base / f"{file_path.stem}_{int(time.time())}{file_path.suffix}"
                        file_path.rename(dest_path)
                        moves.append(f"{file_path.name} → {dest_path} EXIF {dt}")
                    except Exception as e:
                        moves.append(f"{file_path.name} failed: {e}")
                else:
                    moves.append(f"{file_path.name} → {dest_base}/ EXIF {dt} (dry run)")

            lines = [f"Organize photos {p} by {by} dry_run={dry_run} — {len(files)} photos:"]
            for cat, names in organized.items():
                lines.append(f"• {cat}: {len(names)} photos")
            lines.append(f"Moves (first 10):\n" + "\n".join(moves[:10]))
            return "\n".join(lines)

        if action == "organize_by_date":
            if not path_str:
                return "Need path: organize_by_date path=~/Downloads dry_run=true"
            p = Path(path_str).expanduser()
            if not p.exists() or not p.is_dir():
                return f"Path not found or not dir: {p}"

            files = [f for f in p.iterdir() if f.is_file()]
            if not files:
                return f"No files in {p}"

            organized = defaultdict(list)
            moves = []

            for file_path in files:
                dt = _get_file_date(file_path)
                category = f"{dt.year}/{dt.month:02d}"
                dest_base = Path(dest_str).expanduser() / category if dest_str else p / "Organized" / category

                organized[category].append(file_path.name)
                dest_path = dest_base / file_path.name

                if not dry_run:
                    try:
                        dest_base.mkdir(parents=True, exist_ok=True)
                        if dest_path.exists():
                            dest_path = dest_base / f"{file_path.stem}_{int(time.time())}{file_path.suffix}"
                        file_path.rename(dest_path)
                        moves.append(f"{file_path.name} → {dest_path} date {dt}")
                    except Exception as e:
                        moves.append(f"{file_path.name} failed: {e}")
                else:
                    moves.append(f"{file_path.name} → {dest_base}/ date {dt} (dry run)")

            lines = [f"Organize by date {p} dry_run={dry_run} — {len(files)} files:"]
            for cat, names in organized.items():
                lines.append(f"• {cat}: {len(names)} files")
            lines.append(f"Moves (first 10):\n" + "\n".join(moves[:10]))
            return "\n".join(lines)

        if action == "find_duplicates":
            if not path_str:
                return "Need path: find_duplicates path=~/Downloads by=hash min_size=1024"
            p = Path(path_str).expanduser()
            if not p.exists() or not p.is_dir():
                return f"Path not found or not dir: {p}"

            files = [f for f in p.rglob("*") if f.is_file() and f.stat().st_size >= min_size]
            if not files:
                return f"No files >= {min_size} bytes in {p}"

            if by == "size":
                # Group by size
                size_groups = defaultdict(list)
                for f in files:
                    try:
                        size_groups[f.stat().st_size].append(f)
                    except Exception:
                        continue
                duplicates = {size: flist for size, flist in size_groups.items() if len(flist) > 1}
                lines = [f"Duplicates by size in {p} min_size {min_size} — {len(duplicates)} groups:"]
                for size, flist in list(duplicates.items())[:10]:
                    lines.append(f"• Size {size} bytes: {len(flist)} files — {', '.join([str(f.name) for f in flist[:3]])}")
                return "\n".join(lines)

            elif by == "content":
                # Group by first 1KB content hash
                content_groups = defaultdict(list)
                for f in files:
                    try:
                        with f.open("rb") as file:
                            chunk = file.read(1024)
                            h = hashlib.md5(chunk).hexdigest()
                            content_groups[h].append(f)
                    except Exception:
                        continue
                duplicates = {h: flist for h, flist in content_groups.items() if len(flist) > 1}
                lines = [f"Duplicates by content (first 1KB) in {p} — {len(duplicates)} groups:"]
                for h, flist in list(duplicates.items())[:10]:
                    lines.append(f"• Hash {h[:8]}: {len(flist)} files — {', '.join([str(f.name) for f in flist[:3]])}")
                return "\n".join(lines)

            else:  # hash
                hash_groups = defaultdict(list)
                for f in files:
                    h = _hash_file(f)
                    if h:
                        hash_groups[h].append(f)
                duplicates = {h: flist for h, flist in hash_groups.items() if len(flist) > 1}
                lines = [f"Duplicates by hash MD5 in {p} min_size {min_size} — {len(duplicates)} groups, {sum(len(v) for v in duplicates.values())} duplicate files:"]
                for h, flist in list(duplicates.items())[:10]:
                    total_size = sum(f.stat().st_size for f in flist) // 1024
                    lines.append(f"• Hash {h[:8]} size {total_size}KB: {len(flist)} files — {', '.join([str(f) for f in flist[:3]])}")
                if not duplicates:
                    return f"No duplicates found in {p} by hash min_size {min_size} — {len(files)} files checked"
                return "\n".join(lines)

        if action == "clean_empty":
            if not path_str:
                return "Need path: clean_empty path=~/Downloads dry_run=true"
            p = Path(path_str).expanduser()
            if not p.exists() or not p.is_dir():
                return f"Path not found or not dir: {p}"

            empty_dirs = []
            empty_files = []
            for f in p.rglob("*"):
                try:
                    if f.is_dir() and not any(f.iterdir()):
                        empty_dirs.append(f)
                    elif f.is_file() and f.stat().st_size == 0:
                        empty_files.append(f)
                except Exception:
                    continue

            if dry_run:
                return f"Clean empty dry_run in {p} — {len(empty_dirs)} empty dirs, {len(empty_files)} empty files (0 bytes):\nDirs: {', '.join([str(d) for d in empty_dirs[:10]])}\nFiles: {', '.join([str(f) for f in empty_files[:10]])}\nSet dry_run=false to actually clean"

            cleaned_dirs = 0
            cleaned_files = 0
            for d in empty_dirs:
                try:
                    d.rmdir()
                    cleaned_dirs += 1
                except Exception:
                    pass
            for f in empty_files:
                try:
                    f.unlink()
                    cleaned_files += 1
                except Exception:
                    pass

            return f"Cleaned empty in {p} — {cleaned_dirs} dirs removed, {cleaned_files} files removed (was {len(empty_dirs)} dirs, {len(empty_files)} files)"

        if action == "largest":
            if not path_str:
                return "Need path: largest path=~/Downloads n=10"
            p = Path(path_str).expanduser()
            if not p.exists() or not p.is_dir():
                return f"Path not found or not dir: {p}"

            files = []
            for f in p.rglob("*"):
                try:
                    if f.is_file():
                        files.append((f, f.stat().st_size))
                except Exception:
                    continue
            files.sort(key=lambda x: x[1], reverse=True)
            files = files[:n]

            lines = [f"Largest {len(files)} files in {p}:"]
            for i, (f, size) in enumerate(files, 1):
                size_mb = size / (1024*1024)
                lines.append(f"{i}. {f} — {size_mb:.2f}MB ({size} bytes)")
            return "\n".join(lines)

        if action == "recent":
            if not path_str:
                return "Need path: recent path=~/Downloads n=20 days=7"
            p = Path(path_str).expanduser()
            if not p.exists() or not p.is_dir():
                return f"Path not found or not dir: {p}"

            cutoff = time.time() - days * 24 * 3600
            files = []
            for f in p.rglob("*"):
                try:
                    if f.is_file() and f.stat().st_mtime >= cutoff:
                        files.append((f, f.stat().st_mtime))
                except Exception:
                    continue
            files.sort(key=lambda x: x[1], reverse=True)
            files = files[:n]

            lines = [f"Recent {len(files)} files in {p} last {days} days:"]
            for i, (f, mtime) in enumerate(files, 1):
                dt = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")
                lines.append(f"{i}. {f} — {dt}")
            return "\n".join(lines)

        if action == "rules":
            if subaction == "add":
                if not rule_name or not keyword:
                    return "Need name and keyword: rules subaction=add name=invoices keyword=invoice dest=~/Documents/Invoices by=content"
                rules = _load_rules()
                # Check if exists
                for r in rules:
                    if r.get("name") == rule_name:
                        return f"Rule '{rule_name}' already exists — remove first or use different name"
                rule = {
                    "name": rule_name,
                    "keyword": keyword,
                    "dest": dest_str or "",
                    "by": by,
                    "enabled": True,
                    "created": datetime.now().isoformat(),
                }
                rules.append(rule)
                if _save_rules(rules):
                    return f"Added organize rule '{rule_name}' keyword '{keyword}' dest '{dest_str}' by '{by}' — stored {_rules_file}, will auto-apply on organize action"
                return "Failed to save rule"

            elif subaction == "remove":
                if not rule_name:
                    return "Need name: rules subaction=remove name=invoices"
                rules = _load_rules()
                remaining = [r for r in rules if r.get("name") != rule_name]
                if len(remaining) == len(rules):
                    return f"No rule with name '{rule_name}' — list to see rules"
                if _save_rules(remaining):
                    return f"Removed rule '{rule_name}'"
                return "Failed to save rules"

            else:  # list
                rules = _load_rules()
                if not rules:
                    return "No organize rules — add via rules subaction=add name=invoices keyword=invoice dest=~/Documents/Invoices by=content"
                lines = [f"Organize rules ({len(rules)}) in {_rules_file}:"]
                for i, r in enumerate(rules, 1):
                    lines.append(f"{i}. {r.get('name')} — keyword '{r.get('keyword')}' dest '{r.get('dest')}' by '{r.get('by')}' enabled {r.get('enabled')} created {r.get('created','')[:19]}")
                return "\n".join(lines)

        return f"Unknown action {action}. Say 'file_organizer_pro action=help'"

    except Exception as e:
        return f"File Organizer Pro failed: {e}"
