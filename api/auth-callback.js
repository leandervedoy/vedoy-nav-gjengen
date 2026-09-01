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
    const loginUrl = new URL(process.env.VEDOY_LOGIN_URL);
    const appUrl = process.env.APP_URL || "https://nav-gjengen.vercel.app";
    const tokenResponse = await fetch(new URL("/api/vedoy-login/token", loginUrl.origin), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        codeVerifier: cookies.nav_gjengen_pkce,
        clientId: "nav-gjengen",
        redirectUri: `${appUrl}/api/auth-callback`,
      }),
    });
    const result = await tokenResponse.json();
    if (!tokenResponse.ok || !result.user?.id) return response.redirect(302, "/?auth_error=exchange");
    response.setHeader("Set-Cookie", [
      sessionCookie(result.user),
      "nav_gjengen_pkce=; Path=/api/auth-callback; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
      "nav_gjengen_state=; Path=/api/auth-callback; HttpOnly; Secure; SameSite=Lax; Max-Age=0",
    ]);
    return response.redirect(302, "/?signed_in=1");
  } catch {
    return response.redirect(302, "/?auth_error=config");
  }
};
