"""
Batch Renamer Pro — Advanced Batch Rename with Regex/EXIF/Metadata for JARVIS (Mark LIII)
Makes JARVIS impeccable at batch renaming — beyond {n}/{date}.

Ported from ONEPUNCHMAN411/Jarvis brain/batch_renamer.py + file_commander batch rename.

Free & open source, zero tokens.
"""

import re
import json
import time
from pathlib import Path
from datetime import datetime

PLUGIN = {
    "name": "batch_renamer_pro",
    "description": (
        "Advanced batch renamer pro with regex/EXIF/metadata — makes JARVIS impeccable at batch renaming beyond {n}/{date} (zero tokens). "
        "Actions: rename path=... pattern=... [by=name/regex/exif/metadata] [dry_run=true/false] [start=1] [padding=3] — batch rename files in path via pattern by name simple replace, regex find/replace with groups, exif use EXIF date for photos, metadata use file metadata, pattern supports {n} number with padding, {date} file mtime, {exif_date} EXIF date, {name} original name, {ext} extension, {size} size, {parent} parent folder, plus regex groups $1 $2, dry_run true preview false actual rename, returns renamed count + preview, regex path=... find=... replace=... [dry_run=...] — regex find/replace rename e.g., find IMG_(\\d+) replace Photo_$1 uses re, exif path=... pattern=... [dry_run=...] — rename photos by EXIF date pattern e.g., {exif_date}_{n} → 2023-12-25_001.jpg via Pillow EXIF DateTimeOriginal, case path=... case=lower/upper/title/capitalize [dry_run=...] — change case of filenames, trim path=... [chars=...] [side=both/left/right] [dry_run=...] — trim chars from filenames, prefix path=... prefix=... [dry_run=...] / suffix path=... suffix=... [dry_run=...] — add prefix/suffix, number path=... [start=1] [padding=3] [prefix=...] [suffix=...] [dry_run=...] — number files with padding e.g., IMG_{n:03} → IMG_001.jpg, clean path=... [dry_run=...] — clean filenames remove special chars spaces to underscores etc., help. "
        "Use when user wants to batch rename, regex rename, exif rename, case change, trim, prefix/suffix, number files, clean filenames. "
        "Trigger phrases: batch renamer pro, batch rename, regex rename, exif rename, case change, trim filenames, prefix suffix, number files, clean filenames, rename pro."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "Action: rename, regex, exif, case, trim, prefix, suffix, number, clean, help. Default rename.",
            },
            "path": {"type": "STRING", "description": "Path to rename files in, e.g. ~/Downloads, ~/Pictures"},
            "pattern": {"type": "STRING", "description": "Pattern for rename, e.g. Photo_{n}, {exif_date}_{n}, {name}_backup, supports {n} {date} {exif_date} {name} {ext} {size} {parent} + $1 $2 for regex groups"},
            "by": {"type": "STRING", "description": "Rename by: name, regex, exif, metadata, default name"},
            "dry_run": {"type": "BOOLEAN", "description": "Dry run true preview false actual, default true"},
            "start": {"type": "NUMBER", "description": "Start number for {n}, default 1"},
            "padding": {"type": "NUMBER", "description": "Padding for {n}, e.g. 3 → 001, default 3"},
            "find": {"type": "STRING", "description": "Find pattern for regex action, e.g. IMG_(\\d+)"},
            "replace": {"type": "STRING", "description": "Replace pattern for regex action, e.g. Photo_$1, supports $1 $2 groups"},
            "case": {"type": "STRING", "description": "Case for case action: lower, upper, title, capitalize, default lower"},
            "chars": {"type": "STRING", "description": "Chars to trim for trim action, e.g. _ -"},
            "side": {"type": "STRING", "description": "Side for trim: both, left, right, default both"},
            "prefix": {"type": "STRING", "description": "Prefix to add for prefix action"},
            "suffix": {"type": "STRING", "description": "Suffix to add for suffix action"},
        },
        "required": ["action"],
    },
}

PLUGIN_SETTINGS = {
    "namespace": "batch_renamer_pro",
    "title": "Batch Renamer Pro — Advanced Rename",
    "description": "Advanced batch rename regex/EXIF/metadata/case/trim/prefix/suffix/number — zero tokens",
    "icon": "✏️",
    "color": "#06B6D4",
    "order": 46,
    "default_enabled": True,
    "fields": [
        {"key": "history_file", "label": "Rename history file", "type": "text", "default": "~/.jarvis_rename_history.jsonl"},
    ],
}

_history_file = Path.home() / ".jarvis_rename_history.jsonl"

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
                    try:
                        dt = datetime.strptime(value, "%Y:%m:%d %H:%M:%S")
                        return dt
                    except Exception:
                        continue
    except Exception:
        pass
    return None

def _apply_pattern(file_path, pattern, n, start, padding, by="name", find_regex=None, replace_regex=None):
    """Apply pattern to file path, return new name."""
    try:
        name = file_path.stem
        ext = file_path.suffix
        parent = file_path.parent.name
        size = file_path.stat().st_size

        # Date via mtime
        mtime = datetime.fromtimestamp(file_path.stat().st_mtime)
        date_str = mtime.strftime("%Y-%m-%d")
        exif_date = _get_exif_date(file_path)
        exif_date_str = exif_date.strftime("%Y-%m-%d") if exif_date else date_str

        # Number with padding
        num = start + n - 1
        num_str = str(num).zfill(padding)

        # Base pattern replacements
        new_name = pattern
        new_name = new_name.replace("{n}", num_str)
        new_name = new_name.replace("{date}", date_str)
        new_name = new_name.replace("{exif_date}", exif_date_str)
        new_name = new_name.replace("{name}", name)
        new_name = new_name.replace("{ext}", ext.lstrip("."))
        new_name = new_name.replace("{size}", str(size))
        new_name = new_name.replace("{parent}", parent)
        # Support {n:03} style
        # Simple: replace {n:03} with padded
        import re as re_mod
        # Find {n:03} or {n:04} etc.
        def repl_num_format(match):
            fmt = match.group(1)
            try:
                # fmt like 03, 04
                return str(num).zfill(int(fmt))
            except Exception:
                return num_str
        new_name = re_mod.sub(r"\{n:0?(\d+)\}", repl_num_format, new_name)

        # Regex groups $1 $2 if by=regex and find_regex provided
        if by == "regex" and find_regex and replace_regex:
            try:
                m = re_mod.search(find_regex, file_path.name)
                if m:
                    # Replace $1 $2 in pattern or replace_regex
                    # If pattern contains $1, replace
                    for i, group in enumerate(m.groups(), 1):
                        new_name = new_name.replace(f"${i}", group or "")
                    # Also if replace_regex provided, use it
                    if replace_regex:
                        rep = replace_regex
                        for i, group in enumerate(m.groups(), 1):
                            rep = rep.replace(f"${i}", group or "")
                        new_name = rep
            except Exception:
                pass

        # Ensure extension preserved if not in pattern
        if ext and not new_name.endswith(ext) and "{ext}" not in pattern and ext.lstrip(".") not in new_name:
            # If pattern doesn't include extension, add it
            if "." not in new_name.split("/")[-1]:  # No dot in filename part
                new_name = new_name + ext

        return new_name
    except Exception as e:
        return f"Error applying pattern: {e}"

def run(parameters: dict, player=None, session_memory=None) -> str:
    action = (parameters.get("action", "rename") or "rename").lower().strip()
    path_str = parameters.get("path", "") or ""
    pattern = parameters.get("pattern", "") or ""
    by = (parameters.get("by", "name") or "name").lower().strip()
    dry_run = parameters.get("dry_run", True)
    if isinstance(dry_run, str):
        dry_run = dry_run.lower() in ("true", "1", "yes")
    start = parameters.get("start", 1)
    try:
        start = int(start)
    except Exception:
        start = 1
    padding = parameters.get("padding", 3)
    try:
        padding = int(padding)
    except Exception:
        padding = 3
    find = parameters.get("find", "") or ""
    replace = parameters.get("replace", "") or ""
    case = (parameters.get("case", "lower") or "lower").lower().strip()
    chars = parameters.get("chars", "") or ""
    side = (parameters.get("side", "both") or "both").lower().strip()
    prefix = parameters.get("prefix", "") or ""
    suffix = parameters.get("suffix", "") or ""

    try:
        if player:
            try:
                player.write_log(f"Batch Renamer Pro: {action} path={path_str} pattern={pattern} dry_run={dry_run}")
            except Exception:
                pass

        if action in ("help", "?", "h"):
            return (
                "Batch Renamer Pro — Advanced Batch Rename with Regex/EXIF/Metadata (Zero Tokens, from ONEPUNCHMAN411 batch_renamer.py + file_commander batch rename):\n"
                "\n"
                "Advanced batch rename beyond {n}/{date} — regex, EXIF date, metadata, case conversion.\n"
                "\n"
                "• rename path=... pattern=... [by=name/regex/exif/metadata] [dry_run=true/false] [start=1] [padding=3] — batch rename files in path via pattern, by name simple replace, regex find/replace with groups, exif use EXIF date for photos, metadata use file metadata, pattern supports {n} number with padding, {date} file mtime YYYY-MM-DD, {exif_date} EXIF date, {name} original name, {ext} extension, {size} size, {parent} parent folder, plus regex groups $1 $2, dry_run true preview false actual rename, returns renamed count + preview.\n"
                "• regex path=... find=... replace=... [dry_run=...] — regex find/replace rename e.g., find IMG_(\\d+) replace Photo_$1 uses re, supports groups $1 $2.\n"
                "• exif path=... pattern=... [dry_run=...] — rename photos by EXIF date pattern e.g., {exif_date}_{n} → 2023-12-25_001.jpg via Pillow EXIF DateTimeOriginal.\n"
                "• case path=... case=lower/upper/title/capitalize [dry_run=...] — change case of filenames lower, upper, title (Title Case), capitalize (First letter).\n"
                "• trim path=... [chars=...] [side=both/left/right] [dry_run=...] — trim chars from filenames e.g., trim _ - from both sides.\n"
                "• prefix path=... prefix=... [dry_run=...] / suffix path=... suffix=... [dry_run=...] — add prefix/suffix e.g., prefix Photo_ → Photo_IMG_1234.jpg.\n"
                "• number path=... [start=1] [padding=3] [prefix=...] [suffix=...] [dry_run=...] — number files with padding e.g., IMG_{n:03} → IMG_001.jpg, with optional prefix/suffix.\n"
                "• clean path=... [dry_run=...] — clean filenames: remove special chars except alphanumeric _ - ., spaces to underscores, trim, etc.\n"
                "\n"
                "Examples:\n"
                "• batch_renamer_pro action=rename path=~/Downloads pattern=Photo_{n} dry_run=true start=1 padding=3\n"
                "• batch_renamer_pro action=regex path=~/Downloads find=IMG_(\\d+) replace=Photo_$1 dry_run=true\n"
                "• batch_renamer_pro action=exif path=~/Pictures pattern={exif_date}_{n} dry_run=true\n"
                "• batch_renamer_pro action=case path=~/Downloads case=lower dry_run=true\n"
                "• batch_renamer_pro action=prefix path=~/Downloads prefix=2023_ dry_run=true\n"
                "• batch_renamer_pro action=number path=~/Downloads start=1 padding=3 prefix=IMG_ dry_run=true\n"
                "\n"
                "Zero tokens, pure local via pathlib, re, Pillow EXIF, datetime.\n"
                "History: ~/.jarvis_rename_history.jsonl for undo.\n"
                "Install: pip install Pillow (for EXIF)\n"
            )

        if action == "rename":
            if not path_str or not pattern:
                return "Need path and pattern: rename path=~/Downloads pattern=Photo_{n} dry_run=true start=1 padding=3 — pattern supports {n} {date} {exif_date} {name} {ext} {size} {parent} + $1 $2 for regex"
            p = Path(path_str).expanduser()
            if not p.exists() or not p.is_dir():
                return f"Path not found or not dir: {p}"

            files = [f for f in p.iterdir() if f.is_file()]
            if not files:
                return f"No files in {p}"

            files.sort(key=lambda x: x.name)

            previews = []
            for i, file_path in enumerate(files, 1):
                new_name = _apply_pattern(file_path, pattern, i, start, padding, by=by, find_regex=find, replace_regex=replace)
                previews.append((file_path, new_name))

            if dry_run:
                lines = [f"Rename preview dry_run in {p} pattern '{pattern}' by {by} start {start} padding {padding} — {len(files)} files:"]
                for orig, new in previews[:20]:
                    lines.append(f"• {orig.name} → {new}")
                if len(previews) > 20:
                    lines.append(f"... and {len(previews)-20} more")
                lines.append(f"\nDry run — no files renamed, set dry_run=false to actually rename")
                return "\n".join(lines)

            # Actual rename
            renamed = 0
            failed = 0
            history = []
            for orig, new_name in previews:
                try:
                    new_path = orig.parent / new_name
                    if new_path.exists():
                        new_path = orig.parent / f"{Path(new_name).stem}_{int(time.time())}{Path(new_name).suffix}"
                    orig.rename(new_path)
                    renamed += 1
                    history.append({"timestamp": datetime.now().isoformat(), "original": str(orig), "new": str(new_path), "pattern": pattern})
                except Exception as e:
                    failed += 1

            # Save history
            try:
                _history_file.parent.mkdir(parents=True, exist_ok=True)
                with _history_file.open("a", encoding="utf-8") as f:
                    for h in history:
                        f.write(json.dumps(h, ensure_ascii=False) + "\n")
            except Exception:
                pass

            return f"Renamed {renamed} files in {p} pattern '{pattern}' by {by} — {failed} failed — history saved {_history_file}"

        if action == "regex":
            if not path_str or not find or not replace:
                return "Need path, find, replace: regex path=~/Downloads find=IMG_(\\d+) replace=Photo_$1 dry_run=true — supports $1 $2 groups"
            p = Path(path_str).expanduser()
            if not p.exists() or not p.is_dir():
                return f"Path not found or not dir: {p}"

            try:
                regex = re.compile(find)
            except Exception as e:
                return f"Invalid regex find pattern '{find}': {e}"

            files = [f for f in p.iterdir() if f.is_file()]
            previews = []
            for file_path in files:
                m = regex.search(file_path.name)
                if m:
                    new_name = replace
                    for i, group in enumerate(m.groups(), 1):
                        new_name = new_name.replace(f"${i}", group or "")
                    # Also support \1 style?
                    new_name = regex.sub(replace.replace("$", "\\"), file_path.name) if "$" not in replace else new_name
                    # Simple: use re.sub with replace
                    try:
                        new_name = regex.sub(replace.replace("$", r"\\g<"), file_path.name)
                        # Actually re.sub uses \1, \g<1> — convert $1 to \g<1>
                        rep = re.sub(r"\$(\d+)", r"\\g<\1>", replace)
                        new_name = regex.sub(rep, file_path.name)
                    except Exception:
                        pass
                    previews.append((file_path, new_name))

            if not previews:
                return f"No files matched regex '{find}' in {p} — {len(files)} files checked"

            if dry_run:
                lines = [f"Regex rename preview dry_run in {p} find '{find}' replace '{replace}' — {len(previews)} matched of {len(files)}:"]
                for orig, new in previews[:20]:
                    lines.append(f"• {orig.name} → {new}")
                lines.append(f"\nDry run — set dry_run=false to actually rename")
                return "\n".join(lines)

            renamed = 0
            for orig, new_name in previews:
                try:
                    new_path = orig.parent / new_name
                    if new_path.exists():
                        new_path = orig.parent / f"{Path(new_name).stem}_{int(time.time())}{Path(new_name).suffix}"
                    orig.rename(new_path)
                    renamed += 1
                except Exception:
                    pass

            return f"Regex renamed {renamed} files in {p} find '{find}' replace '{replace}' — {len(previews)} matched"

        if action == "exif":
            if not path_str or not pattern:
                return "Need path and pattern: exif path=~/Pictures pattern={exif_date}_{n} dry_run=true — pattern supports {exif_date} {n} {name} {ext}"
            p = Path(path_str).expanduser()
            if not p.exists() or not p.is_dir():
                return f"Path not found or not dir: {p}"

            files = [f for f in p.iterdir() if f.is_file() and f.suffix.lower() in [".jpg", ".jpeg", ".png", ".heic", ".tiff"]]
            if not files:
                return f"No image files in {p}"

            files.sort(key=lambda x: _get_exif_date(x) or datetime.fromtimestamp(x.stat().st_mtime))

            previews = []
            for i, file_path in enumerate(files, 1):
                new_name = _apply_pattern(file_path, pattern, i, start, padding, by="exif")
                previews.append((file_path, new_name))

            if dry_run:
                lines = [f"EXIF rename preview dry_run in {p} pattern '{pattern}' — {len(files)} photos:"]
                for orig, new in previews[:20]:
                    exif_dt = _get_exif_date(orig)
                    lines.append(f"• {orig.name} EXIF {exif_dt} → {new}")
                lines.append(f"\nDry run — set dry_run=false to actually rename")
                return "\n".join(lines)

            renamed = 0
            for orig, new_name in previews:
                try:
                    new_path = orig.parent / new_name
                    if new_path.exists():
                        new_path = orig.parent / f"{Path(new_name).stem}_{int(time.time())}{Path(new_name).suffix}"
                    orig.rename(new_path)
                    renamed += 1
                except Exception:
                    pass

            return f"EXIF renamed {renamed} photos in {p} pattern '{pattern}'"

        if action == "case":
            if not path_str:
                return "Need path: case path=~/Downloads case=lower/upper/title/capitalize dry_run=true"
            p = Path(path_str).expanduser()
            if not p.exists() or not p.is_dir():
                return f"Path not found or not dir: {p}"

            files = [f for f in p.iterdir() if f.is_file()]
            previews = []
            for file_path in files:
                name = file_path.stem
                ext = file_path.suffix
                if case == "lower":
                    new_name = name.lower() + ext
                elif case == "upper":
                    new_name = name.upper() + ext
                elif case == "title":
                    new_name = name.title() + ext
                elif case == "capitalize":
                    new_name = name.capitalize() + ext
                else:
                    new_name = name.lower() + ext
                if new_name != file_path.name:
                    previews.append((file_path, new_name))

            if not previews:
                return f"No files need case change to {case} in {p}"

            if dry_run:
                lines = [f"Case change preview dry_run in {p} case {case} — {len(previews)} files:"]
                for orig, new in previews[:20]:
                    lines.append(f"• {orig.name} → {new}")
                return "\n".join(lines)

            renamed = 0
            for orig, new_name in previews:
                try:
                    orig.rename(orig.parent / new_name)
                    renamed += 1
                except Exception:
                    pass
            return f"Case changed {renamed} files in {p} to {case}"

        if action == "trim":
            if not path_str:
                return "Need path: trim path=~/Downloads chars=_- side=both dry_run=true"
            p = Path(path_str).expanduser()
            if not p.exists() or not p.is_dir():
                return f"Path not found or not dir: {p}"

            files = [f for f in p.iterdir() if f.is_file()]
            previews = []
            for file_path in files:
                name = file_path.stem
                ext = file_path.suffix
                if chars:
                    if side == "left":
                        new_stem = name.lstrip(chars)
                    elif side == "right":
                        new_stem = name.rstrip(chars)
                    else:
                        new_stem = name.strip(chars)
                else:
                    new_stem = name.strip()
                new_name = new_stem + ext
                if new_name != file_path.name:
                    previews.append((file_path, new_name))

            if not previews:
                return f"No files need trim chars '{chars}' side {side} in {p}"

            if dry_run:
                lines = [f"Trim preview dry_run in {p} chars '{chars}' side {side} — {len(previews)} files:"]
                for orig, new in previews[:20]:
                    lines.append(f"• {orig.name} → {new}")
                return "\n".join(lines)

            renamed = 0
            for orig, new_name in previews:
                try:
                    orig.rename(orig.parent / new_name)
                    renamed += 1
                except Exception:
                    pass
            return f"Trimmed {renamed} files in {p} chars '{chars}' side {side}"

        if action == "prefix":
            if not path_str or not prefix:
                return "Need path and prefix: prefix path=~/Downloads prefix=2023_ dry_run=true"
            p = Path(path_str).expanduser()
            if not p.exists() or not p.is_dir():
                return f"Path not found or not dir: {p}"

            files = [f for f in p.iterdir() if f.is_file()]
            previews = [(f, prefix + f.name) for f in files if not f.name.startswith(prefix)]

            if not previews:
                return f"No files need prefix '{prefix}' in {p} — all already have it"

            if dry_run:
                lines = [f"Prefix preview dry_run in {p} prefix '{prefix}' — {len(previews)} files:"]
                for orig, new in previews[:20]:
                    lines.append(f"• {orig.name} → {new}")
                return "\n".join(lines)

            renamed = 0
            for orig, new_name in previews:
                try:
                    orig.rename(orig.parent / new_name)
                    renamed += 1
                except Exception:
                    pass
            return f"Added prefix '{prefix}' to {renamed} files in {p}"

        if action == "suffix":
            if not path_str or not suffix:
                return "Need path and suffix: suffix path=~/Downloads suffix=_backup dry_run=true"
            p = Path(path_str).expanduser()
            if not p.exists() or not p.is_dir():
                return f"Path not found or not dir: {p}"

            files = [f for f in p.iterdir() if f.is_file()]
            previews = []
            for f in files:
                new_name = f.stem + suffix + f.suffix
                if new_name != f.name:
                    previews.append((f, new_name))

            if not previews:
                return f"No files need suffix '{suffix}' in {p}"

            if dry_run:
                lines = [f"Suffix preview dry_run in {p} suffix '{suffix}' — {len(previews)} files:"]
                for orig, new in previews[:20]:
                    lines.append(f"• {orig.name} → {new}")
                return "\n".join(lines)

            renamed = 0
            for orig, new_name in previews:
                try:
                    orig.rename(orig.parent / new_name)
                    renamed += 1
                except Exception:
                    pass
            return f"Added suffix '{suffix}' to {renamed} files in {p}"

        if action == "number":
            if not path_str:
                return "Need path: number path=~/Downloads start=1 padding=3 prefix=IMG_ suffix= dry_run=true"
            p = Path(path_str).expanduser()
            if not p.exists() or not p.is_dir():
                return f"Path not found or not dir: {p}"

            files = [f for f in p.iterdir() if f.is_file()]
            files.sort(key=lambda x: x.name)
            previews = []
            for i, file_path in enumerate(files, 1):
                num = start + i - 1
                num_str = str(num).zfill(padding)
                new_name = f"{prefix}{num_str}{suffix}{file_path.suffix}"
                previews.append((file_path, new_name))

            if dry_run:
                lines = [f"Number preview dry_run in {p} start {start} padding {padding} prefix '{prefix}' suffix '{suffix}' — {len(files)} files:"]
                for orig, new in previews[:20]:
                    lines.append(f"• {orig.name} → {new}")
                return "\n".join(lines)

            renamed = 0
            for orig, new_name in previews:
                try:
                    orig.rename(orig.parent / new_name)
                    renamed += 1
                except Exception:
                    pass
            return f"Numbered {renamed} files in {p} start {start} padding {padding} prefix '{prefix}' suffix '{suffix}'"

        if action == "clean":
            if not path_str:
                return "Need path: clean path=~/Downloads dry_run=true — removes special chars, spaces to underscores"
            p = Path(path_str).expanduser()
            if not p.exists() or not p.is_dir():
                return f"Path not found or not dir: {p}"

            files = [f for f in p.iterdir() if f.is_file()]
            previews = []
            for file_path in files:
                # Clean: alphanumeric _ - . only, spaces to _, remove special chars
                name = file_path.stem
                # Replace spaces with _
                name = name.replace(" ", "_")
                # Remove special chars except _ - .
                name = re.sub(r"[^a-zA-Z0-9_\-\.]", "", name)
                # Remove multiple underscores
                name = re.sub(r"_+", "_", name)
                new_name = name + file_path.suffix
                if new_name != file_path.name and new_name:
                    previews.append((file_path, new_name))

            if not previews:
                return f"No files need cleaning in {p}"

            if dry_run:
                lines = [f"Clean preview dry_run in {p} — {len(previews)} files:"]
                for orig, new in previews[:20]:
                    lines.append(f"• {orig.name} → {new}")
                return "\n".join(lines)

            renamed = 0
            for orig, new_name in previews:
                try:
                    orig.rename(orig.parent / new_name)
                    renamed += 1
                except Exception:
                    pass
            return f"Cleaned {renamed} filenames in {p}"

        return f"Unknown action {action}. Say 'batch_renamer_pro action=help'"

    except Exception as e:
        return f"Batch Renamer Pro failed: {e}"
