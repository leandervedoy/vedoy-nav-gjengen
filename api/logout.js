const { clearSessionCookie } = require("./_auth");

module.exports = async (request, response) => {
  if (request.method !== "POST") return response.status(405).json({ error: "Metoden støttes ikke." });
  response.setHeader("Set-Cookie", clearSessionCookie());
  return response.status(200).json({ ok: true });
};
