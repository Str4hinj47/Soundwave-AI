"""Downloading via the vendored yt-download engine (custom Innertube, no yt-dlp).

The engine lives in vendor/yt-download/ and talks to YouTube's player API with
the Android/iOS app client contexts, which — unlike the web client used by
yt-dlp — are not met with "Sign in to confirm you're not a bot" from server
IPs. Progress is logged (no noise on stdout).
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path
from typing import Optional

# Make the vendored engine importable (vendor/yt-download/{bridge.py,engine/}).
_REPO_ROOT = Path(__file__).resolve().parent.parent
_VENDOR_ENGINE = _REPO_ROOT / "vendor" / "yt-download"
if str(_VENDOR_ENGINE) not in sys.path:
    sys.path.insert(0, str(_VENDOR_ENGINE))

from engine import innertube as yt  # noqa: E402
from bridge import download_to  # noqa: E402

from .config import ClippingConfig

log = logging.getLogger(__name__)


def _progress_logger(state: dict):
    def on_progress(done, total, speed) -> None:
        if total:
            pct = int(done * 100 / total)
            if pct >= state["pct"] + 10:
                state["pct"] = pct
                log.info("download: %d%%", pct)

    return on_progress


def video_id_from_ref(ref: str) -> str:
    """Accept a bare id, watch URL, youtu.be link or Shorts URL."""
    ref = ref.strip()
    for marker in ("watch?v=", "youtu.be/", "shorts/", "embed/", "live/"):
        if marker in ref:
            rest = ref.split(marker, 1)[1]
            for sep in ("&", "?", "/"):
                rest = rest.split(sep, 1)[0]
            return rest
    if ref.startswith("http"):
        raise ValueError(f"unrecognised YouTube URL: {ref}")
    return ref


def download_video(
    video_id: str,
    out_dir: Path,
    cfg: ClippingConfig,
    ffmpeg: Optional[str] = None,
) -> Path:
    """Download one video into out_dir as <video_id>.<ext> (mp4 preferred).
    Returns its path. Re-uses an existing complete file when present
    (idempotent runs).
    """
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    existing = sorted(
        p for p in out_dir.glob(f"{video_id}.*")
        if p.suffix.lstrip(".") in ("mp4", "webm", "mkv") and p.stat().st_size > 0
    )
    if existing:
        log.info("reusing existing download %s", existing[0])
        return existing[0]

    url = f"https://www.youtube.com/watch?v={video_id}"
    log.info("downloading %s via the yt-download engine ...", url)
    state = {"pct": -10}
    try:
        dest = download_to(
            url,
            str(cfg.max_height),
            out_dir,
            video_id,
            proxy=cfg.proxy or None,
            ffmpeg=ffmpeg,
            on_progress=_progress_logger(state),
        )
    except yt.YouTubeError as exc:
        raise RuntimeError(f"download failed for {video_id}: {exc}") from exc

    log.info("downloaded: %s", dest.name)
    return dest
