import { PREAMP_ADMIN_URL } from "@/lib/env";

export async function GET() {
  const res = await fetch(`${PREAMP_ADMIN_URL}/admin/scan`);
  return Response.json(await res.json());
}

export async function POST() {
  const res = await fetch(`${PREAMP_ADMIN_URL}/admin/scan`, { method: "POST" });
  return Response.json(await res.json());
}
