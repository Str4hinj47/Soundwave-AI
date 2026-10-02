# OmniVoice voice-clone sidecar — CPU container image.
# Works on Hugging Face Spaces (free CPU tier), Oracle Cloud Always Free
# (Ampere ARM64 included — multi-arch wheels), and any container host.
#
#   docker build -t voiceclone ./voiceclone
#   docker run -p 8100:7860 -e VOICECLONE_TOKEN=<shared-secret> voiceclone
#
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    OMNIVOICE_DEVICE=cpu \
    OMNIVOICE_DTYPE=float32 \
    PORT=7860

WORKDIR /app

# CPU PyTorch first so `omnivoice` reuses it instead of pulling CUDA wheels
# (keeps the image ~8 GB lighter and works everywhere).
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake the default model weights into the image so cold starts (e.g. a Space
# waking from sleep) load from disk instead of re-downloading gigabytes.
# Skip this layer if you always set OMNIVOICE_MODEL yourself.
RUN python -c "from huggingface_hub import snapshot_download; snapshot_download('k2-fsa/OmniVoice')"

COPY server.py .

EXPOSE 7860
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-7860}"]
