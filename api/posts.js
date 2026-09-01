const { currentUser } = require("./_auth");

const config = (admin = false) => ({
  url: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: admin ? process.env.SUPABASE_SERVICE_ROLE_KEY : (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY),
});

async function supabase(path, { admin = false, method = "GET", body, prefer = "return=representation" } = {}) {
  const { url, key } = config(admin);
  if (!url || !key) throw new Error("Supabase er ikke konfigurert.");
  return fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: prefer },
    body: body ? JSON.stringify(body) : undefined,
  });
}

module.exports = async (request, response) => {
  try {
    if (request.method === "GET") {
      const [postsResponse, commentsResponse, votesResponse] = await Promise.all([
        supabase("posts?select=id,user_id,category,title,content,is_anonymous,created_at,profiles(username)&moderation_status=eq.approved&order=created_at.desc"),
        supabase("comments?select=id,post_id,content,created_at,profiles(username)&order=created_at.asc"),
        supabase("post_upvotes?select=post_id"),
      ]);
      if (![postsResponse, commentsResponse, votesResponse].every((item) => item.ok)) throw new Error("Kunne ikke hente forumdata.");
      const [posts, comments, votes] = await Promise.all([postsResponse.json(), commentsResponse.json(), votesResponse.json()]);
      return response.status(200).json({ posts: posts.map((post) => ({
        ...post,
        author: post.is_anonymous ? "Anonym bruker" : (post.profiles?.username || "Vedøy-bruker"),
        comments: comments.filter((comment) => comment.post_id === post.id).map((comment) => ({ ...comment, author: comment.profiles?.username || "Anonym bruker" })),
        upvotes: votes.filter((vote) => vote.post_id === post.id).length,
      })) });
    }

    if (request.method === "POST") {
      const user = currentUser(request);
      if (!user) return response.status(401).json({ error: "Du må logge inn." });
      const { category, title, content, isAnonymous = true } = request.body || {};
      const allowed = ["AAP", "Uføretrygd", "Sykepenger", "Dagpenger", "Sosialhjelp", "Tilleggsstønader", "Bostøtte"];
      if (!allowed.includes(category) || String(title || "").trim().length < 3 || String(content || "").trim().length < 3) {
        return response.status(400).json({ error: "Kontroller tema, overskrift og tekst." });
      }
      await supabase("profiles?on_conflict=id", { admin: true, method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: { id: user.id, username: user.displayName || `bruker-${user.id.slice(0, 8)}` } });
      const created = await supabase("posts", { admin: true, method: "POST", body: {
        user_id: user.id, category, title: String(title).trim().slice(0, 110), content: String(content).trim().slice(0, 1200),
        is_anonymous: Boolean(isAnonymous), moderation_status: "approved", moderation_source: "nav-gjengen-api",
      } });
      if (!created.ok) throw new Error("Innlegget kunne ikke lagres.");
      return response.status(201).json({ post: (await created.json())[0] });
    }

    return response.status(405).json({ error: "Metoden støttes ikke." });
  } catch (error) {
    return response.status(502).json({ error: error instanceof Error ? error.message : "Databasefeil." });
  }
};
