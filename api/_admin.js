// NAV-gjengen har sin egen rolletabell. Den deles ikke med rollemodellene til
// andre Vedøy-apper, selv om de bruker samme Supabase-prosjekt.
function config() {
  return {
    url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

async function isNavGjengenAdmin(user) {
  if (!user?.id) return false;
  const { url, key } = config();
  if (!url || !key) throw new Error("Supabase-administrasjon er ikke konfigurert.");
  const id = encodeURIComponent(String(user.id));
  const result = await fetch(`${url}/rest/v1/nav_gjengen_roles?user_id=eq.${id}&role=eq.admin&select=user_id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  if (!result.ok) throw new Error("Kunne ikke kontrollere NAV-gjengen-rollen.");
  return (await result.json()).length === 1;
}

function hasSameOrigin(request) {
  const origin = request.headers?.origin;
  if (!origin) return true;
  try { return origin === new URL(process.env.APP_URL).origin; } catch { return false; }
}

module.exports = { hasSameOrigin, isNavGjengenAdmin };
