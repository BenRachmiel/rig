import { PREAMP_ADMIN_URL, PREAMP_URL } from "@/lib/env";

let cachedApiKey: string | null = null;

async function mintApiKey(): Promise<string> {
  if (cachedApiKey) return cachedApiKey;

  const res = await fetch(`${PREAMP_ADMIN_URL}/admin/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "remote-user": "rig",
    },
    body: JSON.stringify({
      client_name: "rig-reverb",
      legacy_auth: false,
      ttl: "8760h",
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to mint Reverb credential: ${res.status} ${await res.text()}`);
  }

  const cred = (await res.json()) as { secret: string };
  cachedApiKey = cred.secret;
  return cachedApiKey;
}

async function proxy(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const url = new URL(request.url);

  let apiKey: string;
  try {
    apiKey = await mintApiKey();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Credential mint failed" }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }

  url.searchParams.set("apiKey", apiKey);

  // Only set f=json for metadata endpoints — stream/getCoverArt return binary
  const endpoint = path[0];
  const binaryEndpoints = new Set(["stream", "getCoverArt", "download"]);
  if (!binaryEndpoints.has(endpoint)) {
    url.searchParams.set("f", "json");
  }

  const target = `${PREAMP_URL}/rest/${path.join("/")}?${url.searchParams.toString()}`;

  const upstreamHeaders = new Headers();
  const ct = request.headers.get("content-type");
  if (ct) upstreamHeaders.set("content-type", ct);

  const range = request.headers.get("range");
  if (range) upstreamHeaders.set("range", range);

  const upstream = await fetch(target, {
    method: request.method,
    headers: upstreamHeaders,
    body: request.method !== "GET" && request.method !== "HEAD" ? await request.arrayBuffer() : undefined,
  });

  const headers = new Headers();
  for (const name of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const val = upstream.headers.get(name);
    if (val) headers.set(name, val);
  }

  return new Response(upstream.body, { status: upstream.status, headers });
}

export const GET = proxy;
export const POST = proxy;
