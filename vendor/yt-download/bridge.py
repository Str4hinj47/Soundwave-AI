#!/usr/bin/env python3
"""
bridge.py — JSON bridge between Soundwave AI (Node.js server, yt_clipper)
and the vendored yt-download Innertube engine.

Subcommands:

  info <url> [--proxy P]
      One JSON object on stdout:
      {"id","title","duration","url","channel","thumbnail"}

  download <url> [-q QUALITY] -o OUTDIR --basename NAME
                 [--proxy P] [--ffmpeg PATH] [--start SEC] [--end SEC]
      Progress lines on stderr ("PROGRESS <pct>"), one final JSON object
      on stdout: {"file","ext","size"}

      --start/--end enable section mode: only that time range is fetched
      (ffmpeg reads the stream URLs with ranged seeks — the equivalent of
      yt-dlp's --download-sections), which keeps background-footage grabs
      fast. Falls back to a full engine download + local trim when the
      direct ranged fetch is refused.

Errors are printed to stderr as "ERROR: <message>" with exit code 1, so the
Node wrapper can surface a clean, user-facing message.

This module is also importable — yt_clipper uses download_to() directly.
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # allow `engine` import

from engine import innertube as yt  # noqa: E402


# ----------------------------------------------------------------- helpers

def _emit_progress(pct: float) -> None:
    pct = max(0.0, min(99.0, pct))
    sys.stderr.write(f"PROGRESS {pct:.1f}\n")
    sys.stderr.flush()


def _ffmpeg_exe(override: str | None) -> str:
    if override:
        return override
    exe = shutil.which("ffmpeg")
    if not exe:
        raise yt.YouTubeError(
            "ffmpeg is not installed — needed to combine video+audio or cut sections.")
    return exe


def _run_ffmpeg(args: list[str], exe: str, progress_total: float | None = None) -> None:
    """Run ffmpeg, optionally translating -progress output into PROGRESS lines."""
    cmd = [exe, "-y", "-loglevel", "error"]
    if progress_total:
        cmd += ["-nostats", "-progress", "pipe:2"]
    cmd += args
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL,
                            stderr=subprocess.PIPE, text=True)
    assert proc.stderr is not None
    err_lines: list[str] = []
    for line in proc.stderr:
        line = line.strip()
        if progress_total and line.startswith("out_time_us="):
            try:
                us = int(line.split("=", 1)[1])
                _emit_progress(us / 1_000_000 / progress_total * 100)
            except ValueError:
                pass
        elif line:
            err_lines.append(line)
    proc.wait()
    if proc.returncode != 0:
        tail = "; ".join(err_lines[-3:])[:300] or "unknown ffmpeg error"
        raise yt.YouTubeError(f"ffmpeg failed: {tail}")


# ------------------------------------------------------------ core download

def download_to(url_or_id: str, quality: str, out_dir: Path, basename: str,
                proxy: str | None = None, ffmpeg: str | None = None,
                start: float | None = None, end: float | None = None,
                on_progress=None) -> Path:
    """Download `url_or_id` into `out_dir/<basename>.<ext>` and return the path.

    With start/end set, fetches only that section (ranged ffmpeg read of the
    stream URLs, full-download + local trim as fallback).
    """
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    info = yt.get_info(url_or_id, proxy)
    q = (quality or "1080").strip().lower()
    if q not in ("best", "audio") and not q.isdigit():
        q = "1080"
    streams, mode = yt._pick_streams(info, q)

    section = start is not None or end is not None
    ffmpeg_exe = _ffmpeg_exe(ffmpeg) if section else ffmpeg

    start_s = float(start or 0.0)
    dur_s = (float(end) - start_s) if end is not None else None

    if section:
        try:
            return _section_from_urls(streams, mode, out_dir, basename,
                                      ffmpeg_exe, start_s, dur_s, on_progress)
        except yt.YouTubeError as e:
            sys.stderr.write(f"section fetch failed ({e}); full download + trim fallback\n")
            full = _full_download(url_or_id, streams, mode, info, out_dir,
                                  f".tmp_{basename}", proxy, ffmpeg_exe, on_progress)
            return _trim_local(full, streams, mode, out_dir, basename,
                               ffmpeg_exe, start_s, dur_s, on_progress)
    return _full_download(url_or_id, streams, mode, info, out_dir,
                          basename, proxy, ffmpeg_exe, on_progress)


def _section_from_urls(streams: list[dict], mode: str, out_dir: Path,
                       basename: str, ffmpeg_exe: str, start_s: float,
                       dur_s: float | None, on_progress) -> Path:
    """yt-dlp --download-sections equivalent: ranged ffmpeg read of stream URLs."""
    dur = dur_s if dur_s and dur_s > 0 else None
    seek = ["-ss", f"{start_s:.3f}"]
    span = ["-t", f"{dur:.3f}"] if dur else []

    inputs: list[str] = []
    for f in streams:
        inputs += seek + span + ["-i", f["url"]]

    if mode == "audio" or len(streams) == 1:
        f = streams[0]
        if f["audio_only"]:
            ext = "m4a" if f["container"] == "mp4" else (f["container"] or "webm")
            out = out_dir / f"{basename}.{ext}"
            _run_ffmpeg(inputs + ["-vn", "-c:a", "copy", "-movflags", "+faststart", str(out)],
                        ffmpeg_exe, dur)
        else:
            ext = f["container"] or "mp4"
            out = out_dir / f"{basename}.{ext}"
            _run_ffmpeg(inputs + ["-c", "copy", "-movflags", "+faststart",
                                  "-avoid_negative_ts", "make_zero", str(out)],
                        ffmpeg_exe, dur)
    else:
        ext = yt._container_for(streams[0], streams[1])
        out = out_dir / f"{basename}.{ext}"
        _run_ffmpeg(inputs + ["-map", "0:v:0", "-map", "1:a:0", "-c", "copy",
                              "-movflags", "+faststart", "-avoid_negative_ts", "make_zero",
                              str(out)], ffmpeg_exe, dur)

    if not out.exists() or out.stat().st_size < 100_000:
        raise yt.YouTubeError("section fetch produced an empty file")
    (on_progress or (lambda *a: None))(1, 1, None)
    return out


def _full_download(url_or_id: str, streams: list[dict], mode: str, info: dict,
                   out_dir: Path, basename: str, proxy: str | None,
                   ffmpeg_exe: str | None, on_progress) -> Path:
    """Download the picked streams with the engine's parallel ranged workers."""
    emit = on_progress or (lambda *a: None)
    total = sum(f["size"] or 0 for f in streams) or None
    counter, lock = [0], threading.Lock()
    stop = threading.Event()
    last = {"t": time.time(), "b": 0}

    def cb(done):
        now = time.time()
        dt = now - last["t"]
        speed = (done - last["b"]) / dt if dt > 0.4 else None
        if speed is not None:
            last.update(t=now, b=done)
        emit(done, total, speed)

    tmp = out_dir / f".parts_{basename}"
    tmp.mkdir(exist_ok=True)
    try:
        paths = []
        for i, f in enumerate(streams):
            dest = tmp / f"stream{i}.{f['container'] or 'bin'}"
            yt._download_stream(yt._make_provider(url_or_id, f, proxy), dest,
                                f["size"], proxy, counter, lock, cb, stop)
            paths.append(dest)

        exe = _ffmpeg_exe(ffmpeg_exe)
        if mode == "audio":
            ext = "mp3"
            out = out_dir / f"{basename}.{ext}"
            _run_ffmpeg(["-i", str(paths[0]), "-vn", "-acodec", "libmp3lame", "-q:a", "0", str(out)], exe)
        elif mode == "mux" and len(paths) == 2:
            ext = yt._container_for(streams[0], streams[1])
            out = out_dir / f"{basename}.{ext}"
            _run_ffmpeg(["-i", str(paths[0]), "-i", str(paths[1]),
                         "-c", "copy", "-movflags", "+faststart", str(out)], exe)
        else:
            ext = streams[0]["container"] or "mp4"
            out = out_dir / f"{basename}.{ext}"
            paths[0].rename(out)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    return out


def _trim_local(full: Path, streams: list[dict], mode: str, out_dir: Path,
                basename: str, ffmpeg_exe: str, start_s: float,
                dur_s: float | None, on_progress) -> Path:
    dur = dur_s if dur_s and dur_s > 0 else None
    out = out_dir / f"{basename}{full.suffix}"
    _run_ffmpeg(["-ss", f"{start_s:.3f}", "-i", str(full)]
                + (["-t", f"{dur:.3f}"] if dur else [])
                + ["-c", "copy", "-movflags", "+faststart",
                   "-avoid_negative_ts", "make_zero", str(out)],
                ffmpeg_exe, dur)
    full.unlink(missing_ok=True)
    (on_progress or (lambda *a: None))(1, 1, None)
    return out


# ------------------------------------------------------------------- CLI

def _cmd_info(args) -> int:
    info = yt.get_info(args.url, args.proxy)
    print(json.dumps({
        "id": info["id"],
        "title": info["title"],
        "duration": info["duration"] or 0,
        "url": f"https://www.youtube.com/watch?v={info['id']}",
        "channel": info["channel"],
        "thumbnail": info["thumbnail"],
    }))
    return 0


def _cmd_download(args) -> int:
    def on_progress(done, total, speed):
        _emit_progress(done / total * 100 if total else 0.0)

    out = download_to(args.url, args.quality, Path(args.output), args.basename,
                      proxy=args.proxy, ffmpeg=args.ffmpeg,
                      start=args.start, end=args.end, on_progress=on_progress)
    size = out.stat().st_size
    _emit_progress(100.0)
    print(json.dumps({"file": out.name, "ext": out.suffix.lstrip("."), "size": size}))
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Soundwave ↔ yt-download engine bridge")
    sub = p.add_subparsers(dest="cmd", required=True)

    pi = sub.add_parser("info", help="print metadata JSON")
    pi.add_argument("url")
    pi.add_argument("--proxy", default=None)
    pi.set_defaults(fn=_cmd_info)

    pd = sub.add_parser("download", help="download a video / section")
    pd.add_argument("url")
    pd.add_argument("-q", "--quality", default="1080",
                    help="best | max height in px (2160, 1080, 720, …) | audio")
    pd.add_argument("-o", "--output", default=".")
    pd.add_argument("--basename", required=True)
    pd.add_argument("--proxy", default=None)
    pd.add_argument("--ffmpeg", default=None)
    pd.add_argument("--start", type=float, default=None)
    pd.add_argument("--end", type=float, default=None)
    pd.set_defaults(fn=_cmd_download)

    args = p.parse_args(argv)
    try:
        return args.fn(args)
    except yt.YouTubeError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 1
    except Exception as e:  # noqa: BLE001
        print(f"ERROR: unexpected failure: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
