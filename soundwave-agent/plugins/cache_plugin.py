"""
Soundwave AI — Background Gameplay Cache Manager Plugin
"""

from typing import Dict, Any, Optional
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from plugins.base_plugin import SoundwavePlugin
from cache_manager import list_cached_clips, build_cache_clip, get_cache_dir

class BackgroundCachePlugin(SoundwavePlugin):
    def __init__(self):
        super().__init__(
            name="soundwave_background_cache",
            description="Manages 80-second Minecraft parkour background video clips to accelerate video rendering."
        )

    def get_manifest(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "parameters": {
                "type": "OBJECT",
                "properties": {
                    "action": {
                        "type": "STRING",
                        "description": "Action: list_cache, build_clip",
                        "enum": ["list_cache", "build_clip"]
                    },
                    "youtube_url": {
                        "type": "STRING",
                        "description": "Optional custom YouTube gameplay URL to slice"
                    }
                },
                "required": ["action"]
            }
        }

    def execute(self, parameters: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> str:
        action = (parameters.get("action") or "list_cache").lower()

        if action == "list_cache":
            clips = list_cached_clips()
            cache_dir = get_cache_dir()
            if not clips:
                return f"No background clips found in {cache_dir}. Use action=build_clip to download and slice."
            total_mb = sum(c.stat().st_size for c in clips) / (1024 * 1024)
            lines = [f"Found {len(clips)} cached 80s gameplay clips ({total_mb:.1f} MB total):"]
            for c in clips[:10]:
                lines.append(f"- {c.name} ({c.stat().st_size / 1024 / 1024:.1f} MB)")
            return "\n".join(lines)

        if action == "build_clip":
            url = parameters.get("youtube_url")
            out_clip = build_cache_clip(youtube_url=url)
            if out_clip:
                return f"Successfully sliced 80s background clip: {out_clip.name}"
            else:
                return "Failed to download or slice clip. Ensure the yt-download engine (python3 + requests) and ffmpeg are available."

        return f"Unknown cache action: {action}"

def run(parameters: Dict[str, Any], player: Any = None, session_memory: Any = None) -> str:
    plugin = BackgroundCachePlugin()
    return plugin.execute(parameters, {"player": player, "memory": session_memory})
