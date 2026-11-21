import { list, put } from "@vercel/blob";
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
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Method not allowed." });
  }

  if (!isSameOrigin(req)) {
    return send(res, 403, { error: "Cross-origin updates are not allowed." });
  }

  const auth = await getUserClient(req);
  if (auth.error) return send(res, auth.error.status, { error: auth.error.message });
  const { client, user } = auth;

  const { pathname, html, projectId } = req.body || {};
  if (typeof projectId !== "string" || !/^[0-9a-f-]{36}$/i.test(projectId)) {
    return send(res, 400, { error: "A valid project ID is required." });
  }
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
    const { data: project, error: lookupError } = await client
      .from("user_projects")
      .select("id, published_pathname")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!project || project.published_pathname !== pathname) {
      return send(res, 404, { error: "This published website does not belong to your account." });
    }

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

    const { error: saveError } = await client
      .from("user_projects")
      .update({ html })
      .eq("id", projectId)
      .eq("user_id", user.id);

    if (saveError) throw saveError;

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
