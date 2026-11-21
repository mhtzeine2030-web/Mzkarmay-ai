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

    // Serve generated HTML from the isolated Blob origin.
    // This allows the store's localStorage while keeping it off the platform origin.
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    return res.redirect(302, blob.url);
  } catch (error) {
    console.error("Open published website failed:", error);
    return res.status(500).send("Could not open the published website.");
  }
}
