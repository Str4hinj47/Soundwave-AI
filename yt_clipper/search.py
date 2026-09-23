"""YouTube discovery via yt-dlp, scoped to the source channel (Orbital NCG).

Stages:
  1. List uploads from `channel_url` (@OrbitalNCG/videos) - primary source.
  2. Open search only as a fallback, filtered back to that channel.
  3. Detail fetch for the strongest coarse candidates - adds like counts,
     upload date and resolution, which the quality scorer needs.
"""
from __future__ import annotations

import logging
from typing import Dict, List, Optional

import yt_dlp

from .config import ClippingConfig
from .models import VideoCandidate
from .quality import passes_hard_filters

log = logging.getLogger(__name__)

_FLAT_OPTS = {
    "quiet": True,
    "no_warnings": True,
    "skip_download": True,
    "extract_flat": "in_playlist",
    "noplaylist": True,
}

_DETAIL_OPTS = {
    "quiet": True,
    "no_warnings": True,
    "skip_download": True,
    "noplaylist": True,
}


class VideoSearcher:
    def __init__(self, cfg: ClippingConfig):
        self.cfg = cfg

    def _ydl_opts(self, base: Dict, extra: Optional[Dict] = None) -> Dict:
        opts = dict(base)
        opts["socket_timeout"] = self.cfg.socket_timeout
        opts["retries"] = self.cfg.retries
        if self.cfg.cookies_file:
            opts["cookiefile"] = self.cfg.cookies_file
        if extra:
            opts.update(extra)
        return opts

    def search_query(self, query: str, limit: Optional[int] = None) -> List[VideoCandidate]:
        """Flat-search one query; returns whatever YouTube returns."""
        limit = limit or self.cfg.max_results_per_query
        url = f"ytsearch{limit}:{query}"
        log.info("searching: %r", query)
        try:
            with yt_dlp.YoutubeDL(self._ydl_opts(_FLAT_OPTS)) as ydl:
                info = ydl.extract_info(url, download=False)
        except Exception as exc:  # noqa: BLE001 - report, don't kill the run
            log.warning("search %r failed: %s", query, exc)
            return []
        entries = (info or {}).get("entries") or []
        out = []
        for entry in entries:
            try:
                cand = VideoCandidate.from_ytdlp_entry(entry)
            except Exception as exc:  # noqa: BLE001
                log.warning("skipping unparseable entry: %s", exc)
                continue
            if cand.video_id:
                out.append(cand)
        return out

    def fetch_details(self, video_id: str) -> Optional[VideoCandidate]:
        """Full extract for one video (likes, upload date, resolution)."""
        url = f"https://www.youtube.com/watch?v={video_id}"
        try:
            with yt_dlp.YoutubeDL(self._ydl_opts(_DETAIL_OPTS)) as ydl:
                info = ydl.extract_info(url, download=False)
        except Exception as exc:  # noqa: BLE001
            log.warning("detail fetch for %s failed: %s", video_id, exc)
            return None
        if not info or not info.get("id"):
            return None
        return VideoCandidate.from_ytdlp_entry(info)

    def search_channel(self, channel_url: Optional[str] = None, limit: Optional[int] = None) -> List[VideoCandidate]:
        """List uploads from the configured source channel (Orbital NCG)."""
        url = (channel_url if channel_url is not None else self.cfg.channel_url) or ""
        if not url:
            return []
        limit = limit or max(self.cfg.max_results_per_query, 25)
        opts = dict(_FLAT_OPTS)
        opts["playlistend"] = limit
        log.info("listing channel uploads: %s", url)
        try:
            with yt_dlp.YoutubeDL(self._ydl_opts(opts)) as ydl:
                info = ydl.extract_info(url, download=False)
        except Exception as exc:  # noqa: BLE001 - report, don't kill the run
            log.warning("channel listing %s failed: %s", url, exc)
            return []
        entries = (info or {}).get("entries") or []
        out = []
        for entry in entries:
            if not entry:
                continue
            try:
                cand = VideoCandidate.from_ytdlp_entry(entry)
            except Exception as exc:  # noqa: BLE001
                log.warning("skipping unparseable channel entry: %s", exc)
                continue
            if cand.video_id:
                # Flat channel entries sometimes omit the watch URL — normalise it.
                if not cand.url or "watch?v=" not in cand.url:
                    cand.url = f"https://www.youtube.com/watch?v={cand.video_id}"
                out.append(cand)
        return out

    @staticmethod
    def _channel_hint(channel_url: Optional[str]) -> Optional[str]:
        """Pull the @handle (or channel id) out of a channel URL for filtering."""
        if not channel_url:
            return None
        for marker in ("youtube.com/@", "youtu.be/@"):
            if marker in channel_url:
                handle = channel_url.split(marker, 1)[1]
                for sep in ("/", "?", "&", "#"):
                    handle = handle.split(sep, 1)[0]
                return "@" + handle.lower()
        for marker in ("youtube.com/channel/", "youtube.com/c/"):
            if marker in channel_url:
                slug = channel_url.split(marker, 1)[1]
                for sep in ("/", "?", "&", "#"):
                    slug = slug.split(sep, 1)[0]
                return slug.lower()
        return None

    def _belongs_to_source_channel(self, cand: VideoCandidate) -> bool:
        """Keep only videos from the configured source channel once known."""
        hint = self._channel_hint(self.cfg.channel_url)
        if not hint:
            return True
        # Flat listings often lack uploader metadata — accept and verify later.
        if not cand.channel:
            return True
        ch = cand.channel.lower()
        if hint.startswith("@"):
            # "@orbitalncg" handle or "orbital - no copyright gameplay" title
            return hint[1:] in ch.replace(" ", "") or "orbital" in ch
        return hint in ch.replace(" ", "")

    def gather(self, queries: Optional[List[str]] = None) -> List[VideoCandidate]:
        """Full candidate gathering, scoped to the source channel.

        1. List uploads from `channel_url` (Orbital NCG).
        2. Fall back to open search only if needed — results are then
           filtered to that same channel.

        Returns candidates that survive the hard filters, with full metadata
        for the strongest of them.
        """
        queries = queries or self.cfg.search_queries
        seen: Dict[str, VideoCandidate] = {}

        for cand in self.search_channel():
            if cand.video_id not in seen and self._belongs_to_source_channel(cand):
                seen[cand.video_id] = cand

        if not seen:
            log.info("channel listing empty/unavailable; falling back to open search (channel-filtered)")
            for q in queries:
                for cand in self.search_query(q):
                    if cand.video_id not in seen:
                        seen[cand.video_id] = cand

        # Flat listings can omit duration — hydrate a bounded batch before
        # hard filters so channel uploads aren't dropped as "duration unknown".
        missing = [vid for vid, c in seen.items() if c.duration is None][: self.cfg.detail_fetch_limit]
        for vid in missing:
            detail = self.fetch_details(vid)
            if detail:
                seen[vid] = detail

        # Coarse pass with flat metadata (likes/date unknown yet - fine,
        # passes_hard_filters only gates on what it has).
        coarse = [c for c in seen.values() if self._belongs_to_source_channel(c) and passes_hard_filters(c, self.cfg)[0]]
        log.info("coarse candidates after hard filters: %d", len(coarse))

        # Rank by views, then duration, to pick who gets a detail fetch.
        coarse.sort(key=lambda c: (-(c.view_count or 0), -(c.duration or 0)))
        finalists: List[VideoCandidate] = []
        for cand in coarse[: self.cfg.detail_fetch_limit]:
            detail = self.fetch_details(cand.video_id) or cand
            if not self._belongs_to_source_channel(detail):
                log.info("dropping %s: not from source channel", cand.video_id)
                continue
            ok, reason = passes_hard_filters(detail, self.cfg)
            if not ok:
                log.info("dropping %s: %s", cand.video_id, reason)
                continue
            finalists.append(detail)
        return finalists


__all__ = ["VideoSearcher"]
