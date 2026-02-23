// Vercel serverless function — proxies external URLs (RSS feeds, etc.)
// Deploy to: checkpoint-igdb-proxy.vercel.app/api/fetch

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "url parameter required" });
  }

  // Only allow known safe domains
  const allowed = ["news.google.com", "www.cheapshark.com"];
  try {
    const parsed = new URL(url);
    if (!allowed.some(d => parsed.hostname === d || parsed.hostname.endsWith("." + d))) {
      return res.status(403).json({ error: "Domain not allowed" });
    }
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }

  try {
    const response = await fetch(url);
    const text = await response.text();

    // Cache for 30 minutes
    res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
    res.setHeader("Content-Type", response.headers.get("content-type") || "text/plain");
    return res.status(200).send(text);
  } catch (e) {
    return res.status(500).json({ error: "Proxy error", message: e.message });
  }
}
