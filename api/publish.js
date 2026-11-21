import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { getUserClient } from "./_lib/auth.js";

const MAX_HTML_BYTES = 1024 * 1024;

function send(res, status, body) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
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
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return send(res, 405, { error: "Method not allowed." });
  }

  if (req.method === "POST" && !isSameOrigin(req)) {
    return send(res, 403, { error: "Cross-origin publishing is not allowed." });
  }

  const auth = await getUserClient(req);
  if (auth.error) return send(res, auth.error.status, { error: auth.error.message });
  const { client, user } = auth;

  if (req.method === "GET") {
    try {
      const { data, error } = await client
        .from("user_projects")
        .select("id, title, published_pathname")
        .eq("user_id", user.id)
        .not("published_pathname", "is", null)
        .order("id", { ascending: false });

      if (error) throw error;

      const sites = (data || [])
        .filter(row => typeof row.published_pathname === "string" && row.published_pathname)
        .map(row => ({
          projectId: row.id,
          title: row.title || "MZKarmay AI website",
          url: `/api/site?pathname=${encodeURIComponent(row.published_pathname)}`,
          pathname: row.published_pathname,
          uploadedAt: "",
          size: 0
        }));

      return send(res, 200, { sites });
    } catch (error) {
      console.error("List account published sites failed:", error);
      return send(res, 500, { error: "Could not load your published websites." });
    }
  }

  const { html, title, prompt, projectId } = req.body || {};

  if (typeof html !== "string" || !html.trim() || !/<html[\\s>]|<!doctype\\s+html/i.test(html)) {
    return send(res, 400, { error: "A complete HTML document is required." });
  }
  if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
    return send(res, 413, { error: "The website is too large to publish (1 MB maximum)." });
  }

  const safeTitle = typeof title === "string"
    ? title.replace(/[<>\\r\\n]/g, "").trim().slice(0, 80)
    : "";
  const safePrompt = typeof prompt === "string" ? prompt.slice(0, 10000) : "";
  const id = typeof projectId === "string" && /^[0-9a-f-]{36}$/i.test(projectId)
    ? projectId
    : randomUUID();

  try {
    const pathname = `sites/${randomUUID()}.html`;
    const blob = await put(pathname, html, {
      access: "public",
      addRandomSuffix: false,
      contentType: "text/html; charset=utf-8",
      cacheControlMaxAge: 60
    });

    const { error } = await client.from("user_projects").upsert({
      id,
      user_id: user.id,
      title: safeTitle || "MZKarmay AI website",
      html,
      prompt: safePrompt,
      published_pathname: blob.pathname
    }, { onConflict: "id" });

    if (error) {
      console.error("Save published website ownership failed:", error);
      return send(res, 500, { error: "The website was uploaded, but its ownership could not be saved. Please contact support before publishing again." });
    }

    return send(res, 200, {
      ok: true,
      projectId: id,
      url: `/api/site?pathname=${encodeURIComponent(blob.pathname)}`,
      pathname: blob.pathname,
      title: safeTitle || "MZKarmay AI website"
    });
  } catch (error) {
    console.error("Publish site failed:", error);
    return send(res, 500, { error: "Publishing failed. Check the Vercel Blob connection and try again." });
  }
}
