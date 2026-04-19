import { PREAMP_ADMIN_URL } from "@/lib/env";
import { remoteUserHeader } from "@/lib/server-helpers";

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
