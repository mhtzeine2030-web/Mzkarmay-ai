import { randomUUID } from "node:crypto";
import { put, list } from "@vercel/blob";

const MAX_HTML_BYTES = 1024 * 1024;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_UPLOADS_PER_WINDOW = 5;
const uploadAttempts = new Map();

function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

function isSameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;

  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function allowUpload(req) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = (typeof forwarded === "string" ? forwarded.split(",")[0] : "") ||
    req.socket?.remoteAddress ||
    "unknown";
  const now = Date.now();
  const recent = (uploadAttempts.get(ip) || []).filter(
    timestamp => now - timestamp < RATE_WINDOW_MS
  );

  if (recent.length >= MAX_UPLOADS_PER_WINDOW) {
    uploadAttempts.set(ip, recent);
    return false;
  }

  recent.push(now);
  uploadAttempts.set(ip, recent);
  return true;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const { blobs } = await list({ prefix: "sites/", limit: 100 });
      const sites = blobs
        .filter(blob => blob.pathname.endsWith(".html"))
        .map(blob => ({
          url: blob.url,
          pathname: blob.pathname,
          uploadedAt: blob.uploadedAt,
          size: blob.size
        }))
        .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

      return send(res, 200, { sites });
    } catch (error) {
      console.error("List published sites failed:", error);
      return send(res, 500, { error: "Could not load published sites." });
    }
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error: "Method not allowed." });
  }

  if (!isSameOrigin(req)) {
    return send(res, 403, { error: "Cross-origin publishing is not allowed." });
  }

  if (!allowUpload(req)) {
    return send(res, 429, { error: "Too many publish requests. Please try again later." });
  }

  const { html, title } = req.body || {};

  if (typeof html !== "string" || !html.trim()) {
    return send(res, 400, { error: "Valid HTML is required." });
  }

  if (!/<html[\s>]|<!doctype\s+html/i.test(html)) {
    return send(res, 400, { error: "The content must be a complete HTML document." });
  }

  if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
    return send(res, 413, { error: "The website is too large to publish (1 MB maximum)." });
  }

  const safeTitle = typeof title === "string"
    ? title.replace(/[<>\r\n]/g, "").trim().slice(0, 80)
    : "";

  try {
    const pathname = `sites/${randomUUID()}.html`;
    const blob = await put(pathname, html, {
      access: "public",
      addRandomSuffix: false,
      contentType: "text/html; charset=utf-8",
      cacheControlMaxAge: 60
    });

    return send(res, 200, {
      url: blob.url,
      pathname: blob.pathname,
      title: safeTitle || "MZKarmay AI website"
    });
  } catch (error) {
    console.error("Publish site failed:", error);
    return send(res, 500, {
      error: "Publishing failed. Check the Vercel Blob connection and try again."
    });
  }
}
