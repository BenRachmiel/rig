/**
 * Create a NextRequest-compatible object for testing route handlers.
 * NextRequest adds `nextUrl` (a URL with searchParams) on top of standard Request.
 */
export function nextRequest(url: string, init?: RequestInit) {
  const req = new Request(url, init);
  const parsedUrl = new URL(url);
  Object.defineProperty(req, "nextUrl", { value: parsedUrl });
  return req;
}
