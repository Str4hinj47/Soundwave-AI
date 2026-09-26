"""Data models shared across the plugin."""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional


@dataclass
class VideoCandidate:
    """A YouTube video that may be worth clipping."""

    video_id: str
    title: str
    url: str
    duration: Optional[float] = None          # seconds
    view_count: Optional[int] = None
    like_count: Optional[int] = None
    upload_date: Optional[str] = None          # "YYYYMMDD"
    channel: Optional[str] = None
    channel_follower_count: Optional[int] = None
    max_height: Optional[int] = None           # best available height in pixels
    extra: Dict[str, Any] = field(default_factory=dict)

    @property
    def like_ratio(self) -> Optional[float]:
        if self.like_count is not None and self.view_count:
            return self.like_count / self.view_count
        return None

    @classmethod
    def from_invidious_entry(cls, entry: Dict[str, Any]) -> "VideoCandidate":
        """Build a candidate from an Invidious API search entry or video dict.

        Search entries carry id/title/duration/views only; the per-video
        detail fetch adds like counts, publish date and available resolutions.
        """
        import datetime as _dt

        video_id = str(entry.get("videoId") or entry.get("id") or "")
        max_height: Optional[int] = None
        for fmt in entry.get("adaptiveFormats") or []:
            res = str(fmt.get("resolution") or "").rstrip("p")
            if res.isdigit():
                max_height = max(max_height or 0, int(res))
            else:
                size = str(fmt.get("size") or "")
                if "x" in size:
                    try:
                        max_height = max(max_height or 0, int(size.split("x")[1]))
                    except (ValueError, IndexError):
                        pass
        upload_date = None
        published = _as_int(entry.get("published"))
        if published:
            upload_date = _dt.datetime.fromtimestamp(published, tz=_dt.timezone.utc).strftime("%Y%m%d")
        return cls(
            video_id=video_id,
            title=str(entry.get("title") or ""),
            url=str(entry.get("url") or (f"https://www.youtube.com/watch?v={video_id}" if video_id else "")),
            duration=_as_float(entry.get("lengthSeconds") if entry.get("lengthSeconds") is not None else entry.get("duration")),
            view_count=_as_int(entry.get("viewCount") if entry.get("viewCount") is not None else entry.get("view_count")),
            like_count=_as_int(entry.get("likeCount") if entry.get("likeCount") is not None else entry.get("like_count")),
            upload_date=upload_date,
            channel=entry.get("author") or entry.get("channel") or None,
            channel_follower_count=_as_int(entry.get("subCountText") if isinstance(entry.get("subCountText"), int) else None),
            max_height=max_height,
            extra={"resolution": entry.get("resolution")},
        )

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data["like_ratio"] = self.like_ratio
        data.pop("extra", None)
        return data


def _as_float(value: Any) -> Optional[float]:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _as_int(value: Any) -> Optional[int]:
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


@dataclass
class ClipInfo:
    """One produced 60s clip."""

    file: str                 # absolute or workspace-relative path
    source_id: str
    source_title: str
    index: int                # 1-based position in the source video
    start: float              # seconds
    end: float                # seconds
    duration: float           # seconds

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class PipelineResult:
    """Outcome of a full find->download->clip run."""

    sources: List[Dict[str, Any]] = field(default_factory=list)
    clips: List[Dict[str, Any]] = field(default_factory=list)
    manifest_path: Optional[str] = None
    errors: List[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return bool(self.clips) and not self.errors

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
