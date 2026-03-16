const MAX_REQUESTS = 10;
const WINDOW_MS = 60 * 1000; // 1 minute

const requests = new Map();

function cleanExpired(now) {
  for (const [ip, entries] of requests) {
    const valid = entries.filter((t) => now - t < WINDOW_MS);
    if (valid.length === 0) {
      requests.delete(ip);
    } else {
      requests.set(ip, valid);
    }
  }
}

function checkRateLimit(ip) {
  const now = Date.now();
  cleanExpired(now);

  const entries = requests.get(ip) || [];
  if (entries.length >= MAX_REQUESTS) {
    return false;
  }

  entries.push(now);
  requests.set(ip, entries);
  return true;
}

function resetRateLimit() {
  requests.clear();
}

module.exports = { checkRateLimit, resetRateLimit, MAX_REQUESTS, WINDOW_MS };
