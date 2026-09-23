"""Exercises the REAL agent-side clip library (cache_manager.py).

YouTube is unreachable in CI, so the download step is simulated by placing a
real synthetic long video where the downloader would put it and recording it in
state.json. Everything after that — ffmpeg slicing, clip deletion, state
persistence, source retirement, URL memory — is the production code path.

Run:  python3 -m unittest discover -s soundwave-agent/tests -v
"""

import importlib.util
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

AGENT_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = AGENT_DIR.parent
FFMPEG = REPO_ROOT / "vendor" / "ffmpeg" / "ffmpeg"

# Small batch + tiny clips so a short synthetic source proves multi-batch slicing.
WORKDIR = Path(tempfile.mkdtemp(prefix="sw-clips-py-"))
os.environ["DATA_DIR"] = str(WORKDIR / "data")
os.environ["BACKGROUND_CLIP_BATCH"] = "2"
# The lifecycle below SIMULATES a download with a synthetic testsrc source,
# so the real-footage gate (which exists precisely to reject such footage)
# is disabled here and covered by its own dedicated test below.
os.environ["BACKGROUND_FOOTAGE_CHECK"] = "false"

_spec = importlib.util.spec_from_file_location("cache_manager", AGENT_DIR / "cache_manager.py")
cm = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(cm)

SOURCE_ID = "PYSRC0003"
SOURCE_URL = f"https://www.youtube.com/watch?v={SOURCE_ID}"
SOURCE_SECS = 150


class TestClipLibrary(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cm.reset_library()
        src_dir = cm.get_cache_root() / "sources"
        src_dir.mkdir(parents=True, exist_ok=True)
        cm.get_cache_dir().mkdir(parents=True, exist_ok=True)

        cls.source_file = src_dir / f"source_{SOURCE_ID}.mp4"
        r = subprocess.run(
            [str(FFMPEG), "-y", "-f", "lavfi",
             "-i", f"testsrc=size=64x64:rate=10:duration={SOURCE_SECS}",
             "-c:v", "libx264", "-preset", "ultrafast", "-g", "10",
             "-pix_fmt", "yuv420p", str(cls.source_file)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
        assert r.returncode == 0, r.stderr.decode()[-400:]
        assert cls.source_file.stat().st_size > 100_000

    def setUp(self):
        """Re-seed state before every test.

        unittest runs tests alphabetically, so a test that deliberately
        corrupts or clears the state file would otherwise leak into the next.
        """
        for f in cm.get_cache_dir().glob("*.mp4"):
            f.unlink(missing_ok=True)
        # Exactly what download_source() persists after a real download.
        cm.save_state({
            "version": 1,
            "source": {"url": SOURCE_URL, "video_id": SOURCE_ID, "path": str(self.source_file),
                       "duration": float(SOURCE_SECS), "consumed": 0.0, "acquired_at": 0},
            "queue": [], "used_urls": [], "last_used_url": None,
            "clips_delivered": 0, "sources_consumed": 0,
        })

    @classmethod
    def tearDownClass(cls):
        cm.reset_library()
        shutil.rmtree(WORKDIR, ignore_errors=True)

    def test_lifecycle_slice_serve_delete_exhaust_retire(self):
        # acquire #1 — empty library, so the source is sliced into a batch
        a = cm.acquire_clip()
        self.assertIsNotNone(a)
        self.assertTrue(a.exists())
        st = cm.load_state()
        self.assertEqual(len(st["queue"]), 1)
        self.assertEqual(st["clips_delivered"], 1)
        self.assertEqual(st["source"]["consumed"], 2 * cm.CLIP_DURATION)
        cm.release_clip(a)
        self.assertFalse(a.exists(), "used clip must be deleted")

        # acquire #2 — straight off the queue, no re-slicing
        b = cm.acquire_clip()
        self.assertIsNotNone(b)
        self.assertNotEqual(b.name, a.name)
        self.assertTrue(b.exists())
        self.assertEqual(cm.load_state()["source"]["consumed"], 2 * cm.CLIP_DURATION)
        self.assertEqual(cm.load_state()["queue"], [])
        cm.release_clip(b)
        self.assertFalse(b.exists(), "used clip must be deleted")

        # acquire #3 — queue drained, so the tail of the source is cut
        c = cm.acquire_clip()
        self.assertIsNotNone(c)
        self.assertTrue(c.exists())

        st = cm.load_state()
        self.assertFalse(self.source_file.exists(), "exhausted source file must be deleted")
        self.assertIsNone(st["source"])
        self.assertIn(SOURCE_ID, st["used_urls"])  # ← the link is remembered
        self.assertEqual(st["last_used_url"], SOURCE_URL)
        self.assertEqual(st["sources_consumed"], 1)
        cm.release_clip(c)

    def test_used_source_is_never_offered_again(self):
        urls = cm.discover_urls([SOURCE_ID])
        ids = [cm.video_id(u) for u in urls]
        self.assertNotIn(SOURCE_ID, ids)
        self.assertTrue(len(urls) > 0)
        for u in urls:
            self.assertFalse(cm.is_blacklisted(u))

    def test_blacklist_is_case_insensitive(self):
        self.assertTrue(cm.is_blacklisted("https://youtube.com/watch?v=dQw4w9WgXcQ"))
        self.assertTrue(cm.is_blacklisted("https://youtu.be/nj1vd4eccd0"))
        self.assertFalse(cm.is_blacklisted("https://youtube.com/watch?v=71YeZAUS9NQ"))

    def test_corrupt_state_file_recovers(self):
        cm._state_file().parent.mkdir(parents=True, exist_ok=True)
        cm._state_file().write_text("{not json", encoding="utf-8")
        st = cm.load_state()
        self.assertEqual(st["queue"], [])
        self.assertIsNone(st["source"])
        self.assertEqual(st["used_urls"], [])

    def test_missing_clips_are_pruned_from_queue(self):
        cm.save_state({"version": 1, "source": None, "queue": ["clip_ghost_000.mp4"],
                       "used_urls": [], "last_used_url": None,
                       "clips_delivered": 0, "sources_consumed": 0})
        self.assertFalse((cm.get_cache_dir() / "clip_ghost_000.mp4").exists())
        self.assertEqual(cm.get_status()["clips_ready"], 0)

    def test_clip_length_matches_server(self):
        """The agent and the server must agree on 60s clips to share a library."""
        self.assertEqual(cm.CLIP_DURATION, 60)
        self.assertEqual(cm.get_cache_dir().name, "60s")


class TestFootageGate(unittest.TestCase):
    """The gate that stopped the SMPTE test pattern from being served as
    'minecraft parkour' — verify_footage() runs unconditionally."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp(prefix="sw-footage-py-"))
        cls.pattern_file = cls.tmp / "pattern.mp4"
        cls.solid_file = cls.tmp / "solid.mp4"
        cls.real_file = cls.tmp / "real.mp4"
        r = subprocess.run(
            [str(FFMPEG), "-y", "-f", "lavfi",
             "-i", "testsrc=size=320x180:rate=10:duration=6",
             "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
             str(cls.pattern_file)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
        assert r.returncode == 0, r.stderr.decode()[-400:]
        r = subprocess.run(
            [str(FFMPEG), "-y", "-f", "lavfi",
             "-i", "color=c=0x070d18:s=320x180:d=6:r=10",
             "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
             str(cls.solid_file)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
        assert r.returncode == 0, r.stderr.decode()[-400:]
        # Real-footage stand-in: flat sky + blocky textured terrain (a 3D
        # scene has no long flat colour profile with sharp boundaries).
        cls.ground_file = cls.tmp / "ground.mp4"
        r = subprocess.run(
            [str(FFMPEG), "-y", "-t", "6", "-f", "lavfi",
             "-i", "mandelbrot=s=40x30:rate=10",
             "-vf", "scale=320x80:flags=neighbor",
             "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
             str(cls.ground_file)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
        assert r.returncode == 0, r.stderr.decode()[-400:]
        r = subprocess.run(
            [str(FFMPEG), "-y",
             "-f", "lavfi", "-i", "color=c=0x79A6FF:s=320x180:d=6:r=10",
             "-i", str(cls.ground_file),
             "-filter_complex",
             "[0][1]overlay=0:100,drawbox=x=50:y=120:w=40:h=40:color=0x8B5A2B:t=fill,drawbox=x=200:y=140:w=48:h=32:color=0x6E6E6E:t=fill",
             "-t", "6", "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
             str(cls.real_file)],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        )
        assert r.returncode == 0, r.stderr.decode()[-400:]

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def test_rejects_color_bar_test_pattern(self):
        ok, reason = cm.verify_footage(str(FFMPEG), self.pattern_file)
        self.assertFalse(ok)
        self.assertRegex(reason, r"test pattern")

    def test_rejects_solid_blank_footage(self):
        ok, reason = cm.verify_footage(str(FFMPEG), self.solid_file)
        self.assertFalse(ok)
        self.assertRegex(reason, r"solid|blank")

    def test_accepts_real_footage(self):
        ok, reason = cm.verify_footage(str(FFMPEG), self.real_file)
        self.assertTrue(ok, reason)


if __name__ == "__main__":
    unittest.main()
