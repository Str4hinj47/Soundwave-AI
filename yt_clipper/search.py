"""YouTube discovery via public Invidious instances (no API key, no yt-dlp).

The yt-download engine handles downloads but deliberately does not scrape
search pages, so candidate discovery talks to Invidious instead — free,
keyless JSON endpoints that mirror YouTube search. Instances are rotated and
tried in order; a dead instance degrades to a warning, never a failed run.

Two stages (same shape as before):
  1. Search per query - cheap, gives id/title/duration/views.
  2. Detail fetch for the strongest coarse candidates - adds like counts,
     upload date and resolution, which the quality scorer needs.
"""
from __future__ import annotations

import logging
import time
from typing import Dict, List, Optional

import requests

from .config import ClippingConfig
from .models import VideoCandidate
from .quality import passes_hard_filters

log = logging.getLogger(__name__)

# Public Invidious instances with the JSON API enabled. The list is refreshed
# occasionally; dead/slow ones are skipped at runtime.
INSTANCES: List[str] = [
    "https://inv.nadeko.net",
    "https://invidious.nerdvpn.de",
    "https://inv.tux.pizza",
    "https://invidious.f5.si",
    "https://iv.melmac.space",
    "https://invidious.instance.ovh",
]

_UA = {"User-Agent": "soundwave-ai/yt-clipper (+https://github.com/Str4hinj47/Soundwave-AI)"}


class VideoSearcher:
    def __init__(self, cfg: ClippingConfig):
        self.cfg = cfg
        self._session = requests.Session()
        self._session.headers.update(_UA)
        if cfg.proxy:
            self._session.proxies.update({"https": cfg.proxy, "http": cfg.proxy})

    # ------------------------------------------------------------- plumbing
    def _get(self, path: str, params: Optional[Dict] = None):
        """Try each Invidious instance until one answers with usable JSON."""
        last_exc: Optional[Exception] = None
        for base in INSTANCES:
            try:
                r = self._session.get(
                    f"{base}{path}", params=params, timeout=self.cfg.socket_timeout
                )
                if r.status_code != 200:
                    raise ValueError(f"HTTP {r.status_code}")
                return r.json()
            except Exception as exc:  # noqa: BLE001 - try the next instance
                last_exc = exc
                log.debug("invidious instance %s failed for %s: %s", base, path, exc)
                time.sleep(0.3)
        raise RuntimeError(f"no Invidious instance answered {path}: {last_exc}")

    # -------------------------------------------------------------- stage 1
    def search_query(self, query: str, limit: Optional[int] = None) -> List[VideoCandidate]:
        """Search one query; returns whatever the API returns."""
        limit = limit or self.cfg.max_results_per_query
        log.info("searching: %r", query)
        try:
            page1 = self._get("/api/v1/search", {"q": query, "type": "video", "page": 1})
            entries = [e for e in (page1 or []) if isinstance(e, dict) and e.get("type", "video") == "video"]
            if len(entries) < limit:  # pull a second page when the first is thin
                try:
                    page2 = self._get("/api/v1/search", {"q": query, "type": "video", "page": 2})
                    entries += [e for e in (page2 or []) if isinstance(e, dict) and e.get("type", "video") == "video"]
                except Exception:  # noqa: BLE001 - page 2 is best-effort
                    pass
        except Exception as exc:  # noqa: BLE001 - report, don't kill the run
            log.warning("search %r failed: %s", query, exc)
            return []
        out: List[VideoCandidate] = []
        for entry in entries[:limit]:
            try:
                cand = VideoCandidate.from_invidious_entry(entry)
            except Exception as exc:  # noqa: BLE001
                log.warning("skipping unparseable entry: %s", exc)
                continue
            if cand.video_id:
                out.append(cand)
        return out

    # -------------------------------------------------------------- stage 2
    def fetch_details(self, video_id: str) -> Optional[VideoCandidate]:
        """Detail fetch for one video (likes, upload date, resolution)."""
        try:
            info = self._get(f"/api/v1/videos/{video_id}")
        except Exception as exc:  # noqa: BLE001
            log.warning("detail fetch for %s failed: %s", video_id, exc)
            return None
        if not info or not info.get("videoId"):
            return None
        return VideoCandidate.from_invidious_entry(info)

    def gather(self, queries: Optional[List[str]] = None) -> List[VideoCandidate]:
        """Full two-stage candidate gathering.

        Returns candidates that survive the hard filters, with full metadata
        for the strongest of them.
        """
        queries = queries or self.cfg.search_queries
        seen: Dict[str, VideoCandidate] = {}
        for q in queries:
            for cand in self.search_query(q):
                if cand.video_id not in seen:
                    seen[cand.video_id] = cand

        # Coarse pass with flat metadata (likes/date unknown yet - fine,
        # passes_hard_filters only gates on what it has).
        coarse = [c for c in seen.values() if passes_hard_filters(c, self.cfg)[0]]
        log.info("coarse candidates after hard filters: %d", len(coarse))

        # Rank by views, then duration, to pick who gets a detail fetch.
        coarse.sort(key=lambda c: (-(c.view_count or 0), -(c.duration or 0)))
        finalists: List[VideoCandidate] = []
        for cand in coarse[: self.cfg.detail_fetch_limit]:
            detail = self.fetch_details(cand.video_id) or cand
            ok, reason = passes_hard_filters(detail, self.cfg)
            if ok:
                finalists.append(detail)
            else:
                log.info("dropping %s after detail fetch: %s", cand.video_id, reason)
        return finalists


__all__ = ["VideoSearcher"]
