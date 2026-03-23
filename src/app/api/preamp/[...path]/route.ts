import { PREAMP_ADMIN_URL } from "@/lib/env";
import { headers as getHeaders } from "next/headers";

async function proxy(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const url = new URL(request.url);
  const target = `${PREAMP_ADMIN_URL}/admin/${path.join("/")}${url.search}`;

  const incomingHeaders = await getHeaders();
  const headers = new Headers();
  headers.set("content-type", request.headers.get("content-type") ?? "application/json");

  // Forward auth header from upstream proxy
  const remoteUser = incomingHeaders.get("remote-user");
  if (remoteUser) headers.set("remote-user", remoteUser);

  const init: RequestInit = {
    method: request.method,
    headers,
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.text();
  }

  const upstream = await fetch(target, init);

  return new Response(upstream.body, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const PATCH = proxy;
