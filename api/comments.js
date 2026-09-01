const { currentUser } = require("./_auth");

module.exports = async (request, response) => {
  if (request.method !== "POST") return response.status(405).json({ error: "Metoden støttes ikke." });
  const user = currentUser(request);
  if (!user) return response.status(401).json({ error: "Du må logge inn." });
  const postId = Number(request.body?.postId);
  const content = String(request.body?.content || "").trim().slice(0, 500);
  if (!Number.isInteger(postId) || !content) return response.status(400).json({ error: "Kommentaren er ugyldig." });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return response.status(503).json({ error: "Supabase er ikke konfigurert." });
  const upstream = await fetch(`${url}/rest/v1/comments`, {
    method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ post_id: postId, user_id: user.id, content }),
  });
  if (!upstream.ok) return response.status(502).json({ error: "Kommentaren kunne ikke lagres." });
  return response.status(201).json({ comment: (await upstream.json())[0] });
};
