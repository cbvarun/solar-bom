import { randomUUID } from "node:crypto";
import { cfEnv, onWorkers } from "./runtime";

/**
 * Private file storage for datasheets, certificates and generated quotations.
 * Files are served only through authorised route handlers, never from /public.
 * On Cloudflare Workers they live in the R2 bucket bound as FILES; on Node they
 * live on local disk under STORAGE_DIR.
 */
const fsMod = () => Promise.all([import("node:fs/promises"), import("node:path")]);
const root = async () => (await import("node:path")).resolve(process.env.STORAGE_DIR ?? "./storage");

function bucket() {
  const b = cfEnv().FILES;
  if (!b) throw new Error("R2 binding FILES is not configured (see wrangler.jsonc).");
  return b;
}

export const ALLOWED_UPLOAD_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
};
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export async function saveFile(buf: Buffer, ext: string, folder: string): Promise<string> {
  const safeFolder = folder.replace(/[^a-z0-9-]/gi, "");
  const key = `${safeFolder}/${randomUUID()}${ext.replace(/[^a-z0-9.]/gi, "")}`;
  if (onWorkers) {
    await bucket().put(key, new Uint8Array(buf));
    return key;
  }
  const [{ mkdir, writeFile }, path] = await fsMod();
  const ROOT = await root();
  await mkdir(path.join(ROOT, safeFolder), { recursive: true });
  await writeFile(path.join(ROOT, key), buf);
  return key;
}

export async function loadFile(key: string): Promise<Buffer> {
  if (!/^[a-z0-9-]+\/[a-z0-9-]+\.[a-z0-9]+$/i.test(key)) throw new Error("Invalid storage key");
  if (onWorkers) {
    const obj = await bucket().get(key);
    if (!obj) throw new Error("File not found in storage");
    return Buffer.from(await obj.arrayBuffer());
  }
  const [{ readFile }, path] = await fsMod();
  const ROOT = await root();
  const full = path.resolve(ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Invalid storage key");
  return readFile(full);
}

/** Check magic bytes so a renamed file can't pass as a PDF or image. */
export function sniffType(buf: Buffer): string | null {
  if (buf.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  if (buf[0] === 0x89 && buf.subarray(1, 4).toString() === "PNG") return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  return null;
}
