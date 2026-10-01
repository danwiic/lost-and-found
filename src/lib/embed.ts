import { config } from '@/lib/config'

/**
 * Image embedding over HTTP. The heavy CLIP model (clip-ViT-L/14, 768-dim
 * vectors) lives in a dedicated sidecar service — embedder/, compose service
 * `embedder` — and this module is a thin typed client for it. The sidecar loads
 * the model once at boot, decodes and EXIF-corrects the image bytes itself, and
 * returns an L2-normalised vector, so cosine distance in pgvector behaves like
 * a plain dot product.
 *
 * Nothing is downloaded here: if the embedder is down, callers fail fast (the
 * report flow stores a warning; the search flow answers 503) instead of
 * blocking on a model download.
 */

type EmbedResponse = { embedding: number[]; dimensions?: number }

async function embedderFetch(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 30_000, ...rest } = init
  return fetch(`${config.embeddings.url}${path}`, {
    ...rest,
    headers: { 'content-type': 'application/json', ...(rest.headers ?? {}) },
    signal: AbortSignal.timeout(timeoutMs),
  })
}

/** Embeds one image (any bytes the embedder can decode) as a normalised vector. */
export async function embedImageBuffer(buffer: Buffer): Promise<number[]> {
  let response: Response
  try {
    response = await embedderFetch('/embed', {
      method: 'POST',
      body: JSON.stringify({ imageBase64: buffer.toString('base64') }),
    })
  } catch (error) {
    throw new Error(`The embedder service at ${config.embeddings.url} is unreachable.`, {
      cause: error,
    })
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 200)
    throw new Error(`The embedder service returned ${response.status}${detail ? `: ${detail}` : ''}`)
  }

  const data = (await response.json()) as EmbedResponse
  const embedding = data.embedding
  if (
    !Array.isArray(embedding) ||
    embedding.length !== config.embeddings.dimensions ||
    embedding.some((value) => !Number.isFinite(value))
  ) {
    throw new Error(
      `The embedder service returned an invalid embedding (expected ${config.embeddings.dimensions} finite values).`,
    )
  }
  return embedding
}

/** Cheap reachability probe for the health endpoint. */
export async function embedderHealthy(): Promise<boolean> {
  try {
    const response = await embedderFetch('/health', { method: 'GET', timeoutMs: 3_000 })
    return response.ok
  } catch {
    return false
  }
}

/** Formats an embedding as a pgvector literal: `[0.01,0.02,...]`. */
export function toVectorLiteral(embedding: number[]): string {
  if (embedding.length !== config.embeddings.dimensions) {
    throw new Error(
      `Expected a ${config.embeddings.dimensions}-dimensional embedding, received ${embedding.length}.`,
    )
  }
  return `[${embedding.map((value) => (Number.isFinite(value) ? value.toFixed(8) : '0')).join(',')}]`
}
