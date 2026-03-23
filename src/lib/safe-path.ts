import path from "node:path";
import { MUSIC_DIR } from "./env";

export function resolveSafe(relativePath: string): string | null {
  const resolved = path.resolve(MUSIC_DIR, relativePath);
  if (!resolved.startsWith(path.resolve(MUSIC_DIR))) return null;
  return resolved;
}
