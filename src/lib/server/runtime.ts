import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/** True when running inside Cloudflare Workers (OpenNext), false on Node. */
export const onWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

type CfEnv = {
  ASSETS?: { fetch: (req: Request) => Promise<Response> };
  FILES?: R2Like;
  HYPERDRIVE?: { connectionString: string };
};
export interface R2Like {
  put(key: string, value: ArrayBuffer | Uint8Array, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
}

export function cfEnv(): CfEnv {
  return getCloudflareContext().env as unknown as CfEnv;
}

const cache = new Map<string, Buffer>();

/** Read a file shipped in /public (fonts etc.): static assets on Workers, disk on Node. */
export async function publicFile(rel: string): Promise<Buffer> {
  const hit = cache.get(rel);
  if (hit) return hit;
  let buf: Buffer;
  if (onWorkers) {
    const assets = cfEnv().ASSETS;
    if (!assets) throw new Error("ASSETS binding is not configured.");
    const res = await assets.fetch(new Request(`https://assets.local/${rel}`));
    if (!res.ok) throw new Error(`Static asset ${rel} not found (${res.status})`);
    buf = Buffer.from(await res.arrayBuffer());
  } else {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    buf = await readFile(path.join(process.cwd(), "public", rel));
  }
  cache.set(rel, buf);
  return buf;
}
