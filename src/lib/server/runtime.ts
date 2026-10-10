import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/** True when running inside Cloudflare Workers (OpenNext), false on Node. */
export const onWorkers = typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

type CfEnv = {
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

