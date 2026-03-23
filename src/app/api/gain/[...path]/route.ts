import { GAIN_URL } from "@/lib/env";

async function proxy(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const url = new URL(request.url);
  const target = `${GAIN_URL}/api/${path.join("/")}${url.search}`;

  const headers = new Headers();
  for (const [k, v] of request.headers) {
    if (k === "host" || k === "connection") continue;
    headers.set(k, v);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    // @ts-expect-error duplex required for streaming body
    init.duplex = "half";
  }

  const upstream = await fetch(target, init);

  const responseHeaders = new Headers();
  for (const [k, v] of upstream.headers) {
    if (k === "transfer-encoding") continue;
    responseHeaders.set(k, v);
  }

  // For SSE, stream the response through without buffering
  if (upstream.headers.get("content-type")?.includes("text/event-stream")) {
    responseHeaders.set("content-type", "text/event-stream");
    responseHeaders.set("cache-control", "no-cache");
    responseHeaders.set("connection", "keep-alive");
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const PATCH = proxy;
