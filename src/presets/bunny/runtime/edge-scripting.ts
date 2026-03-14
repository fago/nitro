import "#nitro-internal-pollyfills";
import { useNitroApp } from "nitropack/runtime";

const nitroApp = useNitroApp();

async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);

  let body;
  if (request.body) {
    body = await request.arrayBuffer();
  }

  return nitroApp.localFetch(url.pathname + url.search, {
    host: url.hostname,
    protocol: url.protocol,
    headers: request.headers,
    method: request.method,
    redirect: request.redirect,
    body,
  });
}

// @ts-expect-error - Bunny global is available in Bunny Edge Scripting runtime
if (typeof Bunny !== "undefined") {
  // @ts-expect-error - Bunny global is available in Bunny Edge Scripting runtime
  Bunny.v1.serve(handler);
} else {
  // Fallback to Deno.serve for local preview
  const _parsedPort = Number.parseInt(process.env.NITRO_PORT ?? process.env.PORT ?? "");

  Deno.serve(
    {
      port: Number.isNaN(_parsedPort) ? 3000 : _parsedPort,
      hostname: process.env.NITRO_HOST || process.env.HOST,
    },
    handler
  );
}
