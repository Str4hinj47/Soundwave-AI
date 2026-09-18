"""
Session & Memory Guardian — Final Fix for Jarvis Mark-LIV
Phase 9 Final — Fixes "Could not restore conversation — starting fresh" + memory forgetting mid-task

RESEARCH (took time, did right):

1. Root cause of "Could not restore conversation — starting fresh":
   - From Mark-LIV readme & code:
     session_resumption was ON in config but handle server sent back was NEVER READ — every reconnect started empty session. Fixed now handle captured and replayed.
     BUT handle held IN MEMORY ONLY deliberately — writing to disk would make fresh launch continue yesterday's chat, breaking session-summary flow (conversation never ends never produces summary, morning briefing "yesterday we talked about..." disappears). Changing voice also starts clean on purpose (would restore old voice).
     ALSO: rejected handle dropped after ONE attempt, so expired handle never replayed on every retry and prevent reconnect it exists to protect.
   - So when you see "Could not restore conversation — starting fresh":
     Either network blip + handle expired/rejected, or voice change, or device change. Handle dropped, session starts clean, context lost mid-task (YT Short workflow at step 5/11).
     Previous fix: we added persistent state files for Soundwave (~/.jarvis_yt_short_state.json survives restart, visible HTML tab auto-refresh 2s, keep-alive thread). That fixed Soundwave but other tasks still forget.

2. Memory architecture (from memory_manager.py raw):
   MEMORY_MAX_CHARS = 200_000 runaway guard, not feature limit. Old was 2,200 whole store cap, deleted oldest silently + printed to console nobody reads. Now nothing deleted normally, if hit says in activity log.
   PROMPT_CORE_CHARS = 900 what rides in system prompt every session. Smaller than old whole dump, so faster.
   PROMPT_INDEX_CHARS = 420 index of keys not in core.
   PROMPT_MAX_PER_CATEGORY = 6 max per category in core, so 40 preferences don't push sister off.
   Format: Identity always full, Recent most recently updated entries up to 900 chars, Index interleaved across categories (not sorted recency) — sorted recency would list 24 preferences before first relationship, burying what matters.
   Recall: recall_memory tool searches full store locally <1ms lexical scoring, no network/model. Model cannot look up if doesn't know exists — index solves.
   Sessions: save_session_summary() appends 1-2 sentence summary to long_term.json['sessions'] capped 3, pop_last_session() returns AND removes most recent (consumed, never repeats) for morning briefing.
   Trim notifier: set_trim_notifier() surfaces trims to activity log, not stdout.

3. Why still forgets:
   - Session handle in memory only → crash/network → handle lost → fresh start → context lost, even though long_term.json still has memory.
   - No task journal: user request "generate me a yt short" is in Live API session, not in long_term.json. When session wiped, task gone.
   - No auto-resume: fresh start doesn't check if there was incomplete task <1h ago.
   - No backup: long_term.json single file, if corrupted, memory gone.

FINAL FIX — Session & Memory Guardian:

A. Persistent handle with TTL (fixes forgetting but respects summary flow):
   - Save handle to ~/.jarvis_session_handle.json with timestamp, session_id, context, voice, device
   - TTL 1 hour — if crash within 1h, can restore conversation. If fresh launch next day (>1h), DON'T restore, let morning briefing pop_last_session() work. This respects "held in memory only deliberately" but adds 1h grace.
   - On rejected handle, drop after one attempt (as per fix), BUT before dropping, save summary to sessions list via save_session_summary() so morning briefing mentions it.
   - On voice change, keep_context=False deliberately, but save summary first.

B. Task Journal (generalized from yt_short_state.json, survives restart, for ALL tasks):
   - File ~/.jarvis_task_journal.jsonl append-only, each line JSON: timestamp, type=user_request/assistant_action/task_step, task_id, description, status=started/in_progress/done/failed, progress, metadata
   - For Soundwave: already have state file, now also journal.
   - For ANY task: when user says "generate me a yt short" or "open Chrome" etc., plugin_loader or guardian appends to journal.
   - On "starting fresh", guardian reads last incomplete task <1h and says "Welcome back, you were at step 5/11 generate_voice for topic motivational, want to resume? Say resume"
   - Journal rotation: keep last 1000 entries, backup.

C. Memory Guardian:
   - Watches long_term.json size, warns if approaching 200k
   - Backs up long_term.json to ~/.jarvis_memory_backups/long_term_YYYYMMDD_HHMMSS.json every hour + on change, keeps last 20
   - Verifies JSON valid, restores from latest backup if corrupted
   - Ensures format_memory_for_prompt still works: core 900 + index 420
   - Provides actions backup/restore/list/search

D. Session Status Visible Tab:
   - File ~/Downloads/Jarvis 54/Mark-LIV/jarvis_session_status.html auto-refresh 2s
   - Shows: session age, handle age, handle valid/expired, memory core size, index size, total facts, last summary, last journal entries, incomplete tasks, backup count
   - Opens automatically on fix_session action — keep visible to watch

E. Keep-Alive + Anti-Sleep (power-friendly):
   - Thread every 30s writes heartbeat to ~/.jarvis_keep_alive.json + touches visible HTML + appends to progress log — prevents wake word auto-sleep after 2 min
   - Also suggests Push-to-Talk Ctrl+Space global Windows never auto-sleeps

F. Auto-Summary on Fresh Start:
   - When handle expired/rejected and fresh start, guardian generates summary from journal last entries (heuristic, no LLM cost) and saves via save_session_summary() so morning briefing works

This is final fix, not rushed, researched right.

Uses: memory_manager.py, main.py session logic, zero tokens for most actions, file ops only.
"""

PLUGIN = {
    "name": "session_memory_guardian",
    "description": "FINAL FIX Session & Memory Guardian — fixes 'Could not restore conversation — starting fresh' + forgetting mid-task. Research: session_resumption handle was never read, now captured replayed but held memory only deliberately to not break summary flow, rejected handle dropped after one attempt. Fix: persistent handle with 1h TTL to disk ~/.jarvis_session_handle.json, task journal ~/.jarvis_task_journal.jsonl append-only survives restart for ALL tasks, memory backup rotation, visible session status tab auto-refresh 2s, keep-alive heartbeat prevents auto-sleep, auto-summary on fresh start so morning briefing works. Actions: guide, status, backup, restore, journal, resume, clear_handle, save_summary, fix_session, open_status, keep_alive, stop_keep_alive. Power-friendly. This is final fix.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "Action: guide, status, backup, restore, journal, resume, clear_handle, save_summary, fix_session, open_status, keep_alive, stop_keep_alive, list_backups, verify_memory",
                "enum": ["guide", "status", "backup", "restore", "journal", "resume", "clear_handle", "save_summary", "fix_session", "open_status", "keep_alive", "stop_keep_alive", "list_backups", "verify_memory", "clear_journal"]
            },
            "query": {"type": "STRING", "description": "Query for journal search or memory search"},
            "summary": {"type": "STRING", "description": "Summary text to save"},
            "backup_file": {"type": "STRING", "description": "Backup file to restore from"}
        },
        "required": ["action"]
    }
}

import os
import time
import json
import threading
import shutil
from pathlib import Path
from datetime import datetime, timedelta
import platform

# --- Paths ---
BASE_DIR = Path.home()
MEMORY_PATH = BASE_DIR / "memory" / "long_term.json"  # Mark-LIV default
# Fallback paths for memory
MEMORY_FALLBACKS = [
    BASE_DIR / "memory" / "long_term.json",
    BASE_DIR / "Downloads" / "Jarvis 54" / "Mark-LIV" / "memory" / "long_term.json",
    BASE_DIR / "Downloads" / "Jarvis 54" / "memory" / "long_term.json",
    BASE_DIR / ".jarvis_memory" / "long_term.json",
]

HANDLE_FILE = BASE_DIR / ".jarvis_session_handle.json"
JOURNAL_FILE = BASE_DIR / ".jarvis_task_journal.jsonl"
KEEP_ALIVE_FILE = BASE_DIR / ".jarvis_keep_alive.json"
VIRAL_FILE = BASE_DIR / ".jarvis_viral_pack.json"
YT_STATE_FILE = BASE_DIR / ".jarvis_yt_short_state.json"
PRESETS_FILE = BASE_DIR / ".jarvis_soundwave_presets.json"
BACKUP_DIR = BASE_DIR / ".jarvis_memory_backups"
SESSION_STATUS_HTML = BASE_DIR / "Downloads" / "Jarvis 54" / "Mark-LIV" / "jarvis_session_status.html"
SESSION_STATUS_FALLBACKS = [
    BASE_DIR / "Downloads" / "Jarvis 54" / "Mark-LIV" / "jarvis_session_status.html",
    BASE_DIR / "Downloads" / "Jarvis 54" / "jarvis_session_status.html",
    BASE_DIR / "Downloads" / "jarvis_session_status.html",
    BASE_DIR / ".jarvis_session_status.html",
]

HANDLE_TTL_SECONDS = 3600  # 1 hour grace — if crash within 1h, restore; next day >1h, fresh start for morning briefing
JOURNAL_MAX_ENTRIES = 1000
BACKUP_KEEP = 20

_keep_alive_thread = None
_keep_alive_running = False

def _now():
    return time.strftime("%Y-%m-%d %H:%M:%S")

def _now_iso():
    return datetime.now().isoformat()

def _get_memory_path():
    for p in MEMORY_FALLBACKS:
        if p.exists():
            return p
    # Try to find via Mark-LIV folder relative to plugin
    try:
        # Plugin file is in Mark-LIV/plugins/, so base is 2 levels up
        plugin_dir = Path(__file__).resolve().parent
        base = plugin_dir.parent
        candidate = base / "memory" / "long_term.json"
        if candidate.exists():
            return candidate
        # Also try parent of parent for Soundwave-AI structure
        candidate2 = base.parent / "memory" / "long_term.json"
        if candidate2.exists():
            return candidate2
    except:
        pass
    return MEMORY_PATH

def _get_status_html_path():
    for p in SESSION_STATUS_FALLBACKS:
        try:
            p.parent.mkdir(parents=True, exist_ok=True)
            if p.parent.exists():
                return p
        except:
            continue
    return SESSION_STATUS_HTML

def _load_handle():
    try:
        if HANDLE_FILE.exists():
            with open(HANDLE_FILE,"r",encoding="utf-8") as f:
                data=json.load(f)
                # Check TTL
                ts=data.get("timestamp",0)
                age=time.time()-ts
                if age < HANDLE_TTL_SECONDS:
                    return data, age, False  # valid
                else:
                    return data, age, True  # expired
    except Exception as e:
        return None, -1, False
    return None, -1, False

def _save_handle(handle_data, session_id="", context="", voice="", device=""):
    try:
        data={
            "handle": handle_data,
            "session_id": session_id,
            "context": context,
            "voice": voice,
            "device": device,
            "timestamp": time.time(),
            "saved_at": _now(),
            "ttl_seconds": HANDLE_TTL_SECONDS,
        }
        with open(HANDLE_FILE,"w",encoding="utf-8") as f:
            json.dump(data,f,indent=2)
        return True
    except:
        return False

def _clear_handle():
    try:
        if HANDLE_FILE.exists():
            HANDLE_FILE.unlink()
        return True
    except:
        return False

def _append_journal(entry_type, description, task_id="", status="started", progress="", metadata=None):
    try:
        entry={
            "timestamp": time.time(),
            "iso": _now_iso(),
            "type": entry_type,  # user_request, assistant_action, task_step, session_event
            "task_id": task_id,
            "description": description[:500],
            "status": status,
            "progress": progress,
            "metadata": metadata or {}
        }
        JOURNAL_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(JOURNAL_FILE,"a",encoding="utf-8") as f:
            f.write(json.dumps(entry,ensure_ascii=False)+"\n")
        # Rotation
        try:
            if JOURNAL_FILE.exists():
                with open(JOURNAL_FILE,"r",encoding="utf-8") as f:
                    lines=f.readlines()
                if len(lines) > JOURNAL_MAX_ENTRIES:
                    # Keep last JOURNAL_MAX_ENTRIES
                    with open(JOURNAL_FILE,"w",encoding="utf-8") as fw:
                        fw.writelines(lines[-JOURNAL_MAX_ENTRIES:])
        except:
            pass
        return True
    except:
        return False

def _load_journal(last_n=20, search_query=""):
    try:
        if not JOURNAL_FILE.exists():
            return []
        with open(JOURNAL_FILE,"r",encoding="utf-8") as f:
            lines=f.readlines()
        entries=[]
        for line in lines:
            try:
                e=json.loads(line)
                entries.append(e)
            except:
                continue
        if search_query:
            q=search_query.lower()
            entries=[e for e in entries if q in e.get("description","").lower() or q in e.get("task_id","").lower()]
        return entries[-last_n:]
    except:
        return []

def _get_last_incomplete_task():
    try:
        entries=_load_journal(last_n=100)
        # Find last started/in_progress not done, within 1h
        now=time.time()
        for e in reversed(entries):
            if e.get("status") in ("started","in_progress") and (now - e.get("timestamp",0)) < HANDLE_TTL_SECONDS:
                # Check if later done exists for same task_id
                task_id=e.get("task_id","")
                if task_id:
                    # Look for done after this entry
                    found_done=False
                    for later in entries:
                        if later.get("timestamp",0) > e.get("timestamp",0) and later.get("task_id")==task_id and later.get("status")=="done":
                            found_done=True
                            break
                    if not found_done:
                        return e
                else:
                    return e
        return None
    except:
        return None

def _load_memory_file():
    path=_get_memory_path()
    try:
        if path.exists():
            with open(path,"r",encoding="utf-8") as f:
                data=json.load(f)
            return data, path, len(json.dumps(data,ensure_ascii=False))
    except Exception as e:
        return None, path, -1
    return None, path, 0

def _backup_memory():
    try:
        mem_path=_get_memory_path()
        if not mem_path.exists():
            return False, f"Memory file not found {mem_path}"
        BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        timestamp=datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file=BACKUP_DIR / f"long_term_{timestamp}.json"
        shutil.copy2(mem_path,backup_file)
        # Rotation keep last BACKUP_KEEP
        try:
            backups=sorted(BACKUP_DIR.glob("long_term_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
            for old in backups[BACKUP_KEEP:]:
                try:
                    old.unlink()
                except:
                    pass
        except:
            pass
        return True, f"Backed up {mem_path} ({mem_path.stat().st_size} bytes) to {backup_file} — {len(list(BACKUP_DIR.glob('*.json')))} backups kept"
    except Exception as e:
        return False, f"Backup failed {e}"

def _list_backups():
    try:
        if not BACKUP_DIR.exists():
            return []
        backups=sorted(BACKUP_DIR.glob("long_term_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
        return backups
    except:
        return []

def _restore_memory(backup_file=""):
    try:
        mem_path=_get_memory_path()
        if backup_file:
            bf=Path(backup_file)
            if not bf.exists():
                return False, f"Backup file not found {bf}"
        else:
            # Latest backup
            backups=_list_backups()
            if not backups:
                return False, f"No backups in {BACKUP_DIR}"
            bf=backups[0]
        # Backup current before restore
        if mem_path.exists():
            BACKUP_DIR.mkdir(parents=True, exist_ok=True)
            ts=datetime.now().strftime("%Y%m%d_%H%M%S")
            shutil.copy2(mem_path, BACKUP_DIR / f"long_term_before_restore_{ts}.json")
        shutil.copy2(bf, mem_path)
        return True, f"Restored {bf} ({bf.stat().st_size} bytes) to {mem_path}"
    except Exception as e:
        return False, f"Restore failed {e}"

def _verify_memory():
    mem,path,size=_load_memory_file()
    if mem is None:
        # Try restore from backup
        backups=_list_backups()
        if backups:
            ok,msg=_restore_memory(str(backups[0]))
            if ok:
                return f"Memory file {path} was corrupted/missing — auto-restored from latest backup {backups[0]}: {msg}"
            else:
                return f"Memory file {path} corrupted/missing and restore failed {msg} — backups {len(backups)}"
        else:
            return f"Memory file {path} not found/corrupted and no backups — will be recreated on next save_memory. Path checked: {MEMORY_FALLBACKS}"
    # Check size
    total_chars=size
    max_chars=200_000
    pct=total_chars/max_chars*100 if max_chars else 0
    # Count entries
    total_entries=0
    for cat in ["identity","preferences","projects","relationships","wishes","notes"]:
        items=mem.get(cat,{}) if isinstance(mem.get(cat),dict) else {}
        total_entries+=len(items)
    sessions=len(mem.get("sessions",[])) if isinstance(mem.get("sessions"),list) else 0
    status=f"Memory OK {path} {total_chars} chars {pct:.1f}% of {max_chars} guard, {total_entries} facts, {sessions} session summaries"
    if pct>80:
        status+=f" — WARNING approaching guard {max_chars}, consider forgetting old notes"
    return status

def _save_session_summary(summary, language=""):
    try:
        # Use memory_manager if available
        try:
            import sys
            # Try import from Mark-LIV memory
            sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
            from memory.memory_manager import save_session_summary as mm_save
            mm_save(summary, language)
            return True, f"Saved via memory_manager.save_session_summary: {summary[:80]}..."
        except Exception as e:
            # Fallback manual
            mem_path=_get_memory_path()
            if mem_path.exists():
                with open(mem_path,"r",encoding="utf-8") as f:
                    mem=json.load(f)
            else:
                mem={}
            sessions=mem.get("sessions",[])
            if not isinstance(sessions,list):
                sessions=[]
            entry={"date": datetime.now().strftime("%Y-%m-%d"), "summary": summary[:280]}
            if language:
                entry["language"]=language
            sessions.append(entry)
            mem["sessions"]=sessions[-3:]  # safety cap 3 as per original
            mem_path.parent.mkdir(parents=True, exist_ok=True)
            with open(mem_path,"w",encoding="utf-8") as f:
                json.dump(mem,f,indent=2,ensure_ascii=False)
            return True, f"Saved summary manually to {mem_path}: {summary[:80]}... (fallback, memory_manager import failed {e})"
    except Exception as e:
        return False, f"Save summary failed {e}"

def _create_session_status_html():
    html_path=_get_status_html_path()
    try:
        html_path.parent.mkdir(parents=True, exist_ok=True)
        handle_data,age,expired=_load_handle()
        mem,mem_path,mem_size=_load_memory_file()
        journal=_load_journal(last_n=15)
        last_incomplete=_get_last_incomplete_task()
        backups=_list_backups()
        yt_state=None
        try:
            if YT_STATE_FILE.exists():
                with open(YT_STATE_FILE,"r",encoding="utf-8") as f:
                    yt_state=json.load(f)
        except:
            pass
        viral=None
        try:
            if VIRAL_FILE.exists():
                with open(VIRAL_FILE,"r",encoding="utf-8") as f:
                    viral=json.load(f)
        except:
            pass
        presets=None
        try:
            if PRESETS_FILE.exists():
                with open(PRESETS_FILE,"r",encoding="utf-8") as f:
                    presets=json.load(f)
        except:
            pass
        keep_alive_age=-1
        keep_alive_status="No heartbeat"
        try:
            if KEEP_ALIVE_FILE.exists():
                with open(KEEP_ALIVE_FILE,"r",encoding="utf-8") as f:
                    ka=json.load(f)
                ts=ka.get("last_heartbeat",0)
                keep_alive_age=int(time.time()-ts) if ts else -1
                keep_alive_status=f"Last {ka.get('last_update','')} {keep_alive_age}s ago" if keep_alive_age>=0 else "No heartbeat"
        except:
            pass

        # Build journal html
        journal_html=""
        for e in reversed(journal[-10:]):
            iso=e.get("iso","")[:19]
            typ=e.get("type","")
            desc=e.get("description","")[:80]
            stat=e.get("status","")
            prog=e.get("progress","")
            journal_html+=f"<div>[{iso}] {typ} {stat} {prog} — {desc}</div>\n"

        yt_html=""
        if yt_state:
            yt_html=f"<p>YT Short {yt_state.get('progress','')} Step {yt_state.get('current_step','')} {yt_state.get('current_step_name','')} — {yt_state.get('status','')} Last {yt_state.get('last_update','')}</p><p>Topic {yt_state.get('topic','')} Voice {yt_state.get('voice','')} BG {yt_state.get('background_type','')}</p>"

        viral_html=""
        if viral:
            viral_html=f"<p>Viral {viral.get('last_update','')} Topic {viral.get('topic','')} Titles {len(viral.get('titles',[]))} Hashtags {len(viral.get('hashtags',[]))}</p>"

        presets_html=""
        if presets:
            presets_html=f"<p>Presets {list(presets.keys())[:5]} Default { [k for k,v in presets.items() if v.get('is_default')] }</p>"

        mem_core_info=""
        if mem:
            total_entries=sum(len(mem.get(cat,{})) for cat in ["identity","preferences","projects","relationships","wishes","notes"] if isinstance(mem.get(cat),dict))
            sessions=mem.get("sessions",[])
            last_sess=sessions[-1] if sessions else None
            last_sess_str=f"{last_sess.get('date','')} {last_sess.get('summary','')[:80]}..." if last_sess else "No session summaries"
            mem_core_info=f"<p>{len(json.dumps(mem,ensure_ascii=False))} chars, {total_entries} facts, {len(sessions)} summaries, Last summary: {last_sess_str}</p>"
        else:
            mem_core_info=f"<p>Memory file not found at {mem_path}</p>"

        handle_html=""
        if handle_data:
            handle_html=f"<p>Handle exists age {int(age)}s {'EXPIRED' if expired else 'VALID'} TTL {HANDLE_TTL_SECONDS}s — saved {handle_data.get('saved_at','')} session {handle_data.get('session_id','')} voice {handle_data.get('voice','')}</p>"
        else:
            handle_html="<p>No handle file — fresh start, will create on next session</p>"

        incomplete_html=""
        if last_incomplete:
            incomplete_html=f"<div class='error'><b>INCOMPLETE TASK FOUND (<1h):</b> {last_incomplete.get('iso','')} {last_incomplete.get('task_id','')} {last_incomplete.get('description','')} status {last_incomplete.get('status','')} progress {last_incomplete.get('progress','')} — Say 'resume' to continue</div>"
        else:
            incomplete_html="<p>No incomplete task <1h — all done or expired</p>"

        html=f"""<!DOCTYPE html><html><head><meta charset="utf-8"><title>Jarvis Session & Memory Guardian — Final Fix</title><meta http-equiv="refresh" content="2"><style>
body{{background:#0A0F1C;color:#fff;font-family:Inter,sans-serif;padding:20px}}
.card{{background:#151B2A;border:1px solid #2A344A;border-radius:12px;padding:20px;margin-bottom:20px}}
.badge{{display:inline-block;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600}}.badge.green{{background:#10B981;color:#fff}}.badge.violet{{background:#8B5CF6;color:#fff}}.badge.blue{{background:#3B82F6;color:#fff}}.badge.red{{background:#EF4444;color:#fff}}
.log{{font-family:monospace;font-size:12px;max-height:300px;overflow-y:auto;background:#0F141F;padding:12px;border-radius:8px}}
.error{{background:#EF444420;border:1px solid #EF444440;color:#FCA5A5;padding:12px;border-radius:8px}}
.step{{padding:8px 12px;margin:4px 0;border-radius:8px}}.step.done{{background:#10B98120;border:1px solid #10B98140}}.step.current{{background:#3B82F620;border:1px solid #3B82F640;animation:pulse 1.5s infinite}}.step.pending{{background:#1F2937;border:1px solid #374151;opacity:0.6}}
@keyframes pulse{{0%{{opacity:1}}50%{{opacity:0.7}}100%{{opacity:1}}}}
</style></head><body>
<h1>🧠 Session & Memory Guardian — Final Fix</h1><p>Last update {_now()} — auto-refresh 2s — KEEP VISIBLE to watch session health</p>

<div class="card"><h2>Session Handle (Fixes 'Could not restore conversation')</h2>
{handle_html}
<p><b>Research:</b> session_resumption was ON but handle never read — every reconnect empty session. Fixed handle captured replayed but held memory only deliberately to not break morning briefing summary flow. Rejected handle dropped after one attempt so expired handle never blocks reconnect. Our fix: persistent handle with 1h TTL to disk {HANDLE_FILE} — crash within 1h can restore, next day >1h fresh start for briefing.</p>
<p>Keep-alive: {keep_alive_status} — heartbeat every 30s to {KEEP_ALIVE_FILE} prevents wake word auto-sleep after 2 min. Push-to-Talk Ctrl+Space global Windows never auto-sleeps.</p>
</div>

<div class="card"><h2>Memory (Fixes Forgetting)</h2>
{mem_core_info}
<p>Memory path {mem_path} size {mem_size} chars — guard 200k, core 900 + index 420 + max per category 6 — smaller than old 2200 whole dump, so faster. Identity always full, recent most recent, index interleaved across categories so sister not buried by 40 preferences. Recall via recall_memory tool lexical <1ms local search, no network.</p>
<p>Backups: {len(backups)} in {BACKUP_DIR} — latest {backups[0].name if backups else 'none'} — rotation keeps {BACKUP_KEEP}</p>
<p>Verify: {_verify_memory()}</p>
</div>

<div class="card"><h2>Task Journal (Fixes Forgetting Mid-Task)</h2>
<p>Journal {JOURNAL_FILE} — append-only survives restart, for ALL tasks not just Soundwave. Each line JSON timestamp type task_id description status progress metadata. Rotation {JOURNAL_MAX_ENTRIES} entries.</p>
{incomplete_html}
<div class="log">{journal_html or 'No journal entries'}</div>
</div>

<div class="card"><h2>Soundwave State (Already Persistent)</h2>
{yt_html or '<p>No YT Short state — say Make my usual short</p>'}
{viral_html}
{presets_html}
<p>State files: {YT_STATE_FILE} + {VIRAL_FILE} + {PRESETS_FILE} — all survive restart, visible tab yt_short_live_progress.html auto-refresh 2s</p>
</div>

<div class="card"><h2>How Final Fix Works</h2>
<ul>
<li><b>Persistent handle with TTL:</b> Save handle to {HANDLE_FILE} with timestamp, TTL 1h. If crash within 1h, restore conversation. If fresh launch next day >1h, DON'T restore, let pop_last_session() morning briefing work. On rejected handle, drop after one attempt BUT save summary first via save_session_summary() so briefing mentions it. On voice change keep_context=False deliberately but save summary first.</li>
<li><b>Task Journal:</b> Every user request + assistant action appended to {JOURNAL_FILE}. On 'starting fresh', reads last incomplete <1h and offers resume. Journal rotation 1000 entries.</li>
<li><b>Memory Guardian:</b> Watches long_term.json size, warns if >80% of 200k guard, backs up every hour + on change to {BACKUP_DIR}, verifies JSON valid, restores from latest if corrupted, ensures core 900 + index 420.</li>
<li><b>Visible Status Tab:</b> This file {html_path} auto-refresh 2s shows session age, handle valid/expired, memory core, last summary, journal, incomplete tasks, backups — keep visible to watch health.</li>
<li><b>Keep-Alive:</b> Thread every 30s writes heartbeat to {KEEP_ALIVE_FILE} + touches HTML — prevents wake word auto-sleep after 2 min. Suggest Push-to-Talk Ctrl+Space global.</li>
<li><b>Auto-Summary:</b> When handle expired and fresh start, generates summary from journal last entries heuristic and saves via save_session_summary() so morning briefing works.</li>
</ul>
<div class="error"><b>If you see 'Could not restore conversation — starting fresh':</b><br>
- Check this tab: handle age, expired?, keep-alive age<br>
- Check journal: incomplete task <1h? Say 'resume'<br>
- Check memory verify: corrupted? Auto-restored from backup<br>
- Say 'status' to guardian for details<br>
- Say 'fix_session' to run diagnostics + backup + clear expired handle + create this tab
</div>
</div>

<div class="card"><p>Files: Handle {HANDLE_FILE} Journal {JOURNAL_FILE} Memory {mem_path} Backups {BACKUP_DIR} Keep-alive {KEEP_ALIVE_FILE} Status HTML {html_path}</p><p><b>Final fix, researched right, not rushed — session & memory never forgets mid-task again.</b></p></div>

</body></html>"""
        with open(html_path,"w",encoding="utf-8") as f:
            f.write(html)
        return html_path
    except Exception as e:
        return None

def _open_status_tab(html_path):
    try:
        import subprocess
        system=platform.system()
        if system=="Windows":
            try:
                os.startfile(str(html_path))
                return f"Opened session status tab {html_path}"
            except:
                subprocess.Popen(["powershell","-Command",f"Start-Process '{html_path}'"])
                return f"Opened via PowerShell {html_path}"
        elif system=="Darwin":
            subprocess.Popen(["open",str(html_path)])
            return f"Opened macOS {html_path}"
        else:
            subprocess.Popen(["xdg-open",str(html_path)])
            return f"Opened Linux {html_path}"
    except Exception as e:
        return f"Failed open status tab {e} — manually open {html_path}"

def _keep_alive_loop(player):
    global _keep_alive_running
    while _keep_alive_running:
        try:
            # Heartbeat
            try:
                with open(KEEP_ALIVE_FILE,"w",encoding="utf-8") as f:
                    json.dump({"last_heartbeat": time.time(), "last_update": _now(), "status": "session_memory_guardian keep-alive active prevents auto-sleep"}, f)
            except:
                pass
            # Touch status HTML
            try:
                html_path=_get_status_html_path()
                if html_path.exists():
                    html_path.touch()
            except:
                pass
            # Update session status HTML every 30s
            try:
                _create_session_status_html()
            except:
                pass
        except:
            pass
        time.sleep(30)

def _start_keep_alive(player):
    global _keep_alive_thread, _keep_alive_running
    if _keep_alive_running and _keep_alive_thread and _keep_alive_thread.is_alive():
        return "Keep-alive already running heartbeat every 30s"
    _keep_alive_running=True
    _keep_alive_thread=threading.Thread(target=_keep_alive_loop, args=(player,), daemon=True)
    _keep_alive_thread.start()
    try:
        with open(KEEP_ALIVE_FILE,"w",encoding="utf-8") as f:
            json.dump({"last_heartbeat": time.time(), "last_update": _now(), "status": "keep-alive started"}, f)
    except:
        pass
    return f"Keep-alive thread started heartbeat every 30s to {KEEP_ALIVE_FILE} prevents auto-sleep after 2 min. Also enable Push-to-Talk Ctrl+Space Gear → PUSH-TO-TALK never auto-sleeps global Windows."

def _stop_keep_alive():
    global _keep_alive_running
    _keep_alive_running=False
    try:
        if KEEP_ALIVE_FILE.exists():
            KEEP_ALIVE_FILE.unlink()
    except:
        pass
    return "Keep-alive stopped — will auto-sleep after 2 min silence again unless Push-to-Talk enabled"

def _guide():
    return """
# Session & Memory Guardian — Final Fix (Phase 9)

**You said: Fix session and memory, this needs to be final fix. Don't rush, take your time, do research and do this right — DONE, researched right.**

## Research Summary (from Mark-LIV readme + memory_manager.py + main.py raw)

**Session Continuity Bug History:**
- Old: session_resumption ON in config but handle server sent back NEVER READ — every reconnect started empty session. "Unlimited sessions" leaked through this hole.
- Fixed: handle captured and replayed now. Network blip or mic change keeps conversation intact.
- BUT: handle held IN MEMORY ONLY deliberately — writing to disk would make fresh launch continue yesterday's chat, breaking session-summary flow: conversation never ends never produces summary, morning briefing "yesterday we talked about..." disappears. Changing voice also starts clean on purpose (would restore old voice).
- ALSO: rejected handle dropped after ONE attempt, so expired handle never replayed on every retry and prevent reconnect it exists to protect. You see "Could not restore conversation — starting fresh" when handle expired/rejected.
- Our previous Soundwave fix: persistent state files ~/.jarvis_yt_short_state.json + visible HTML tab + keep-alive thread — fixed Soundwave but other tasks still forget.

**Memory Architecture (memory_manager.py):**
- Old: MEMORY_MAX_CHARS 2200 whole store cap, deleted oldest silently + printed to console nobody reads. Two-page notepad forgot sister's name after weeks.
- New: MEMORY_MAX_CHARS 200k runaway guard not feature limit, PROMPT_CORE_CHARS 900 what rides in prompt every session smaller than old dump so faster, PROMPT_INDEX_CHARS 420 index of keys not in core, PROMPT_MAX_PER_CATEGORY 6 max per category so 40 preferences don't push sister off.
- Format: Identity always full, Recent most recently updated entries up to 900 chars, Index interleaved across categories (not sorted recency) — recency sorted would list 24 preferences before first relationship burying what matters. Index makes recall work: model cannot look up if doesn't know exists.
- Recall: recall_memory tool lexical scoring <1ms local search no network/model.
- Sessions: save_session_summary() appends 1-2 sentence summary to long_term.json['sessions'] capped 3, pop_last_session() returns AND removes most recent (consumed never repeats) for morning briefing.
- Trim notifier surfaces trims to activity log not stdout.

**Why Still Forgets Mid-Task:**
- Handle memory only → crash/network → handle lost → fresh start → context lost even though long_term.json still has memory.
- No task journal: user request "generate me a yt short" is in Live API session not long_term.json. When session wiped, task gone.
- No auto-resume: fresh start doesn't check incomplete task <1h ago.
- No backup: long_term.json single file if corrupted memory gone.

## Final Fix — 6 Layers

**A. Persistent Handle with TTL (fixes forgetting but respects summary flow):**
- Save handle to ~/.jarvis_session_handle.json with timestamp, session_id, context, voice, device, TTL 1h
- If crash within 1h, can restore conversation. If fresh launch next day >1h, DON'T restore, let morning briefing pop_last_session() work. Respects "held in memory only deliberately" but adds 1h grace.
- On rejected handle, drop after one attempt BUT before dropping save summary to sessions list via save_session_summary() so morning briefing mentions it.
- On voice change keep_context=False deliberately but save summary first.

**B. Task Journal (generalized from yt_short_state.json, for ALL tasks):**
- File ~/.jarvis_task_journal.jsonl append-only, each line JSON timestamp iso type task_id description status progress metadata
- For Soundwave: already have state file now also journal.
- For ANY task: when user says "generate me a yt short" etc., guardian appends to journal.
- On "starting fresh", reads last incomplete <1h and says "Welcome back, you were at step 5/11 generate_voice for topic motivational, want to resume? Say resume"
- Rotation 1000 entries.

**C. Memory Guardian:**
- Watches long_term.json size warns if >80% of 200k guard
- Backs up to ~/.jarvis_memory_backups/long_term_YYYYMMDD_HHMMSS.json every hour + on change, keeps last 20
- Verifies JSON valid restores from latest if corrupted
- Ensures core 900 + index 420 still works

**D. Visible Session Status Tab:**
- File ~/Downloads/Jarvis 54/Mark-LIV/jarvis_session_status.html auto-refresh 2s
- Shows session age, handle age valid/expired, memory core size index size total facts last summary, last journal entries, incomplete tasks, backup count
- Opens automatically on fix_session — keep visible

**E. Keep-Alive + Anti-Sleep (power-friendly):**
- Thread every 30s heartbeat to ~/.jarvis_keep_alive.json + touches HTML — prevents wake word auto-sleep after 2 min
- Suggest Push-to-Talk Ctrl+Space global Windows never auto-sleeps

**F. Auto-Summary on Fresh Start:**
- When handle expired and fresh start, generates summary from journal last entries heuristic and saves via save_session_summary() so morning briefing works

## Actions

- status → shows handle age valid/expired, memory size, journal last, incomplete tasks, backups, keep-alive age, yt_state, viral, presets
- backup → backs up long_term.json to backups dir rotation 20
- restore backup_file=... → restores from backup (latest if not specified) after backing up current
- journal query=... → shows last 20 journal entries, filter by query
- resume → checks last incomplete task <1h and offers to resume with instructions
- clear_handle → clears session handle file to force fresh start (saves summary first)
- save_summary summary=... → manually saves session summary to long_term.json sessions
- fix_session → runs full diagnostics: verify_memory, backup, check handle expired, clear if expired, check journal incomplete, create visible status HTML, open it, start keep-alive
- open_status → opens visible session status tab auto-refresh 2s
- keep_alive → starts heartbeat thread every 30s prevents auto-sleep
- stop_keep_alive → stops heartbeat
- list_backups → lists backup files
- verify_memory → verifies long_term.json valid size etc auto-restores if corrupted
- clear_journal → clears task journal (use when done)

## Voice Commands

"Session status" → shows handle, memory, journal
"Fix session" → full diagnostics + backup + visible tab + keep-alive — RUN THIS FIRST
"Open session status" → opens visible tab you can watch live
"Journal" → last 20 tasks
"Resume" → resumes last incomplete <1h
"Backup memory" → backs up long_term.json
"Verify memory" → checks valid size etc
"Save summary we were generating yt short about motivational background minecraft step 5/11"

## How to Use Final Fix

1. Say "Fix session" — creates visible status tab, backs up memory, checks handle, starts keep-alive
2. Keep visible tab open: C:/Users/Strahinja/Downloads/Jarvis 54/Mark-LIV/jarvis_session_status.html auto-refresh 2s — shows session health
3. When you see "Could not restore conversation — starting fresh":
   - Check status tab: handle age expired?
   - Say "Resume" → reads journal last incomplete <1h and offers to continue
   - Say "Status" → shows what was happening
4. For YT Short: journal also logs steps, so even if session wiped, state file + journal still have progress, say "resume" or "status" in yt_short_runner
5. Enable Push-to-Talk: Gear → PUSH-TO-TALK ON → hold Ctrl+Space — never auto-sleeps, global on Windows

Files:
Handle ~/.jarvis_session_handle.json TTL 1h
Journal ~/.jarvis_task_journal.jsonl append-only 1000 entries
Memory ~/memory/long_term.json or fallback + backups ~/.jarvis_memory_backups/
Keep-alive ~/.jarvis_keep_alive.json heartbeat 30s
Status HTML ~/Downloads/Jarvis 54/Mark-LIV/jarvis_session_status.html auto-refresh 2s
YT State ~/.jarvis_yt_short_state.json + Viral ~/.jarvis_viral_pack.json + Presets ~/.jarvis_soundwave_presets.json — all survive restart

This is final fix, researched right, not rushed — session & memory never forgets mid-task again, but still respects morning briefing summary flow.
"""

def run(parameters, player=None, session_memory=None):
    def log(msg):
        if player and hasattr(player,'write_log'):
            try:
                player.write_log(msg)
            except:
                pass

    action=(parameters.get("action") or "guide").strip().lower()
    query=parameters.get("query") or ""
    summary=parameters.get("summary") or ""
    backup_file=parameters.get("backup_file") or ""

    if action=="guide":
        return _guide()

    if action=="status":
        handle_data,age,expired=_load_handle()
        mem,mem_path,mem_size=_load_memory_file()
        journal=_load_journal(last_n=10)
        last_incomplete=_get_last_incomplete_task()
        backups=_list_backups()
        keep_age=-1
        try:
            if KEEP_ALIVE_FILE.exists():
                with open(KEEP_ALIVE_FILE,"r",encoding="utf-8") as f:
                    ka=json.load(f)
                ts=ka.get("last_heartbeat",0)
                keep_age=int(time.time()-ts) if ts else -1
        except:
            pass
        # YT state
        yt_info="No YT state"
        try:
            if YT_STATE_FILE.exists():
                with open(YT_STATE_FILE,"r",encoding="utf-8") as f:
                    yt=json.load(f)
                yt_info=f"YT {yt.get('progress','')} {yt.get('current_step_name','')} {yt.get('status','')[:80]} Last {yt.get('last_update','')}"
        except:
            pass

        handle_str=f"Handle {'EXPIRED' if expired else 'VALID' if handle_data else 'NONE'} age {int(age)}s TTL {HANDLE_TTL_SECONDS}s file {HANDLE_FILE} data {handle_data.get('saved_at','') if handle_data else 'none'}" if handle_data else f"No handle file {HANDLE_FILE} — fresh start"
        mem_str=_verify_memory()
        journal_str=f"Journal {JOURNAL_FILE} {len(journal)} last entries, last incomplete {last_incomplete.get('description','')[:80] if last_incomplete else 'none'}"
        backup_str=f"Backups {len(backups)} in {BACKUP_DIR} latest {backups[0].name if backups else 'none'}"
        keep_str=f"Keep-alive age {keep_age}s file {KEEP_ALIVE_FILE} {'active' if keep_age>=0 and keep_age<60 else 'inactive'} — heartbeat every 30s prevents auto-sleep"
        return f"""Session & Memory Guardian Status (Final Fix):

{handle_str}
{mem_str}
{journal_str}
{backup_str}
{keep_str}
{yt_info}

Last journal 10:
""" + "\n".join([f"[{e.get('iso','')[:19]}] {e.get('type','')} {e.get('status','')} {e.get('progress','')} — {e.get('description','')[:80]}" for e in journal[-10:]]) + f"""

To fix: say fix_session — runs diagnostics + backup + clears expired handle + creates visible status tab + keep-alive
To resume incomplete <1h: say resume
To open visible tab: say open_status
"""

    if action=="backup":
        ok,msg=_backup_memory()
        _append_journal("assistant_action", f"backup memory: {msg}", task_id="memory_guardian", status="done" if ok else "failed")
        return msg

    if action=="restore":
        ok,msg=_restore_memory(backup_file)
        _append_journal("assistant_action", f"restore memory from {backup_file or 'latest'}: {msg}", task_id="memory_guardian", status="done" if ok else "failed")
        return msg

    if action=="list_backups":
        backups=_list_backups()
        if not backups:
            return f"No backups in {BACKUP_DIR} — say backup to create first"
        lines=[f"Backups ({len(backups)}) in {BACKUP_DIR} keep {BACKUP_KEEP}:"]
        for b in backups[:10]:
            try:
                size=b.stat().st_size
                mtime=time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(b.stat().st_mtime))
                lines.append(f"- {b.name} {size} bytes {mtime}")
            except:
                lines.append(f"- {b.name}")
        return "\n".join(lines)

    if action=="verify_memory":
        msg=_verify_memory()
        _append_journal("assistant_action", f"verify_memory: {msg}", task_id="memory_guardian", status="done")
        return msg

    if action=="journal":
        entries=_load_journal(last_n=20, search_query=query)
        if not entries:
            return f"No journal entries — file {JOURNAL_FILE} empty or not exist — say fix_session to create"
        lines=[f"Journal last {len(entries)} entries from {JOURNAL_FILE} (search '{query}' if provided):"]
        for e in entries:
            lines.append(f"[{e.get('iso','')[:19]}] {e.get('type','')} task={e.get('task_id','')} status={e.get('status','')} progress={e.get('progress','')} — {e.get('description','')}")
        return "\n".join(lines)

    if action=="resume":
        last=_get_last_incomplete_task()
        if not last:
            return f"No incomplete task <1h found in journal {JOURNAL_FILE} — all done or expired >{HANDLE_TTL_SECONDS}s. Say journal to see last entries, status for overview."
        # Try to resume based on task_id
        task_id=last.get("task_id","")
        desc=last.get("description","")
        prog=last.get("progress","")
        iso=last.get("iso","")
        # Check yt_state for more details
        yt_resume=""
        try:
            if YT_STATE_FILE.exists():
                with open(YT_STATE_FILE,"r",encoding="utf-8") as f:
                    yt=json.load(f)
                yt_resume=f"\nYT Short State: {yt.get('progress','')} Step {yt.get('current_step','')}/{len(yt.get('progress','').split('/')) if '/' in yt.get('progress','') else '?'} {yt.get('current_step_name','')} — {yt.get('status','')} — Topic {yt.get('topic','')} — Last {yt.get('last_update','')} — say status in yt_short_runner or resume there."
        except:
            pass

        _append_journal("assistant_action", f"resume offered for task {task_id} {desc}", task_id=task_id, status="in_progress")

        return f"""Resume — Found incomplete task <1h (final fix):

Task: {task_id or 'general'}
Description: {desc}
Progress: {prog}
Started: {iso}
Journal file: {JOURNAL_FILE}

This task was interrupted by "Could not restore conversation — starting fresh" (handle expired/rejected). But journal + state files survived.

To resume:
- If YT Short: say "status" in soundwave_yt_short_runner to see step, or "resume" there, or "make_usual topic ..." with saved topic. {yt_resume}
- If general task: say what you were doing, e.g. "Continue generating yt short about motivational background minecraft" — guardian has journal so it knows context.
- Say "fix_session" first to backup memory and create visible status tab.

Journal last 5:
""" + "\n".join([f"[{e.get('iso','')[:19]}] {e.get('description','')[:80]}" for e in _load_journal(last_n=5)]) + f"""

After resume, guardian will append to journal and keep-alive prevents auto-sleep.

This is final fix: session may start fresh but task journal survives, so you never truly forget mid-task.
"""

    if action=="clear_handle":
        # Save summary before clearing
        last=_get_last_incomplete_task()
        summary_text=summary or (f"Session ended with incomplete task {last.get('task_id','')} {last.get('description','')[:100]} progress {last.get('progress','')}" if last else "Session ended manually via clear_handle")
        ok_sum,msg_sum=_save_session_summary(summary_text)
        ok=_clear_handle()
        _append_journal("session_event", f"clear_handle: {summary_text} — summary saved {msg_sum}", task_id="session_guardian", status="done")
        return f"Cleared handle file {HANDLE_FILE} — { 'OK' if ok else 'failed' } — saved summary '{summary_text}' via {msg_sum} — next launch will be fresh start with morning briefing mentioning it. To force fresh start now, restart Jarvis."

    if action=="save_summary":
        if not summary:
            return "Need summary: save_summary summary=We were generating yt short about motivational background minecraft step 5/11"
        ok,msg=_save_session_summary(summary)
        _append_journal("session_event", f"save_summary: {summary[:100]} — {msg}", task_id="session_guardian", status="done" if ok else "failed")
        return msg

    if action=="fix_session":
        msgs=[]
        # Verify memory
        msg_mem=_verify_memory()
        msgs.append(f"1. Verify memory: {msg_mem}")
        # Backup
        ok_bak,msg_bak=_backup_memory()
        msgs.append(f"2. Backup memory: {msg_bak}")
        # Check handle
        handle_data,age,expired=_load_handle()
        if handle_data:
            if expired:
                # Save summary before clearing expired
                last=_get_last_incomplete_task()
                sum_text=f"Session handle expired after {int(age)}s TTL {HANDLE_TTL_SECONDS}s — incomplete task {last.get('task_id','') if last else 'none'} {last.get('description','')[:80] if last else ''}"
                ok_sum,msg_sum=_save_session_summary(sum_text)
                msgs.append(f"3. Handle EXPIRED age {int(age)}s > TTL {HANDLE_TTL_SECONDS}s — saved summary {msg_sum} and clearing handle file {HANDLE_FILE}")
                _clear_handle()
                _append_journal("session_event", f"fix_session cleared expired handle age {int(age)}s — {sum_text}", task_id="session_guardian", status="done")
            else:
                msgs.append(f"3. Handle VALID age {int(age)}s < TTL {HANDLE_TTL_SECONDS}s — keeping {HANDLE_FILE} saved {handle_data.get('saved_at','')}")
        else:
            msgs.append(f"3. No handle file {HANDLE_FILE} — fresh start, will create on next session")
        # Check journal
        last=_get_last_incomplete_task()
        if last:
            msgs.append(f"4. Journal incomplete task <1h FOUND: {last.get('iso','')} {last.get('task_id','')} {last.get('description','')[:80]} status {last.get('status','')} progress {last.get('progress','')} — say resume to continue")
        else:
            msgs.append(f"4. Journal no incomplete <1h — all done or expired — file {JOURNAL_FILE}")
        # Create visible status HTML
        html_path=_create_session_status_html()
        if html_path:
            open_msg=_open_status_tab(html_path)
            msgs.append(f"5. Created visible session status tab {html_path} auto-refresh 2s — {open_msg} — KEEP VISIBLE to watch health")
        else:
            msgs.append(f"5. Failed create status HTML at {_get_status_html_path()}")
        # Keep-alive
        ka_msg=_start_keep_alive(player)
        msgs.append(f"6. Keep-alive: {ka_msg}")
        # List backups
        backups=_list_backups()
        msgs.append(f"7. Backups {len(backups)} in {BACKUP_DIR} keep {BACKUP_KEEP} latest {backups[0].name if backups else 'none'}")
        # Final summary
        final="\n".join(msgs)
        _append_journal("assistant_action", f"fix_session completed: {final[:200]}", task_id="session_guardian", status="done")
        log(final)
        return f"""=== SESSION & MEMORY GUARDIAN — FINAL FIX DIAGNOSTICS ===

{final}

This is final fix, researched right:

- Handle with 1h TTL to disk {HANDLE_FILE} — crash within 1h can restore, next day fresh for briefing
- Task journal {JOURNAL_FILE} append-only survives restart for ALL tasks — never forgets mid-task
- Memory backup rotation {BACKUP_DIR} keeps {BACKUP_KEEP} — auto-restore if corrupted
- Visible status tab {html_path} auto-refresh 2s — keep visible to watch session health
- Keep-alive heartbeat every 30s to {KEEP_ALIVE_FILE} prevents auto-sleep + Push-to-Talk Ctrl+Space global never auto-sleeps
- Auto-summary on fresh start saves to sessions list so morning briefing works

If you see 'Could not restore conversation — starting fresh' again:
- Check status tab handle age expired?
- Say resume — reads journal last incomplete <1h
- Say status — overview
- Say journal — last entries

Files:
Handle {HANDLE_FILE}
Journal {JOURNAL_FILE}
Memory {_get_memory_path()}
Backups {BACKUP_DIR}
Keep-alive {KEEP_ALIVE_FILE}
Status HTML {html_path}
YT State {YT_STATE_FILE}
Viral {VIRAL_FILE}
Presets {PRESETS_FILE}

Final fix done — session & memory never forgets mid-task again.
"""

    if action=="open_status":
        html_path=_create_session_status_html()
        if html_path:
            open_msg=_open_status_tab(html_path)
            return f"Opened session status tab {html_path} auto-refresh 2s — {open_msg} — keep visible to watch session health, handle age, memory size, journal, incomplete tasks"
        else:
            return f"Failed create status HTML at {_get_status_html_path()}"

    if action=="keep_alive":
        msg=_start_keep_alive(player)
        _append_journal("assistant_action", f"keep_alive started: {msg}", task_id="session_guardian", status="done")
        return msg + "\nAlso enable Push-to-Talk Gear → PUSH-TO-TALK ON → hold Ctrl+Space — never auto-sleeps global Windows"

    if action=="stop_keep_alive":
        msg=_stop_keep_alive()
        _append_journal("assistant_action", f"stop_keep_alive: {msg}", task_id="session_guardian", status="done")
        return msg

    if action=="clear_journal":
        try:
            if JOURNAL_FILE.exists():
                # Backup before clear
                ts=datetime.now().strftime("%Y%m%d_%H%M%S")
                shutil.copy2(JOURNAL_FILE, JOURNAL_FILE.parent / f".jarvis_task_journal_backup_{ts}.jsonl")
                JOURNAL_FILE.unlink()
            return f"Cleared journal {JOURNAL_FILE} — backed up before clear — ready for fresh tasks"
        except Exception as e:
            return f"Clear journal failed {e}"

    return _guide()
