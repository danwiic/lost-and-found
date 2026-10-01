/**
 * Next.js 16 loads this file as ESM because package.json sets "type": "module".
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  // The Docker image ships the whole app and starts it with `next start`, so the
  // standalone output is intentionally not enabled: `next start` is unsupported
  // with `output: 'standalone'` in Next.js 16. Enable it (and switch the
  // entrypoint to `node .next/standalone/server.js`) if you want a smaller image.
  // sharp stays external for the photo storage pipeline; image embedding runs
  // in the embedder sidecar (embedder/, compose service `embedder`).
  serverExternalPackages: ['sharp'],

  // The app is entirely behind auth and reads cookies on every request, so
  // cache nothing at the framework level.
  experimental: {
    // Server Actions are only used for small mutations; raise the body limit a
    // little so photo uploads through actions do not get rejected early.
    serverActions: {
      bodySizeLimit: '12mb',
    },
  },
}

export default nextConfig
