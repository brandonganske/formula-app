import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const IQ_BASE = "https://iq.influenceish.com/api/v1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-App-Source, X-Request-Id",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: cors });
  }

  const url = new URL(req.url);

  // Extract the IQ API path — strip everything up to and including /iq-proxy
  // Handles: /functions/v1/iq-proxy/auth/register → /auth/register
  const match = url.pathname.match(/\/iq-proxy(\/.*)?$/);
  const iqPath = match?.[1] ?? "/";
  const targetUrl = `${IQ_BASE}${iqPath}${url.search}`;

  // Only forward safe headers — extra Supabase/CDN headers confuse the IQ backend
  const fwdHeaders = new Headers();
  const FORWARD_KEYS = new Set([
    "authorization",
    "content-type",
    "accept",
    "x-app-source",
    "x-request-id",
  ]);
  for (const [k, v] of req.headers.entries()) {
    if (FORWARD_KEYS.has(k.toLowerCase())) {
      fwdHeaders.set(k, v);
    }
  }
  if (!fwdHeaders.has("content-type")) {
    fwdHeaders.set("content-type", "application/json");
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await req.arrayBuffer() : undefined;

  try {
    const res = await fetch(targetUrl, {
      method: req.method,
      headers: fwdHeaders,
      body,
      redirect: "follow",
    });

    const resBody = await res.arrayBuffer();
    const contentType = res.headers.get("Content-Type") ?? "application/json";

    return new Response(resBody, {
      status: res.status,
      headers: { ...cors, "Content-Type": contentType },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Proxy error", detail: String(err) }),
      { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
