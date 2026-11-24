/**
 * Cloudflare Worker CORS proxy for Google Calendar iCal (.ics) feeds.
 */
const ALLOWED_PREFIX = "https://calendar.google.com/calendar/ical/";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    if (request.method !== "GET") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const reqUrl = new URL(request.url);
    const targetUrl = reqUrl.searchParams.get("url") || "";
    if (!targetUrl.startsWith(ALLOWED_PREFIX)) {
      return new Response(JSON.stringify({ error: "Allowed only for Google Calendar iCal URLs" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const upstream = await fetch(targetUrl, { redirect: "follow" });
    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: `Upstream status ${upstream.status}` }), {
        status: upstream.status,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
      });
    }

    const text = await upstream.text();
    return new Response(text, {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  },
};
