import path from "node:path";
import { MUSIC_DIR } from "./env";

const CONTROL_CHAR_RE = /[\x00-\x1f]/;

export function resolveSafe(relativePath: string): string | null {
  if (CONTROL_CHAR_RE.test(relativePath)) return null;
  const resolved = path.resolve(MUSIC_DIR, relativePath);
  if (!resolved.startsWith(path.resolve(MUSIC_DIR))) return null;
  return resolved;
}

/** Sanitise a metadata value for use as a single path segment (directory or filename). */
export function safePathSegment(name: string): string {
  return name.replace(/[/\0]/g, "_");
}
