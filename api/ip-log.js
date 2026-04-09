export default async function handler(req, res) {
  // -------- METHOD CHECK --------
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // -------- IP --------
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  // -------- BODY --------
  let body = {};
  try {
    body =
      typeof req.body === "object" && req.body
        ? req.body
        : JSON.parse(req.body || "{}");
  } catch {
    body = {};
  }

  const page = body.page || "/";
  const href = body.href || null;
  const refFromClient = body.ref || null;

  // -------- ONLY TRACK THIS SITE --------
  const host = req.headers["host"] || "";
  const cleanHost = host.split(":")[0];

  const ALLOWED_HOSTS = [
    "payoutcalculators.vercel.app"
  ];

  if (!ALLOWED_HOSTS.includes(cleanHost)) {
    return res.status(200).json({
      ok: true,
      ignored: true,
      reason: "INVALID_HOST"
    });
  }

  // -------- DEDUPE (15s per IP+page) --------
  global._recentIps ??= new Map();

  const now = Date.now();
  const dedupeKey = `${ip}|${page}`;
  const last = global._recentIps.get(dedupeKey);

  if (last && now - last < 15000) {
    return res.status(200).json({
      ok: true,
      deduped: true,
      page
    });
  }

  global._recentIps.set(dedupeKey, now);

  // -------- HEADERS --------
  const ua = req.headers["user-agent"] || "";

  const referer =
    refFromClient ||
    req.headers["referer"] ||
    req.headers["referrer"] ||
    "";

  const origin = req.headers["origin"] || "";

  // -------- BASIC HUMAN CHECK --------
  const isBrowser =
    ua.includes("Chrome") ||
    ua.includes("Firefox") ||
    ua.includes("Safari") ||
    ua.includes("Edge") ||
    ua.includes("Mobile") ||
    ua.includes("Mozilla");

  if (!isBrowser) {
    return res.status(200).json({
      ok: true,
      type: "IGNORED_NON_HUMAN"
    });
  }

  // -------- GEO --------
  const geo = {
    country: req.headers["x-vercel-ip-country"] || null,
    regionName: req.headers["x-vercel-ip-country-region"] || null,
    city: req.headers["x-vercel-ip-city"] || null
  };

  // -------- LOG --------
  console.log(
    `[PAYOUTCALCULATORS VISITOR] ${ip} | Page: ${page} | ${
      geo.city || "UNKNOWN"
    }, ${geo.regionName || "UNKNOWN"}, ${geo.country || "UNKNOWN"} | From: ${
      referer || origin || "Direct"
    } | UA: ${ua}`
  );

  return res.status(200).json({
    ok: true,
    type: "PAYOUTCALCULATORS_VISITOR",
    host: cleanHost,
    page,
    href,
    ip,
    referer,
    origin,
    userAgent: ua,
    geo
  });
}
