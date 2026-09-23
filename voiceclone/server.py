#!/usr/bin/env python3
"""
OmniVoice sidecar for Soundwave AI.

Loads the OmniVoice voice-cloning model once and exposes a small JSON API the
Node backend proxies to:

    GET  /health                  → { ok, model_loaded, device, mock }
    GET  /profiles                → saved cloned voices
    POST /profiles                → create a cloned voice from a reference clip
                                    (multipart: file + name + optional refText)
    DELETE /profiles/{id}         → remove a cloned voice
    POST /clone                   → { text, profileId, speed?, numStep? } → WAV
                                    (+ X-Audio-Duration header, seconds)

Set OMNIVOICE_MOCK=1 to run without the model (sine-wave output) — used for
development/testing the plumbing without downloading multi-GB weights.
"""

import io
import json
import math
import os
import secrets
import threading
import time
import uuid
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

# ── Config ───────────────────────────────────────────────────────────────────
MODEL_NAME = os.environ.get("OMNIVOICE_MODEL", "k2-fsa/OmniVoice")
DEVICE = os.environ.get("OMNIVOICE_DEVICE", "cpu")  # cpu | cuda:0 | mps | xpu
DTYPE = os.environ.get("OMNIVOICE_DTYPE", "float16" if DEVICE != "cpu" else "float32")
MOCK = os.environ.get("OMNIVOICE_MOCK", "").lower() in ("1", "true", "yes")
SAMPLE_RATE = 24_000

PROFILES_DIR = Path(os.environ.get("VOICECLONE_PROFILES_DIR", Path(__file__).parent / "profiles"))
PROFILES_DIR.mkdir(parents=True, exist_ok=True)
INDEX_PATH = PROFILES_DIR / "index.json"

# ── Model (loaded once at startup) ───────────────────────────────────────────
model = None
model_lock = threading.Lock()

if not MOCK:
    print(f"[voiceclone] loading OmniVoice model {MODEL_NAME} on {DEVICE} ({DTYPE}) — this can take a minute…", flush=True)
    try:
        import torch

        from omnivoice import OmniVoice

        dtype = getattr(torch, DTYPE.replace("torch.", ""), torch.float32)
        model = OmniVoice.from_pretrained(MODEL_NAME, device_map=DEVICE, dtype=dtype)
        print("[voiceclone] model ready", flush=True)
    except Exception as e:  # noqa: BLE001 — surface a clean startup failure
        print(f"[voiceclone] FATAL: failed to load OmniVoice: {e}", flush=True)
        raise


def _build_prompt(ref_path: Path, ref_text: str | None):
    """Create a VoiceClonePrompt from a reference clip (Whisper ASR when no transcript)."""
    with model_lock:
        return model.create_voice_clone_prompt(
            ref_audio=str(ref_path),
            **({"ref_text": ref_text} if ref_text and ref_text.strip() else {}),
        )


def _render(req: "CloneRequest", prompt) -> "tuple[bytes, float]":
    kwargs: dict = {"voice_clone_prompt": prompt}
    if req.speed is not None:
        kwargs["speed"] = req.speed
    if req.numStep is not None:
        kwargs["num_step"] = req.numStep
    try:
        with model_lock:
            audio = model.generate(text=req.text, **kwargs)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"Generation failed: {e}") from e
    samples = audio[0]
    duration = len(samples) / SAMPLE_RATE
    buf = io.BytesIO()
    import soundfile as sf

    sf.write(buf, samples, SAMPLE_RATE, format="WAV", subtype="PCM_16")
    return buf.getvalue(), duration


# ── API-token guard (set VOICECLONE_TOKEN when the service is on a public URL) ─
API_TOKEN = os.environ.get("VOICECLONE_TOKEN", "").strip()


def require_token(authorization: str | None = Header(default=None)) -> None:
    if not API_TOKEN:
        return  # no token configured → local/trusted-network mode
    prefix = "bearer "
    token = authorization[len(prefix):] if authorization and authorization.lower().startswith(prefix) else None
    if not token or not secrets.compare_digest(token, API_TOKEN):
        raise HTTPException(401, "Invalid or missing bearer token.")

# ── Profile index ────────────────────────────────────────────────────────────
index_lock = threading.Lock()


def _read_index() -> list[dict]:
    with index_lock:
        if not INDEX_PATH.exists():
            return []
        try:
            return json.loads(INDEX_PATH.read_text(encoding="utf-8"))
        except Exception:
            return []


def _write_index(items: list[dict]) -> None:
    with index_lock:
        INDEX_PATH.write_text(json.dumps(items, indent=2), encoding="utf-8")


def _get_profile(profile_id: str) -> dict | None:
    if not profile_id or any(c not in "0123456789abcdef-" for c in profile_id):
        return None
    return next((p for p in _read_index() if p["id"] == profile_id), None)


# ── App ──────────────────────────────────────────────────────────────────────
app = FastAPI(title="Soundwave AI voice-clone sidecar", docs_url=None, redoc_url=None)


@app.get("/health")
def health() -> dict:
    return {"ok": True, "model_loaded": MOCK or model is not None, "device": "mock" if MOCK else DEVICE, "mock": MOCK}


@app.get("/profiles", dependencies=[Depends(require_token)])
def list_profiles() -> list[dict]:
    return [
        {"id": p["id"], "name": p["name"], "createdAt": p["createdAt"], "hasRefText": bool(p.get("refText"))}
        for p in _read_index()
    ]


@app.post("/profiles", status_code=201, dependencies=[Depends(require_token)])
async def create_profile(
    file: UploadFile = File(...),
    name: str = Form(...),
    refText: str | None = Form(None),
) -> dict:
    name = name.strip()[:80]
    if not name:
        raise HTTPException(400, "A voice name is required.")
    data = await file.read()
    if len(data) < 1000:
        raise HTTPException(400, "The reference clip is too small — use 3–10 seconds of clean speech.")
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(400, "The reference clip is too large (max 25 MB).")

    profile_id = str(uuid.uuid4())
    ref_path = PROFILES_DIR / f"{profile_id}.ref{_ext_for(file.filename)}"
    prompt_path = PROFILES_DIR / f"{profile_id}.pt"
    ref_path.write_bytes(data)

    if MOCK:
        prompt_path.write_bytes(b"mock-prompt")
    else:
        try:
            _build_prompt(ref_path, refText).save(str(prompt_path))
        except HTTPException:
            ref_path.unlink(missing_ok=True)
            raise
        except Exception as e:  # noqa: BLE001
            ref_path.unlink(missing_ok=True)
            raise HTTPException(500, f"Failed to clone this reference clip: {e}") from e

    entry = {
        "id": profile_id,
        "name": name,
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "refText": (refText or "").strip()[:2000],
    }
    items = [p for p in _read_index() if p["id"] != profile_id]
    items.append(entry)
    _write_index(items)
    return {"id": profile_id, "name": entry["name"], "createdAt": entry["createdAt"], "hasRefText": bool(entry["refText"])}


@app.delete("/profiles/{profile_id}", dependencies=[Depends(require_token)])
def delete_profile(profile_id: str) -> dict:
    if _get_profile(profile_id) is None:
        raise HTTPException(404, "Voice profile not found.")
    _write_index([p for p in _read_index() if p["id"] != profile_id])
    for suffix in (".pt", ".ref.wav", ".ref.mp3", ".ref.flac", ".ref.ogg", ".ref.m4a"):
        (PROFILES_DIR / f"{profile_id}{suffix}").unlink(missing_ok=True)
    return {"ok": True}


class CloneRequest(BaseModel):
    text: str = Field(min_length=1, max_length=10_000)
    profileId: str = Field(min_length=1, max_length=64)
    speed: float | None = Field(default=None, ge=0.5, le=2.0)
    numStep: int | None = Field(default=None, ge=4, le=64)


@app.post("/clone", dependencies=[Depends(require_token)])
def clone(req: CloneRequest) -> Response:
    profile = _get_profile(req.profileId)
    if profile is None:
        raise HTTPException(404, "Voice profile not found — create it first via /profiles.")

    if MOCK:
        wav, duration = _mock_wav(req.text)
    else:
        from omnivoice import VoiceClonePrompt

        prompt_path = PROFILES_DIR / f"{req.profileId}.pt"
        if not prompt_path.exists():
            raise HTTPException(404, "Voice prompt file is missing — recreate this profile.")
        wav, duration = _render(req, VoiceClonePrompt.load(str(prompt_path)))
    return _wav_response(wav, duration)


# Stateless variant: the reference clip is sent inline with each request —
# no profiles stored in the sidecar. This is what the Soundwave Node API uses,
# so cloned voices are owned per-user by the API and this service can run on
# ephemeral free hosting without persistence.
@app.post("/clone/ephemeral", dependencies=[Depends(require_token)])
async def clone_ephemeral(
    file: UploadFile = File(...),
    text: str = Form(...),
    refText: str | None = Form(None),
    speed: float | None = Form(None),
    numStep: int | None = Form(None),
) -> Response:
    if not text or len(text) > 10_000:
        raise HTTPException(400, "Text is required (max 10,000 chars).")
    data = await file.read()
    if len(data) < 1000 or len(data) > 25 * 1024 * 1024:
        raise HTTPException(400, "The reference clip must be between 1 KB and 25 MB.")

    if MOCK:
        wav, duration = _mock_wav(text)
    else:
        import tempfile

        fd, tmp = tempfile.mkstemp(suffix=_ext_for(file.filename))
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(data)
            req = CloneRequest(
                text=text,
                profileId="ephemeral",
                speed=speed if speed is None else min(2.0, max(0.5, speed)),
                numStep=numStep if numStep is None else min(64, max(4, numStep)),
            )
            wav, duration = _render(req, _build_prompt(Path(tmp), refText))
        except HTTPException:
            raise
        except Exception as e:  # noqa: BLE001
            raise HTTPException(500, f"Failed to clone this reference clip: {e}") from e
        finally:
            Path(tmp).unlink(missing_ok=True)
    return _wav_response(wav, duration)


def _wav_response(wav: bytes, duration: float) -> Response:
    return Response(
        content=wav,
        media_type="audio/wav",
        headers={"X-Audio-Duration": f"{duration:.3f}", "Cache-Control": "no-store"},
    )


# ── Mock output (no model) ───────────────────────────────────────────────────
def _mock_wav(text: str) -> tuple[bytes, float]:
    import numpy as np
    import soundfile as sf

    duration = max(1.0, min(60.0, len(text.split()) / 2.6))
    n = int(duration * SAMPLE_RATE)
    t = np.arange(n) / SAMPLE_RATE
    # Two-tone warble so it obviously isn't silence.
    wave = (0.20 * np.sin(2 * math.pi * 220 * t) + 0.12 * np.sin(2 * math.pi * 330 * t)).astype("float32")
    fade = int(0.03 * SAMPLE_RATE)
    wave[:fade] *= np.linspace(0, 1, fade)
    wave[-fade:] *= np.linspace(1, 0, fade)
    buf = io.BytesIO()
    sf.write(buf, wave, SAMPLE_RATE, format="WAV", subtype="PCM_16")
    return buf.getvalue(), duration


def _ext_for(filename: str | None) -> str:
    name = (filename or "").lower()
    for ext in (".wav", ".mp3", ".flac", ".ogg", ".m4a"):
        if name.endswith(ext):
            return ext
    return ".wav"


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=os.environ.get("VOICECLONE_HOST", "127.0.0.1"), port=int(os.environ.get("VOICECLONE_PORT", "8100")))
