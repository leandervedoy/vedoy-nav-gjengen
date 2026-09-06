const crypto = require("node:crypto");

const COOKIE_NAME = "nav_gjengen_session";

function parseCookies(header = "") {
  return Object.fromEntries(header.split(";").map((part) => part.trim().split(/=(.*)/s)).filter(([key]) => key));
}

function secret() {
  const value = process.env.NAV_GJENGEN_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("NAV_GJENGEN_SESSION_SECRET mangler.");
  return value;
}

function sign(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verify(token) {
  if (!token) return null;
  const [encoded, supplied] = token.split(".");
  if (!encoded || !supplied) return null;
  const expected = crypto.createHmac("sha256", secret()).update(encoded).digest();
  const actual = Buffer.from(supplied, "base64url");
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  return payload.exp > Math.floor(Date.now() / 1000) ? payload : null;
}

function currentUser(request) {
  try { return verify(parseCookies(request.headers.cookie)[COOKIE_NAME]); } catch { return null; }
}

// Administratorer styres kun av en servervariabel i Vercel. Ingen klient kan
// gjøre seg selv til administrator ved å endre nettleserkode eller en request.
function isAdmin(user) {
  if (!user?.id) return false;
  const allowedIds = String(process.env.NAV_GJENGEN_ADMIN_USER_IDS || "")
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
  return allowedIds.includes(String(user.id).toLowerCase());
}

function sessionCookie(user) {
  const now = Math.floor(Date.now() / 1000);
  const token = sign({ id: user.id, displayName: user.displayName || null, iat: now, exp: now + 3600 });
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600`;
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

module.exports = { clearSessionCookie, currentUser, isAdmin, parseCookies, sessionCookie };
