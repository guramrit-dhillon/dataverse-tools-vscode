import * as crypto from "crypto";
import * as fs from "fs/promises";

/**
 * Compute the SHA-256 hex digest of a file's binary content.
 * Used for assembly change detection to avoid redundant uploads.
 */
export async function fileHash(filePath: string): Promise<string> {
  const buf = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

/**
 * Compute SHA-256 of an arbitrary string (e.g. JSON metadata).
 */
export function stringHash(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Read file and return as base64 string (for PluginAssembly.content upload).
 */
export async function fileToBase64(filePath: string): Promise<string> {
  const buf = await fs.readFile(filePath);
  return buf.toString("base64");
}
