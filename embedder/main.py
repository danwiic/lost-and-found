"""Single-purpose embedder sidecar.

Loads CLIP ViT-L/14 once at boot (the model is baked into the image) and serves
one endpoint:

    POST /embed  {"imageBase64": "<base64 image bytes>"}
              -> {"embedding": [768 floats], "model": ..., "dimensions": 768}

The returned vector is L2-normalised, so cosine similarity in the database
behaves like a plain dot product. Decoding, EXIF orientation and RGB conversion
happen here so callers can hand over the exact bytes they stored.
"""

import base64
import binascii
import io

from fastapi import FastAPI, HTTPException
from PIL import Image, ImageOps
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

# Baked into the image at build time (see embedder/Dockerfile). A plain
# sentence-transformers folder loads directly, no hub download at runtime.
MODEL_PATH = "/srv/models/clip-ViT-L-14"
MODEL_ID = "clip-ViT-L-14"  # reported via /health and /embed for traceability
DIMENSIONS = 768

# Loaded once per process; uvicorn runs a single worker so this is shared by
# every request. Takes tens of seconds — compose gives the container a generous
# start_period before the healthcheck gates the app service.
model = SentenceTransformer(MODEL_PATH)

# Interactive docs stay on (/docs, /redoc): handy while tuning. The service is
# internal-only on the compose network, so they are not exposed to the host
# unless you temporarily publish a port (see README).
app = FastAPI(title="embedder")


class EmbedRequest(BaseModel):
    imageBase64: str


def _embed(image):
    """Encode one PIL image, tolerating sentence-transformers API variations."""
    try:
        return model.encode([image], normalize_embeddings=True)
    except (TypeError, ValueError):
        # Older releases expose image input through a dedicated keyword instead.
        return model.encode(images=[image], normalize_embeddings=True)


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_ID, "dimensions": DIMENSIONS}


@app.post("/embed")
def embed(request: EmbedRequest):
    try:
        raw = base64.b64decode(request.imageBase64, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=422, detail="imageBase64 is not valid base64")
    if not raw:
        raise HTTPException(status_code=422, detail="imageBase64 decodes to no bytes")

    try:
        image = Image.open(io.BytesIO(raw))
        # Match the app's storage pipeline: honour EXIF orientation, drop alpha.
        image = ImageOps.exif_transpose(image).convert("RGB")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=422, detail="the bytes are not a decodable image")

    try:
        vectors = _embed(image)
    except HTTPException:
        raise
    except Exception as exc:  # corrupt image that PIL opened but the model rejects
        raise HTTPException(status_code=422, detail=f"the image could not be embedded: {exc}")

    embedding = [float(value) for value in vectors[0]]
    if len(embedding) != DIMENSIONS:
        raise HTTPException(
            status_code=500,
            detail=f"the model returned {len(embedding)} dimensions, expected {DIMENSIONS}",
        )
    return {"embedding": embedding, "model": MODEL_ID, "dimensions": DIMENSIONS}
