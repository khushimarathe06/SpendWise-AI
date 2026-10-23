// Small process-local limiter for a single-instance development server.
function createRateLimiter({ windowMs, maxRequests, message }) {
  const requestsByClient = new Map();

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [client, entry] of requestsByClient) {
      if (now >= entry.resetAt) requestsByClient.delete(client);
    }
  }, Math.min(windowMs, 60_000));
  cleanup.unref?.();

  return function rateLimit(req, res, next) {
    const client = req.ip || req.socket?.remoteAddress || "unknown";
    const now = Date.now();
    let entry = requestsByClient.get(client);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      requestsByClient.set(client, entry);
    }

    entry.count += 1;
    if (entry.count > maxRequests) {
      const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({ message });
    }

    return next();
  };
}

module.exports = createRateLimiter;
