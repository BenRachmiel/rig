import { PREAMP_ADMIN_URL } from "@/lib/env";
import { headers as getHeaders } from "next/headers";

export async function remoteUserHeader(): Promise<Record<string, string>> {
  const h = await getHeaders();
  const user = h.get("x-forwarded-user") || h.get("remote-user");
  return user ? { "remote-user": user } : {};
}

export async function triggerRescan(): Promise<void> {
  fetch(`${PREAMP_ADMIN_URL}/admin/scan`, {
    method: "POST",
    headers: await remoteUserHeader(),
  }).catch(() => {});
}
