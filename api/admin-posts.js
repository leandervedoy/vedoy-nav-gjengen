const { currentUser } = require("./_auth");
const { hasSameOrigin, isNavGjengenAdmin } = require("./_admin");

const categories = ["AAP", "Uføretrygd", "Sykepenger", "Dagpenger", "Sosialhjelp", "Tilleggsstønader", "Bostøtte"];
const statuses = ["approved", "review", "blocked"];

function config() {
  return {
    url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

async function supabase(path, { method = "GET", body, prefer = "return=representation" } = {}) {
  const { url, key } = config();
  if (!url || !key) throw new Error("Supabase er ikke konfigurert på serveren.");
  return fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: prefer },
    body: body ? JSON.stringify(body) : undefined,
  });
}

module.exports = async (request, response) => {
  try {
    if (!["PATCH", "DELETE"].includes(request.method)) return response.status(405).json({ error: "Metoden støttes ikke." });
    const user = currentUser(request);
    if (!user) return response.status(401).json({ error: "Du må logge inn." });
    if (!hasSameOrigin(request)) return response.status(403).json({ error: "Ugyldig forespørsel." });
    if (!(await isNavGjengenAdmin(user))) return response.status(403).json({ error: "Du har ikke administratortilgang." });

    const postId = Number(request.body?.postId);
    if (!Number.isSafeInteger(postId) || postId < 1) return response.status(400).json({ error: "Ugyldig innlegg." });

    if (request.method === "DELETE") {
      const deleted = await supabase(`posts?id=eq.${postId}`, { method: "DELETE" });
      if (!deleted.ok) throw new Error("Innlegget kunne ikke slettes.");
      const rows = await deleted.json();
      if (!rows.length) return response.status(404).json({ error: "Innlegget finnes ikke." });
      return response.status(200).json({ deleted: true, postId });
    }

    const title = String(request.body?.title || "").trim();
    const content = String(request.body?.content || "").trim();
    const category = String(request.body?.category || "");
    const moderationStatus = String(request.body?.moderationStatus || "");
    if (!categories.includes(category) || !statuses.includes(moderationStatus) || title.length < 3 || title.length > 110 || content.length < 3 || content.length > 1200) {
      return response.status(400).json({ error: "Kontroller kategori, status, overskrift og tekst." });
    }

    const updated = await supabase(`posts?id=eq.${postId}`, { method: "PATCH", body: {
      category,
      title,
      content,
      moderation_status: moderationStatus,
    } });
    if (!updated.ok) throw new Error("Innlegget kunne ikke oppdateres.");
    const rows = await updated.json();
    if (!rows.length) return response.status(404).json({ error: "Innlegget finnes ikke." });
    return response.status(200).json({ post: rows[0] });
  } catch (error) {
    return response.status(502).json({ error: error instanceof Error ? error.message : "Databasefeil." });
  }
};
