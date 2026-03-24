import type { LibraryEntry, TagData, ScanStatus } from "@/types/api";

const API = "/api/library";

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, init);
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return res.json();
}

export async function browse(
  path: string = ""
): Promise<{ entries: LibraryEntry[] }> {
  return json(`/browse?path=${encodeURIComponent(path)}`);
}

export async function readTags(file: string): Promise<TagData> {
  return json(`/tags?file=${encodeURIComponent(file)}`);
}

export async function writeTags(
  file: string,
  tags: Record<string, string | number | null>
): Promise<void> {
  await json("/tags", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file, tags }),
  });
}

export async function moveEntry(from: string, to: string): Promise<void> {
  await json("/move", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to }),
  });
}

export function coverUrl(file: string): string {
  return `${API}/cover?file=${encodeURIComponent(file)}`;
}

export function coverDirUrl(dir: string): string {
  return `${API}/cover?dir=${encodeURIComponent(dir)}`;
}

export async function uploadCover(dir: string, file: File): Promise<void> {
  const form = new FormData();
  form.set("dir", dir);
  form.set("image", file);
  const res = await fetch(`${API}/cover`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
}

export async function scanStatus(): Promise<ScanStatus> {
  return json("/scan");
}

export async function startScan(): Promise<ScanStatus> {
  return json("/scan", { method: "POST" });
}
