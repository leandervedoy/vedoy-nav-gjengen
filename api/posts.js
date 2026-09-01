// Vercel Function. Den snakker med Supabase fra serveren og sender aldri
// SUPABASE_SERVICE_ROLE_KEY til klienten.
const getConfig = () => ({
  url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  publicKey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

module.exports = async (request, response) => {
  const { url, publicKey } = getConfig();
  if (!url || !publicKey) return response.status(503).json({ error: "Supabase er ikke konfigurert." });
  if (request.method !== "GET") return response.status(405).json({ error: "Metoden støttes ikke." });
  try {
    const upstream = await fetch(`${url}/rest/v1/posts?select=id,category,title,content,created_at,profiles(username)&order=created_at.desc`, {
      headers: { apikey: publicKey, Authorization: `Bearer ${publicKey}` },
    });
    if (!upstream.ok) return response.status(upstream.status).json({ error: "Kunne ikke hente innlegg." });
    return response.status(200).json({ posts: await upstream.json() });
  } catch {
    return response.status(502).json({ error: "Kunne ikke kontakte databasen." });
  }
};
