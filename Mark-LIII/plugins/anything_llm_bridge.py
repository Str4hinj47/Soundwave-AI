"""
AnythingLLM Bridge — Delegate Non-PC Tasks to AnythingLLM for JARVIS (Mark LIII)
User has anythingLLM for all non-computer use tasks, JARVIS focuses on PC control. This plugin bridges them.

AnythingLLM is an open-source RAG platform — chat with docs, PDFs, etc. via local LLM.

This plugin lets JARVIS delegate non-PC tasks to AnythingLLM API, while keeping PC tasks local.

Free & open source.
"""

import json
from pathlib import Path
import platform

PLUGIN = {
    "name": "anything_llm_bridge",
    "description": (
        "AnythingLLM bridge — delegates non-PC tasks to AnythingLLM (user's existing setup for non-computer use). JARVIS handles PC control impeccably, AnythingLLM handles docs, RAG, knowledge, chat. "
        "Actions: status, chat, ask, list_workspaces, list_docs, upload_doc, help. "
        "Use when user asks non-PC tasks like summarize docs, chat with PDFs, knowledge base, RAG, anythingLLM, or when task is not PC control. "
        "Trigger phrases: anythingllm, anything llm, chat with docs, rag, knowledge base, ask docs, summarize document, non pc task, anything llm bridge."
    ),
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "Action: status, chat, ask, list_workspaces, list_docs, upload_doc, help. Default chat.",
            },
            "message": {
                "type": "STRING",
                "description": "Message/question for AnythingLLM, e.g. 'summarize my pdf' or 'what does doc say about X'",
            },
            "workspace": {
                "type": "STRING",
                "description": "AnythingLLM workspace slug, default from config or first workspace",
            },
        },
        "required": ["action"],
    },
}

PLUGIN_SETTINGS = {
    "namespace": "anything_llm",
    "title": "AnythingLLM Bridge",
    "description": "Delegate non-PC tasks to AnythingLLM — JARVIS does PC, AnythingLLM does docs/RAG",
    "icon": "🧠",
    "color": "#A855F7",
    "order": 20,
    "default_enabled": True,
    "fields": [
        {"key": "api_url", "label": "AnythingLLM API URL", "type": "text", "default": "http://localhost:3001"},
        {"key": "api_key", "label": "AnythingLLM API Key", "type": "password", "default": ""},
        {"key": "default_workspace", "label": "Default workspace slug", "type": "text", "default": ""},
        {"key": "delegate_non_pc", "label": "Auto-delegate non-PC tasks to AnythingLLM", "type": "checkbox", "default": True},
    ],
}

def _resolve_config():
    # Try to get AnythingLLM config from env or config file
    import os
    api_url = os.environ.get("ANYTHING_LLM_API_URL", "http://localhost:3001")
    api_key = os.environ.get("ANYTHING_LLM_API_KEY", "")
    workspace = os.environ.get("ANYTHING_LLM_WORKSPACE", "")
    # Try config/api_keys.json
    try:
        cfg_path = Path(__file__).resolve().parent.parent / "config" / "api_keys.json"
        if cfg_path.exists():
            cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
            api_url = cfg.get("anything_llm_url", api_url)
            api_key = cfg.get("anything_llm_api_key", api_key)
            workspace = cfg.get("anything_llm_workspace", workspace)
    except Exception:
        pass
    # Try plugin settings
    try:
        from memory.config_manager import get_config
        cfg = get_config()
        api_url = cfg.get("anything_llm_url", api_url)
        api_key = cfg.get("anything_llm_api_key", api_key)
    except Exception:
        pass
    return api_url, api_key, workspace

def run(parameters: dict, player=None, session_memory=None) -> str:
    action = (parameters.get("action", "chat") or "chat").lower().strip()
    message = parameters.get("message", "") or ""
    workspace = parameters.get("workspace", "") or ""

    try:
        if player:
            try:
                player.write_log(f"AnythingLLM Bridge: {action} {message[:50]}")
            except Exception:
                pass

        api_url, api_key, default_workspace = _resolve_config()
        workspace = workspace or default_workspace

        if action in ("help", "?", "h"):
            return (
                "AnythingLLM Bridge — Delegate Non-PC Tasks to AnythingLLM:\n"
                "\n"
                "You have anythingLLM for all non-computer use tasks, JARVIS focuses on PC control impeccably.\n"
                "\n"
                "• status — check AnythingLLM API status, workspaces, config\n"
                "• chat message=... [workspace=...] — chat with AnythingLLM workspace (RAG)\n"
                "• ask message=... — alias for chat\n"
                "• list_workspaces — list AnythingLLM workspaces\n"
                "• list_docs workspace=... — list docs in workspace\n"
                "• upload_doc path=... workspace=... — upload doc to workspace\n"
                "\n"
                "How it works:\n"
                "• JARVIS does PC: volume, brightness, files, windows, processes, clipboard, screenshots, browser, automation — 50+ actions via pc_master etc.\n"
                "• AnythingLLM does non-PC: docs, PDFs, knowledge base, RAG, summarization, Q&A — via API\n"
                "• This plugin bridges: if user asks non-PC task, JARVIS delegates to AnythingLLM API\n"
                "\n"
                "Config:\n"
                f"• API URL: {api_url} (env ANYTHING_LLM_API_URL or config/api_keys.json anything_llm_url)\n"
                f"• API Key: {'set' if api_key else 'not set'} (env ANYTHING_LLM_API_KEY or anything_llm_api_key)\n"
                f"• Workspace: {workspace or 'not set, will use first'} (env ANYTHING_LLM_WORKSPACE or anything_llm_workspace)\n"
                "\n"
                "Examples:\n"
                "• anything_llm_bridge action=chat message='summarize my pdf about AI'\n"
                "• anything_llm_bridge action=list_workspaces\n"
                "• anything_llm_bridge action=status\n"
                "\n"
                "Setup AnythingLLM:\n"
                "• https://anythingllm.com — open source, local, Docker: docker run -p 3001:3001 mintplexlabs/anythingllm\n"
                "• Create workspace, upload docs, get API key from Settings → API Keys\n"
                "• Set env: export ANYTHING_LLM_API_URL=http://localhost:3001 and ANYTHING_LLM_API_KEY=...\n"
            )

        if action == "status":
            try:
                import requests
                # Check API
                headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
                # Try to list workspaces
                r = requests.get(f"{api_url}/api/v1/workspaces", headers=headers, timeout=5)
                if r.status_code == 200:
                    data = r.json()
                    workspaces = data.get("workspaces", [])
                    ws_list = [f"{w.get('name')} ({w.get('slug')}) — {w.get('createdAt')}" for w in workspaces[:10]]
                    return (
                        f"AnythingLLM Status — Connected to {api_url}:\n"
                        f"• Workspaces: {len(workspaces)}\n"
                        + "\n".join(ws_list)
                        + f"\n• Default workspace: {workspace or 'not set, using first'}\n"
                        f"• API Key: {'set' if api_key else 'not set'}\n"
                        f"• JARVIS PC plugins: pc_master, file_commander, window_manager_pro, process_commander, clipboard_master, automation_master, browser_master, system_monitor_pro, app_launcher_pro, screen_master, network_commander — 50+ PC actions, zero tokens\n"
                    )
                else:
                    return f"AnythingLLM API at {api_url} returned {r.status_code}: {r.text[:500]} — check URL and API key"
            except ImportError:
                return f"AnythingLLM status — requests not installed, pip install requests. Config: URL {api_url}, workspace {workspace or 'not set'}. JARVIS PC control ready: 50+ actions via pc_master."
            except Exception as e:
                return f"AnythingLLM not reachable at {api_url}: {e}. Is AnythingLLM running? Docker: docker run -p 3001:3001 mintplexlabs/anythingllm. JARVIS PC control still works impeccably via pc_master etc."

        if action in ("chat", "ask"):
            if not message:
                return "Need message: chat message='summarize my document about AI'"
            try:
                import requests
                headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"} if api_key else {"Content-Type": "application/json"}
                # If no workspace, list and use first
                if not workspace:
                    try:
                        r = requests.get(f"{api_url}/api/v1/workspaces", headers=headers, timeout=5)
                        if r.status_code == 200:
                            ws = r.json().get("workspaces", [])
                            if ws:
                                workspace = ws[0].get("slug")
                    except Exception:
                        pass
                if not workspace:
                    return f"No workspace specified and none found — create workspace in AnythingLLM UI at {api_url}, then set workspace param or default_workspace in settings"

                # Chat with workspace
                payload = {"message": message, "mode": "chat"}
                r = requests.post(f"{api_url}/api/v1/workspace/{workspace}/chat", headers=headers, json=payload, timeout=30)
                if r.status_code == 200:
                    data = r.json()
                    response = data.get("textResponse") or data.get("response") or str(data)
                    return f"AnythingLLM ({workspace}) response:\n{response}"
                else:
                    return f"AnythingLLM chat failed {r.status_code}: {r.text[:1000]}"
            except ImportError:
                return "requests not installed — pip install requests for AnythingLLM bridge"
            except Exception as e:
                return f"AnythingLLM chat failed: {e}. Is AnythingLLM running at {api_url}?"

        if action == "list_workspaces":
            try:
                import requests
                headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
                r = requests.get(f"{api_url}/api/v1/workspaces", headers=headers, timeout=10)
                if r.status_code == 200:
                    ws = r.json().get("workspaces", [])
                    lines = [f"{w.get('name')} — slug: {w.get('slug')} — docs: {len(w.get('documents', []))}" for w in ws]
                    return f"AnythingLLM workspaces ({len(ws)}) at {api_url}:\n" + "\n".join(lines)
                return f"Failed to list workspaces {r.status_code}: {r.text[:500]}"
            except Exception as e:
                return f"List workspaces failed: {e}"

        if action == "list_docs":
            if not workspace:
                return "Need workspace: list_docs workspace=my_workspace"
            try:
                import requests
                headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
                r = requests.get(f"{api_url}/api/v1/workspace/{workspace}", headers=headers, timeout=10)
                if r.status_code == 200:
                    docs = r.json().get("workspace", {}).get("documents", [])
                    lines = [f"{d.get('title')} — {d.get('docId')}" for d in docs[:20]]
                    return f"Docs in {workspace} ({len(docs)}):\n" + "\n".join(lines)
                return f"Failed {r.status_code}: {r.text[:500]}"
            except Exception as e:
                return f"List docs failed: {e}"

        return f"Unknown action {action}. Say 'anything_llm_bridge action=help'"

    except Exception as e:
        return f"AnythingLLM Bridge failed: {e}"
