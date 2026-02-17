let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry - 60000) {
    return cachedToken;
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET environment variables");
  }

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twitch OAuth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + data.expires_in * 1000;

  return cachedToken;
}

export default async function handler(req, res) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const { endpoint } = req.query;

  const validEndpoints = [
    "games", "covers", "screenshots", "artworks", "genres", "platforms",
    "involved_companies", "companies", "game_modes", "themes",
    "player_perspectives", "franchises", "collections", "search",
    "release_dates", "websites", "game_videos",
  ];

  if (!validEndpoints.includes(endpoint)) {
    return res.status(400).json({ error: `Invalid endpoint: "${endpoint}"` });
  }

  let body = "";
  if (typeof req.body === "string") body = req.body;
  else if (Buffer.isBuffer(req.body)) body = req.body.toString("utf-8");
  else if (req.body) body = JSON.stringify(req.body);

  if (!body.trim()) {
    return res.status(400).json({ error: "Request body is required" });
  }

  try {
    const token = await getAccessToken();
    const clientId = process.env.TWITCH_CLIENT_ID;

    const igdbRes = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
      method: "POST",
      headers: {
        "Client-ID": clientId,
        "Authorization": `Bearer ${token}`,
        "Content-Type": "text/plain",
      },
      body,
    });

    if (!igdbRes.ok) {
      const errorText = await igdbRes.text();
      if (igdbRes.status === 401) {
        cachedToken = null;
        tokenExpiry = 0;
        const retryToken = await getAccessToken();
        const retryRes = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
          method: "POST",
          headers: {
            "Client-ID": clientId,
            "Authorization": `Bearer ${retryToken}`,
            "Content-Type": "text/plain",
          },
          body,
        });
        if (retryRes.ok) {
          const data = await retryRes.json();
          return res.status(200).json(data);
        }
      }
      return res.status(igdbRes.status).json({ error: "IGDB request failed", details: errorText });
    }

    const data = await igdbRes.json();
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json(data);
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: "Internal proxy error", message: err.message });
  }
}
