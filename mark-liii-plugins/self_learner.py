"""
Self Learner — Learn from Corrections & Preferences for JARVIS (Mark LIII)
Makes JARVIS self-improving — learns from corrections, remembers preferences.

Inspired by Mark LIII memory_manager.py + undo + self_learner concept + magi_system.

Free & open source, zero to low tokens.
"""

import json
import time
from pathlib import Path
from datetime import datetime
from collections import Counter

PLUGIN = {
    "name": "self_learner",
    "description": (
        "Self learner master — makes JARVIS learn from corrections & preferences (zero to low tokens). "
        "Actions: correct original=... correction=... [context=...] — log correction e.g., original click File → correction click Edit context Notepad stored ~/.jarvis_corrections.jsonl used to adapt future, learn fact=... [category=preferences/projects/relationships/wishes/notes/identity] — learn fact e.g., User prefers dark mode, User's email is my@email.com, Chrome is at 100,200 category like Mark LIII memory_manager, recall query=... — recall learned facts/corrections by query fuzzy search, preferences — list preferences learned, corrections [limit=20] — list recent corrections, forget query=... — forget fact/correction by query, suggest action=... params=... — suggest improved params based on past corrections e.g., if corrected click File to click Edit 3 times in Notepad suggest Edit next time, stats — stats total corrections top corrected actions learning rate, export path=... / import path=... — export/import learned data, help. "
        "Use when user corrects JARVIS, wants to teach fact, recall learned, preferences, self learner. "
        "Trigger phrases: self learner, correct, learn fact, recall, preferences, corrections, forget, suggest improvement, learning stats, teach JARVIS."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "Action: correct, learn, recall, preferences, corrections, forget, suggest, stats, export, import, help. Default recall.",
            },
            "original": {"type": "STRING", "description": "Original action/text for correct action, e.g. click File"},
            "correction": {"type": "STRING", "description": "Correction for correct action, e.g. click Edit"},
            "context": {"type": "STRING", "description": "Context for correct/learn, e.g. Notepad, Chrome, project name"},
            "fact": {"type": "STRING", "description": "Fact to learn for learn action, e.g. User prefers dark mode"},
            "category": {"type": "STRING", "description": "Category for learn: preferences, projects, relationships, wishes, notes, identity, default preferences"},
            "query": {"type": "STRING", "description": "Query for recall/forget, e.g. dark mode, File, Notepad"},
            "suggest_action": {"type": "STRING", "description": "Action name for suggest, e.g. accessibility_master"},
            "params": {"type": "STRING", "description": "Params JSON string for suggest, e.g. {\"action\": \"click\", \"name\": \"File\"}"},
            "limit": {"type": "NUMBER", "description": "Limit for corrections, default 20"},
            "path": {"type": "STRING", "description": "Path for export/import, e.g. ~/learned.json"},
        },
        "required": ["action"],
    },
}

PLUGIN_SETTINGS = {
    "namespace": "self_learner",
    "title": "Self Learner — Learn from Corrections",
    "description": "Learns from corrections & preferences, adapts — zero to low tokens",
    "icon": "🧠",
    "color": "#A855F7",
    "order": 43,
    "default_enabled": True,
    "fields": [
        {"key": "corrections_file", "label": "Corrections file", "type": "text", "default": "~/.jarvis_corrections.jsonl"},
        {"key": "facts_file", "label": "Facts file", "type": "text", "default": "~/.jarvis_learned_facts.json"},
        {"key": "learning_threshold", "label": "Learning threshold (corrections count to suggest)", "type": "number", "default": 3},
    ],
}

_corrections_file = Path.home() / ".jarvis_corrections.jsonl"
_facts_file = Path.home() / ".jarvis_learned_facts.json"
_preferences_file = Path.home() / ".jarvis_preferences.json"
_learning_threshold = 3

def _ensure_files():
    try:
        _corrections_file.parent.mkdir(parents=True, exist_ok=True)
        _facts_file.parent.mkdir(parents=True, exist_ok=True)
        if not _corrections_file.exists():
            _corrections_file.touch()
        if not _facts_file.exists():
            _facts_file.write_text(json.dumps({}, ensure_ascii=False), encoding="utf-8")
        if not _preferences_file.exists():
            _preferences_file.write_text(json.dumps({}, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass

def _load_corrections():
    _ensure_files()
    corrections = []
    try:
        with _corrections_file.open("r", encoding="utf-8", errors="ignore") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    corrections.append(json.loads(line))
                except Exception:
                    continue
    except Exception:
        pass
    return corrections

def _save_correction(entry):
    _ensure_files()
    try:
        with _corrections_file.open("a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        return True
    except Exception:
        return False

def _load_facts():
    _ensure_files()
    try:
        return json.loads(_facts_file.read_text(encoding="utf-8"))
    except Exception:
        return {}

def _save_facts(data):
    _ensure_files()
    try:
        _facts_file.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        return True
    except Exception:
        return False

def _load_preferences():
    _ensure_files()
    try:
        return json.loads(_preferences_file.read_text(encoding="utf-8"))
    except Exception:
        return {}

def _save_preferences(data):
    _ensure_files()
    try:
        _preferences_file.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        return True
    except Exception:
        return False

def run(parameters: dict, player=None, session_memory=None) -> str:
    action = (parameters.get("action", "recall") or "recall").lower().strip()
    original = parameters.get("original", "") or ""
    correction = parameters.get("correction", "") or ""
    context = parameters.get("context", "") or ""
    fact = parameters.get("fact", "") or ""
    category = (parameters.get("category", "preferences") or "preferences").lower().strip()
    query = parameters.get("query", "") or ""
    suggest_action = parameters.get("suggest_action", "") or parameters.get("action", "") or ""
    # For suggest, params is target params
    params_str = parameters.get("params", "") or ""
    limit = parameters.get("limit", 20)
    try:
        limit = int(limit)
    except Exception:
        limit = 20
    limit = max(1, min(100, limit))
    path_str = parameters.get("path", "") or ""

    try:
        if player:
            try:
                player.write_log(f"Self Learner: {action} query={query} original={original[:20]}")
            except Exception:
                pass

        if action in ("help", "?", "h"):
            return (
                "Self Learner — Learn from Corrections & Preferences (Zero to Low Tokens, from Mark LIII memory_manager + self_learner concept):\n"
                "\n"
                "Makes JARVIS learn from corrections: No, click the other button → remembers, adapts.\n"
                "\n"
                "• correct original=... correction=... [context=...] — log correction e.g., original click File → correction click Edit context Notepad stored ~/.jarvis_corrections.jsonl, used to adapt future actions, counts corrections per (original, correction, context) if same correction 3+ times suggest proactively\n"
                "• learn fact=... [category=preferences/projects/relationships/wishes/notes/identity] — learn fact e.g., User prefers dark mode, User's email is my@email.com, Chrome is at 100,200 category like Mark LIII memory_manager, stored ~/.jarvis_learned_facts.json + ~/.jarvis_preferences.json\n"
                "• recall query=... — recall learned facts/corrections by query fuzzy search case-insensitive in fact/original/correction/context\n"
                "• preferences — list preferences learned (category preferences)\n"
                "• corrections [limit=20] — list recent corrections timestamp original correction context\n"
                "• forget query=... — forget fact/correction by query, removes matching entries\n"
                "• suggest suggest_action=... params=... — suggest improved params based on past corrections e.g., if corrected click File to click Edit 3 times in Notepad suggest Edit next time, params JSON e.g., {\"action\":\"click\",\"name\":\"File\"}, returns suggestion if found + confidence count\n"
                "• stats — stats total corrections top corrected actions learning rate facts count preferences count\n"
                "• export path=... / import path=... — export/import learned data JSON with corrections + facts + preferences\n"
                "\n"
                "Examples:\n"
                "• self_learner action=correct original=click File correction=click Edit context=Notepad\n"
                "• self_learner action=learn fact=User prefers dark mode category=preferences\n"
                "• self_learner action=recall query=dark mode\n"
                "• self_learner action=preferences\n"
                "• self_learner action=corrections limit=10\n"
                "• self_learner action=suggest suggest_action=accessibility_master params={\"action\":\"click\",\"name\":\"File\"}\n"
                "\n"
                "Zero to low tokens — local storage zero tokens, suggest via local rules count corrections + optional Gemini low tokens.\n"
                "Files: ~/.jarvis_corrections.jsonl (JSONL), ~/.jarvis_learned_facts.json, ~/.jarvis_preferences.json\n"
                "Learning threshold: 3 corrections same original→correction to suggest proactively.\n"
            )

        if action == "correct":
            if not original or not correction:
                return "Need original and correction: correct original=click File correction=click Edit context=Notepad"
            entry = {
                "timestamp": datetime.now().isoformat(),
                "id": str(int(time.time()*1000)),
                "original": original,
                "correction": correction,
                "context": context,
            }
            if _save_correction(entry):
                # Count same correction
                corrections = _load_corrections()
                same = [c for c in corrections if c.get("original") == original and c.get("correction") == correction and c.get("context") == context]
                count = len(same)
                if count >= _learning_threshold:
                    return f"Logged correction '{original}' → '{correction}' context '{context}' id {entry['id']} — count {count} >= threshold {_learning_threshold} — will now suggest '{correction}' proactively when you say '{original}' in '{context}' — zero tokens, learned"
                return f"Logged correction '{original}' → '{correction}' context '{context}' id {entry['id']} — count {count}/{_learning_threshold} to threshold — zero tokens"
            return "Failed to save correction"

        if action == "learn":
            if not fact:
                return "Need fact: learn fact=User prefers dark mode category=preferences"
            facts = _load_facts()
            if category not in facts:
                facts[category] = []
            # Avoid duplicates
            if fact not in facts[category]:
                facts[category].append(fact)
                facts[category] = facts[category][-100:]  # Keep last 100 per category
            _save_facts(facts)

            # Also save to preferences if category preferences
            if category == "preferences":
                prefs = _load_preferences()
                prefs[fact] = {"timestamp": datetime.now().isoformat(), "category": category}
                _save_preferences(prefs)

            return f"Learned fact '{fact}' category '{category}' — stored in ~/.jarvis_learned_facts.json + preferences — zero tokens, will recall via recall query"

        if action == "recall":
            if not query:
                return "Need query: recall query=dark mode — searches facts and corrections"
            q_lower = query.lower()
            results = []

            # Search facts
            facts = _load_facts()
            for cat, fact_list in facts.items():
                for f in fact_list:
                    if q_lower in f.lower():
                        results.append(f"Fact [{cat}]: {f}")

            # Search corrections
            corrections = _load_corrections()
            for c in corrections:
                hay = f"{c.get('original','')} {c.get('correction','')} {c.get('context','')}".lower()
                if q_lower in hay:
                    results.append(f"Correction [{c.get('timestamp','')[:19]}] {c.get('original')} → {c.get('correction')} context {c.get('context')} (id {c.get('id')})")

            # Search preferences
            prefs = _load_preferences()
            for pref_key in prefs:
                if q_lower in pref_key.lower():
                    results.append(f"Preference: {pref_key}")

            if not results:
                return f"No learned facts/corrections matching query '{query}' — try learn fact first"

            return f"Recall '{query}' matched {len(results)} results (zero tokens):\n" + "\n".join(results[:20])

        if action == "preferences":
            prefs = _load_preferences()
            facts = _load_facts()
            pref_facts = facts.get("preferences", [])

            if not prefs and not pref_facts:
                return "No preferences learned — learn via learn fact=User prefers dark mode category=preferences"

            lines = [f"Preferences learned ({len(prefs)} + {len(pref_facts)} facts):"]
            for i, f in enumerate(pref_facts[-20:], 1):
                lines.append(f"  {i}. {f}")
            for k, v in list(prefs.items())[-20:]:
                lines.append(f"  - {k} (learned {v.get('timestamp','')[:19]})")

            return "\n".join(lines)

        if action == "corrections":
            corrections = _load_corrections()
            if not corrections:
                return "No corrections logged — correct via correct original=... correction=... context=..."
            recent = corrections[-limit:][::-1]
            lines = [f"Recent corrections ({len(recent)} of {len(corrections)} total):"]
            for i, c in enumerate(recent, 1):
                lines.append(f"  {i}. [{c.get('timestamp','')[:19]}] '{c.get('original')}' → '{c.get('correction')}' context '{c.get('context')}' id {c.get('id')}")
            # Top corrected
            counter = Counter([f"{c.get('original')} → {c.get('correction')}" for c in corrections])
            top = counter.most_common(3)
            if top:
                lines.append(f"\nTop corrected:")
                for item, cnt in top:
                    lines.append(f"  - {item}: {cnt} times")
            return "\n".join(lines)

        if action == "forget":
            if not query:
                return "Need query: forget query=dark mode — removes matching facts/corrections"
            q_lower = query.lower()
            removed_facts = 0
            removed_corrections = 0

            # Forget facts
            facts = _load_facts()
            for cat in list(facts.keys()):
                original_len = len(facts[cat])
                facts[cat] = [f for f in facts[cat] if q_lower not in f.lower()]
                removed_facts += original_len - len(facts[cat])
            _save_facts(facts)

            # Forget corrections
            corrections = _load_corrections()
            remaining = [c for c in corrections if q_lower not in f"{c.get('original','')} {c.get('correction','')} {c.get('context','')}".lower()]
            removed_corrections = len(corrections) - len(remaining)
            # Rewrite file
            try:
                _corrections_file.write_text("", encoding="utf-8")
                for c in remaining:
                    _save_correction(c)
            except Exception:
                pass

            # Forget preferences
            prefs = _load_preferences()
            remaining_prefs = {k: v for k, v in prefs.items() if q_lower not in k.lower()}
            removed_prefs = len(prefs) - len(remaining_prefs)
            _save_preferences(remaining_prefs)

            return f"Forgot query '{query}' — removed {removed_facts} facts, {removed_corrections} corrections, {removed_prefs} preferences — zero tokens"

        if action == "suggest":
            if not suggest_action or not params_str:
                return "Need suggest_action and params: suggest suggest_action=accessibility_master params={\"action\":\"click\",\"name\":\"File\"} — suggests improved params based on past corrections"

            try:
                params = json.loads(params_str) if isinstance(params_str, str) else params_str
            except Exception:
                return f"Invalid params JSON: {params_str}"

            # Extract original from params — e.g., name=File
            original_name = params.get("name", "") or params.get("target", "") or params.get("text", "") or ""
            if not original_name:
                return "Could not extract original from params — need name/target/text field for suggestion"

            # Search corrections for same original
            corrections = _load_corrections()
            matching = [c for c in corrections if c.get("original") == original_name or original_name in c.get("original","") or c.get("original","") in original_name]

            if not matching:
                # Try fuzzy: original contains correction?
                return f"No corrections found for '{original_name}' — no suggestion, will use original params {params}"

            # Count corrections per correction value
            counter = Counter([c.get("correction") for c in matching])
            top_correction, count = counter.most_common(1)[0]

            if count >= _learning_threshold:
                # Suggest top correction
                suggested_params = dict(params)
                if "name" in suggested_params:
                    suggested_params["name"] = top_correction
                if "target" in suggested_params:
                    suggested_params["target"] = top_correction

                return f"Suggestion based on {count} past corrections (threshold {_learning_threshold}) — you corrected '{original_name}' → '{top_correction}' {count} times — suggest using '{top_correction}' instead of '{original_name}' — confidence high — suggested params: {json.dumps(suggested_params)} — zero tokens, learned"
            else:
                return f"Found {len(matching)} corrections for '{original_name}' but count {count} < threshold {_learning_threshold} — top correction '{top_correction}' count {count}/{_learning_threshold} — not yet confident, will use original params {params} — log more corrections to reach threshold"

        if action == "stats":
            corrections = _load_corrections()
            facts = _load_facts()
            prefs = _load_preferences()

            total_corrections = len(corrections)
            total_facts = sum(len(v) for v in facts.values())
            total_prefs = len(prefs)

            # Top corrected
            counter = Counter([c.get("original") for c in corrections])
            top_original = counter.most_common(5)

            # Learning rate — corrections per day last 7 days
            now = datetime.now()
            last_7_days = 0
            for c in corrections:
                try:
                    ts = datetime.fromisoformat(c.get("timestamp",""))
                    if (now - ts).days < 7:
                        last_7_days += 1
                except Exception:
                    continue

            lines = [
                f"Self Learner stats (zero tokens):",
                f"• Total corrections: {total_corrections}",
                f"• Total facts: {total_facts} across {len(facts)} categories",
                f"• Total preferences: {total_prefs}",
                f"• Last 7 days corrections: {last_7_days}",
                f"• Learning threshold: {_learning_threshold} corrections to suggest proactively",
                f"• Top corrected originals:",
            ]
            for orig, cnt in top_original:
                lines.append(f"  - '{orig}': {cnt} times")
            lines.append(f"• Categories: {', '.join(facts.keys()) if facts else 'none'}")
            lines.append(f"• Files: {_corrections_file} ({_corrections_file.stat().st_size if _corrections_file.exists() else 0} bytes), {_facts_file}, {_preferences_file}")

            return "\n".join(lines)

        if action == "export":
            if not path_str:
                return "Need path: export path=~/learned.json"
            try:
                export_path = Path(path_str).expanduser()
                export_path.parent.mkdir(parents=True, exist_ok=True)
                data = {
                    "corrections": _load_corrections(),
                    "facts": _load_facts(),
                    "preferences": _load_preferences(),
                    "exported": datetime.now().isoformat(),
                }
                export_path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
                return f"Exported learned data to {export_path} — {len(data['corrections'])} corrections, {sum(len(v) for v in data['facts'].values())} facts, {len(data['preferences'])} preferences — {export_path.stat().st_size} bytes"
            except Exception as e:
                return f"Export failed: {e}"

        if action == "import":
            if not path_str:
                return "Need path: import path=~/learned.json"
            try:
                import_path = Path(path_str).expanduser()
                if not import_path.exists():
                    return f"File not found: {import_path}"
                data = json.loads(import_path.read_text(encoding="utf-8"))
                corrections = data.get("corrections", [])
                facts = data.get("facts", {})
                preferences = data.get("preferences", {})

                # Append corrections
                for c in corrections:
                    _save_correction(c)

                # Merge facts
                existing_facts = _load_facts()
                for cat, fact_list in facts.items():
                    if cat not in existing_facts:
                        existing_facts[cat] = []
                    for f in fact_list:
                        if f not in existing_facts[cat]:
                            existing_facts[cat].append(f)
                _save_facts(existing_facts)

                # Merge preferences
                existing_prefs = _load_preferences()
                existing_prefs.update(preferences)
                _save_preferences(existing_prefs)

                return f"Imported learned data from {import_path} — {len(corrections)} corrections, {sum(len(v) for v in facts.values())} facts, {len(preferences)} preferences"
            except Exception as e:
                return f"Import failed: {e}"

        return f"Unknown action {action}. Say 'self_learner action=help'"

    except Exception as e:
        return f"Self Learner failed: {e}"
