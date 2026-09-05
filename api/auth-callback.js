const { parseCookies, sessionCookie } = require("./_auth");

module.exports = async (request, response) => {
  if (request.method !== "GET") return response.status(405).json({ error: "Metoden støttes ikke." });
  try {
    const cookies = parseCookies(request.headers.cookie);
    const code = String(request.query?.code || "");
    const state = String(request.query?.state || "");
    if (!code || !state || state !== cookies.nav_gjengen_state || !cookies.nav_gjengen_pkce) {
      return response.redirect(302, "/?auth_error=state");
    }
    const issuer = process.env.VEDOY_OAUTH_ISSUER || "https://niedmgyyougvgiiuwcvw.supabase.co/auth/v1";
    const clientId = process.env.VEDOY_OAUTH_CLIENT_ID;
    const appUrl = process.env.APP_URL || "https://nav-gjengen.vercel.app";
    if (!clientId) return response.redirect(302, "/?auth_error=config");

    const tokenResponse = await fetch(`${issuer.replace(/\/$/, "")}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        redirect_uri: `${appUrl}/api/auth-callback`,
        code_verifier: cookies.nav_gjengen_pkce,
      }),
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens.access_token) return response.redirect(302, "/?auth_error=exchange");

    const userResponse = await fetch(`${issuer.replace(/\/$/, "")}/oauth/userinfo`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await userResponse.json();
    if (!userResponse.ok || !profile.sub) return response.redirect(302, "/?auth_error=identity");

    response.setHeader("Set-Cookie", [
      sessionCookie({ id: profile.sub, displayName: profile.preferred_username || profile.name || null }),
      "nav_gjengen_pkce=; Path=/api/auth-callback; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
      "nav_gjengen_state=; Path=/api/auth-callback; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    ]);
    return response.redirect(302, "/?signed_in=1");
  } catch {
    return response.redirect(302, "/?auth_error=config");
  }
};
