import { list } from "@vercel/blob";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method not allowed.");
  }

  const pathname = typeof req.query?.pathname === "string"
    ? req.query.pathname
    : "";

  if (!/^sites\/[0-9a-f-]+\.html$/i.test(pathname)) {
    return res.status(400).send("Invalid website address.");
  }

  try {
    const { blobs } = await list({ prefix: "sites/", limit: 1000 });
    const blob = blobs.find(item => item.pathname === pathname);

    if (!blob) {
      return res.status(404).send("Website not found.");
    }

    const response = await fetch(blob.url, { redirect: "error" });

    if (!response.ok) {
      return res.status(502).send("Could not load the published website.");
    }

    const html = await response.text();

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Content-Security-Policy", "sandbox allow-scripts allow-forms");
    res.setHeader("Cache-Control", "public, max-age=60, s-maxage=300");
    return res.status(200).send(html);
  } catch (error) {
    console.error("Open published website failed:", error);
    return res.status(500).send("Could not open the published website.");
  }
}
