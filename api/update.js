import { list, put } from "@vercel/blob";
import { timingSafeEqual } from "node:crypto";

const MAX_HTML_BYTES = 1024 * 1024;

function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

function safeSecretEqual(provided, expected) {
  if (typeof provided !== "string" || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function isSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Method not allowed." });
  }

  if (!isSameOrigin(req)) return send(res, 403, { error: "Cross-origin updates are not allowed." });

  const expectedSecret = process.env.SITE_UPDATE_SECRET;
  if (!expectedSecret) return send(res, 503, { error: "Site update protection is not configured yet." });

  const providedSecret = req.headers["x-site-update-key"];
  if (!safeSecretEqual(providedSecret, expectedSecret)) {
    return send(res, 401, { error: "The update password is incorrect." });
  }

  const { pathname, html } = req.body || {};
  if (typeof pathname !== "string" || !/^sites\/[0-9a-f-]+\.html$/i.test(pathname)) {
    return send(res, 400, { error: "Invalid website address." });
  }
  if (typeof html !== "string" || !html.trim() || !/<html[\s>]|<!doctype\s+html/i.test(html)) {
    return send(res, 400, { error: "A complete HTML document is required." });
  }
  if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
    return send(res, 413, { error: "The website is too large to update (1 MB maximum)." });
  }

  try {
    const { blobs } = await list({ prefix: "sites/", limit: 1000 });
    const existing = blobs.find(blob => blob.pathname === pathname);
    if (!existing) return send(res, 404, { error: "Published website not found." });

    const blob = await put(pathname, html, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "text/html; charset=utf-8",
      cacheControlMaxAge: 60
    });

    return send(res, 200, {
      ok: true,
      pathname: blob.pathname,
      url: `/api/site?pathname=${encodeURIComponent(blob.pathname)}`
    });
  } catch (error) {
    console.error("Update published website failed:", error);
    return send(res, 500, { error: "Could not update the published website." });
  }
}
