# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# embedder — a single-purpose sidecar: CLIP ViT-L/14 behind POST /embed.
#
# The model is baked into the image at build time (COPY'd from the build
# context, pinned to HF revision
# 1b4b2e899178706d1b9905460ac21de1e0ba86a5), so the container never downloads
# anything at runtime and photo matching works offline. The service is
# internal-only on the compose network: no host port is published; the app
# reaches it at http://embedder:8000.
#
# model-cache/clip-ViT-L-14 is a plain sentence-transformers folder
# (modules.json + 0_CLIPModel/), which SentenceTransformer() loads directly.
#
# ViT-L/14 emits 768-dim vectors (the schema's vector(768) column matches).
# ---------------------------------------------------------------------------

FROM python:3.11-slim

WORKDIR /srv
ENV PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HF_HUB_DISABLE_TELEMETRY=1

# Torch first, from the CPU wheel index: the default Linux wheel bundles CUDA
# and is several GB larger. sentence-transformers then sees torch as satisfied.
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake the model into the image: copied from the build context, never
# downloaded. This layer changes rarely — keep it above the app code copy.
#
# model-cache/ is gitignored, so a fresh clone has the folder but no weights.
# Checked through a bind mount (no layer of its own) so a missing fetch fails
# with the command to run rather than a bare "not found" from the COPY below.
RUN --mount=type=bind,source=model-cache,target=/src/model-cache \
    test -s /src/model-cache/clip-ViT-L-14/0_CLIPModel/model.safetensors \
      || { echo "embedder/model-cache is empty — run 'npm run model:fetch' on the host first (see README)."; exit 1; }

COPY model-cache/clip-ViT-L-14 /srv/models/clip-ViT-L-14

COPY main.py .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
