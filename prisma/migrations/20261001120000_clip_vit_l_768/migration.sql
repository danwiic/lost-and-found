-- The embedder sidecar serves clip-ViT-L/14, which emits 768-dim vectors. The
-- existing column holds 512-dim vectors from the old ViT-B/32 model, and
-- pgvector cannot widen or reinterpret vectors of a different dimension, so the
-- column is rebuilt: stored vectors are dropped, and each item's embedding is
-- re-computed from its stored photograph by the application (rows are kept).

-- The HNSW index is bound to the column's dimension; drop it with the column.
DROP INDEX IF EXISTS "Item_embedding_hnsw_idx";

ALTER TABLE "Item" DROP COLUMN "embedding";

ALTER TABLE "Item" ADD COLUMN "embedding" vector(768);

-- Approximate nearest-neighbour index used by src/lib/match.ts.
-- Safe to drop: the cosine search is exact without it, just slower at scale.
CREATE INDEX "Item_embedding_hnsw_idx" ON "Item" USING hnsw ("embedding" vector_cosine_ops);
