const crypto = require("node:crypto");

module.exports = async (request, response) => {
  if (request.method !== "GET") return response.status(405).json({ error: "Metoden støttes ikke." });
  const loginUrl = process.env.VEDOY_LOGIN_URL;
  const appUrl = process.env.APP_URL || "https://nav-gjengen.vercel.app";
  if (!loginUrl) return response.status(503).json({ error: "Vedøy Login er ikke konfigurert." });

  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const state = crypto.randomBytes(32).toString("base64url");
  const destination = new URL(loginUrl);
  destination.searchParams.set("client_id", "nav-gjengen");
  destination.searchParams.set("redirect_uri", `${appUrl}/api/auth-callback`);
  destination.searchParams.set("state", state);
  destination.searchParams.set("code_challenge", challenge);
  destination.searchParams.set("code_challenge_method", "S256");
  response.setHeader("Set-Cookie", [
    `nav_gjengen_pkce=${verifier}; Path=/api/auth-callback; HttpOnly; Secure; SameSite=Lax; Max-Age=300`,
    `nav_gjengen_state=${state}; Path=/api/auth-callback; HttpOnly; Secure; SameSite=Lax; Max-Age=300`,
  ]);
  return response.redirect(302, destination.toString());
};
