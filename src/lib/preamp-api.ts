import type { Credential, Stats, ScanStatus, IssuesResponse } from "@/types/api";

const API = "/api/preamp";

async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, init);
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  if (res.status === 204) return null as T;
  return res.json();
}

export const preampApi = {
  whoami: () => api<{ username: string }>("/whoami"),

  listCredentials: () => api<Credential[]>("/credentials"),

  createCredential: (body: {
    client_name: string;
    legacy_auth: boolean;
    ttl: string;
  }) =>
    api<Credential>("/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),

  renewCredential: (id: string) =>
    api<Credential>(`/credentials/${id}/renew`, { method: "POST" }),

  deleteCredential: (id: string) =>
    api<null>(`/credentials/${id}`, { method: "DELETE" }),

  stats: () => api<Stats>("/stats"),

  scanStatus: () => api<ScanStatus>("/scan"),

  startScan: () => api<ScanStatus>("/scan", { method: "POST" }),

  issues: (type: string, limit = 50, offset = 0) =>
    api<IssuesResponse>(
      `/issues?type=${type}&limit=${limit}&offset=${offset}`,
    ),
};
