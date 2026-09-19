"""
Action: browser_control
Navigates URLs, opens tabs, and interacts with web browsers.
"""

import webbrowser
import subprocess
import sys
from typing import Dict, Any

TOOL = {
    "name": "browser_control",
    "description": "Controls the web browser: open a URL, open a new tab, or search Google.",
    "parameters": {
        "type": "OBJECT",
        "properties": {
            "action": {
                "type": "STRING",
                "description": "open_url, new_tab, google_search",
                "enum": ["open_url", "new_tab", "google_search"]
            },
            "url": {
                "type": "STRING",
                "description": "Target website URL (e.g. 'https://github.com')"
            },
            "query": {
                "type": "STRING",
                "description": "Search query for google_search"
            }
        },
        "required": ["action"]
    }
}

def handler(parameters: Dict[str, Any], context: Any = None) -> str:
    action = (parameters.get("action") or "open_url").lower()
    url = parameters.get("url", "")
    query = parameters.get("query", "")

    if action == "google_search" and query:
        search_url = f"https://www.google.com/search?q={query}"
        webbrowser.open(search_url)
        return f"Opened Google search for '{query}' in your default browser."

    if action == "new_tab":
        webbrowser.open_new_tab("https://google.com")
        return "Opened a new browser tab."

    if url:
        if not url.startswith("http"):
            url = f"https://{url}"
        webbrowser.open(url)
        return f"Navigated browser to {url}."

    return "Please specify a URL or search query."
