const crypto = require("node:crypto");

module.exports = async (request, response) => {
  if (request.method !== "GET") return response.status(405).json({ error: "Metoden støttes ikke." });
  const issuer = process.env.VEDOY_OAUTH_ISSUER || "https://niedmgyyougvgiiuwcvw.supabase.co/auth/v1";
  const clientId = process.env.VEDOY_OAUTH_CLIENT_ID;
  const appUrl = process.env.APP_URL || "https://nav-gjengen.vercel.app";
  if (!clientId) return response.status(503).json({ error: "Vedøy OAuth-klienten er ikke konfigurert." });

  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const state = crypto.randomBytes(32).toString("base64url");
  const destination = new URL(`${issuer.replace(/\/$/, "")}/oauth/authorize`);
  destination.searchParams.set("client_id", clientId);
  destination.searchParams.set("redirect_uri", `${appUrl}/api/auth-callback`);
  destination.searchParams.set("response_type", "code");
  destination.searchParams.set("scope", "openid email profile");
  destination.searchParams.set("state", state);
  destination.searchParams.set("code_challenge", challenge);
  destination.searchParams.set("code_challenge_method", "S256");
  response.setHeader("Set-Cookie", [
    `nav_gjengen_pkce=${verifier}; Path=/api/auth-callback; HttpOnly; Secure; SameSite=Lax; Max-Age=300`,
    `nav_gjengen_state=${state}; Path=/api/auth-callback; HttpOnly; Secure; SameSite=Lax; Max-Age=300`,
  ]);
  return response.redirect(302, destination.toString());
};
