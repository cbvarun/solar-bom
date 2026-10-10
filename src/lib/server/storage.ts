import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Local private file storage for datasheets, certificates and generated
 * quotations. Files live outside /public and are served only through
 * authorised route handlers. Swap this module for S3/GCS in production.
 */
const ROOT = path.resolve(process.env.STORAGE_DIR ?? "./storage");

export const ALLOWED_UPLOAD_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
};
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export async function saveFile(buf: Buffer, ext: string, folder: string): Promise<string> {
  const safeFolder = folder.replace(/[^a-z0-9-]/gi, "");
  const key = `${safeFolder}/${randomUUID()}${ext.replace(/[^a-z0-9.]/gi, "")}`;
  await mkdir(path.join(ROOT, safeFolder), { recursive: true });
  await writeFile(path.join(ROOT, key), buf);
  return key;
}

export async function loadFile(key: string): Promise<Buffer> {
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
