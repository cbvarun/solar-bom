import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { onWorkers } from "./server/runtime";

/**
 * Database access through the node-postgres driver adapter.
 *
 * On Node (local dev, Node hosts) one client is shared, using DATABASE_URL.
 * On Cloudflare Workers, sockets cannot be shared between requests, so each
 * request gets its own client, connected through the Hyperdrive binding.
 */
const make = (connectionString: string) => new PrismaClient({ adapter: new PrismaPg({ connectionString, max: onWorkers ? 1 : 10 }) });

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const perRequest = new WeakMap<object, PrismaClient>();

function client(): PrismaClient {
  if (onWorkers) {
    const { env, ctx } = getCloudflareContext();
    let c = perRequest.get(ctx);
    if (!c) {
      const hd = (env as unknown as { HYPERDRIVE?: { connectionString: string } }).HYPERDRIVE;
      if (!hd) throw new Error("HYPERDRIVE binding is not configured (see wrangler.jsonc).");
      c = make(hd.connectionString);
      perRequest.set(ctx, c);
    }
    return c;
  }
  if (!globalForPrisma.prisma) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
    globalForPrisma.prisma = make(process.env.DATABASE_URL);
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_t, prop) {
    const c = client();
    const v = Reflect.get(c, prop, c);
    return typeof v === "function" ? v.bind(c) : v;
  },
});
