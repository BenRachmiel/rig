import { PREAMP_ADMIN_URL } from "@/lib/env";
import { headers as getHeaders } from "next/headers";

async function remoteUserHeader(): Promise<Record<string, string>> {
  const h = await getHeaders();
  const user = h.get("x-forwarded-user") || h.get("remote-user");
  return user ? { "remote-user": user } : {};
}

export async function GET() {
  const res = await fetch(`${PREAMP_ADMIN_URL}/admin/scan`, {
    headers: await remoteUserHeader(),
  });
  return Response.json(await res.json());
}

export async function POST() {
  const res = await fetch(`${PREAMP_ADMIN_URL}/admin/scan`, {
    method: "POST",
    headers: await remoteUserHeader(),
  });
  return Response.json(await res.json());
}
