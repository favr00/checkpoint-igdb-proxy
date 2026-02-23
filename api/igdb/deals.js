js

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { title, storeID = "1", limit = "1", sortBy = "Savings" } = req.query;
  if (!title) return res.status(400).json({ error: "title parameter required" });

  try {
    const url = `https://www.cheapshark.com/api/1.0/deals?title=${encodeURIComponent(title)}&limit=${limit}&sortBy=${sortBy}&storeID=${storeID}`;
    const response = await fetch(url);
    if (!response.ok) return res.status(response.status).json({ error: "CheapShark API error" });
    const data = await response.json();
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=7200");
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: "Proxy error", message: e.message });
  }
};
