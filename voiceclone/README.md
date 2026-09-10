# Voice-clone sidecar (OmniVoice)

A small FastAPI service that runs [OmniVoice](https://github.com/k2-fsa/OmniVoice)
(zero-shot voice cloning, 600+ languages) next to the Soundwave AI backend.
The Node API proxies to it (`POST /api/v1/tts/clone`, `/profiles`); you never
call this service directly from the browser.

It holds the model in memory — start it **once** and leave it running beside
`server` and `frontend`, in its own terminal.

---

## 1. Install & run (Windows)

> This guide targets Windows with an **AMD GPU** (e.g. RX 6650 XT). PyTorch
> does not ship AMD support on Windows, so the model runs on your **CPU** —
> perfectly workable (RTF ≈ 0.3–1×, i.e. a 10 s voiceover takes ~3–10 s plus a
> one-time model load of a minute or two). NVIDIA GPU or Linux? See
> [Other hardware](#3-other-hardware).

```powershell
cd voiceclone
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip

# PyTorch — CPU wheels (correct choice on Windows with an AMD GPU)
pip install torch torchaudio

# OmniVoice + the sidecar
pip install -r requirements.txt

# Run it (first start downloads the model weights from Hugging Face — several GB, one time only)
uvicorn server:app --host 127.0.0.1 --port 8100
```

Leave this terminal open. Health check: http://localhost:8100/health

## 2. Point Soundwave AI at it

In `server/.env` add:

```
VOICECLONE_URL=http://localhost:8100
# Optional: raise if CPU generation of long texts feels slow
VOICECLONE_TIMEOUT_MS=600000
```

Restart the Node API (`npm run dev`). Open the Studio — a **Cloned** tab now
sits next to the Microsoft Neural voices. Upload a 3–10 s clean reference
clip (WAV/MP3/FLAC/OGG), give it a name, generate — the cloned audio flows
into the normal subtitles + video pipeline. Unset `VOICECLONE_URL` to turn
the feature off (the UI hides it automatically).

## 3. Other hardware

- **NVIDIA GPU (much faster):** install CUDA torch first, then the rest, and
  set the device:

  ```powershell
  pip install torch==2.8.0+cu128 torchaudio==2.8.0+cu128 --extra-index-url https://download.pytorch.org/whl/cu128
  pip install -r requirements.txt
  $env:OMNIVOICE_DEVICE="cuda:0"; $env:OMNIVOICE_DTYPE="float16"
  uvicorn server:app --host 127.0.0.1 --port 8100
  ```

- **AMD GPU on Linux/WSL2 (ROCm):** RX 6600/6700-class cards work with ROCm
  torch + `HSA_OVERRIDE_GFX_VERSION=10.3.0`. Inside WSL2-Ubuntu:

  ```bash
  pip install torch torchaudio --index-url https://download.pytorch.org/whl/rocm6.2
  pip install -r requirements.txt
  export OMNIVOICE_DEVICE=cuda:0 OMNIVOICE_DTYPE=float16 HSA_OVERRIDE_GFX_VERSION=10.3.0
  uvicorn server:app --host 127.0.0.1 --port 8100
  ```

- **Apple Silicon:** default torch wheels + `OMNIVOICE_DEVICE=mps`.

## 4. Environment variables

| Var | Default | Purpose |
| --- | --- | --- |
| `OMNIVOICE_MODEL` | `k2-fsa/OmniVoice` | HF model id or local path |
| `OMNIVOICE_DEVICE` | `cpu` | `cpu`, `cuda:0`, `mps`, `xpu` |
| `OMNIVOICE_DTYPE` | `float32` on CPU, else `float16` | model precision |
| `VOICECLONE_HOST` / `VOICECLONE_PORT` | `127.0.0.1` / `8100` | bind address |
| `VOICECLONE_PROFILES_DIR` | `./profiles` | where cloned voices live |
| `OMNIVOICE_MOCK` | — | `1` = no model, sine-wave output (dev/tests, no downloads) |

## 5. Notes & tips

- **Reference clip:** 3–10 s of clean, single-speaker speech, same language as
  your target text. Longer clips slow inference and can hurt quality.
- **Word timings:** OmniVoice returns audio only. The Node API derives evenly
  weighted word timings from the text + duration so the subtitle editor still
  auto-populates cues; nudge cue boundaries by hand for perfect sync.
- **Concurrency:** one generation at a time per sidecar (the model is held on
  one device under a lock). Run more sidecars on different ports for parallel
  traffic.
- The service binds to `127.0.0.1` by default — only local processes can use
  your GPU/CPU time. Pass `--host 0.0.0.0` only if the Node API runs on
  another machine (put it behind auth in that case).

### Testing without a GPU/model

```
OMNIVOICE_MOCK=1 uvicorn server:app --port 8100
```

The mock returns valid WAV output, so the whole Node ⇄ Python pipeline can be
exercised without downloading weights.
