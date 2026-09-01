const { currentUser } = require("./_auth");

module.exports = async (request, response) => {
  if (request.method !== "GET") return response.status(405).json({ error: "Metoden støttes ikke." });
  const user = currentUser(request);
  return response.status(200).json({ authenticated: Boolean(user), user: user ? { id: user.id, displayName: user.displayName } : null });
};
