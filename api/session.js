const { currentUser } = require("./_auth");
const { isNavGjengenAdmin } = require("./_admin");

module.exports = async (request, response) => {
  if (request.method !== "GET") return response.status(405).json({ error: "Metoden støttes ikke." });
  const user = currentUser(request);
  let isAdmin = false;
  if (user) {
    // Feil i rollekontrollen skal aldri gi tilgang ved et uhell.
    try { isAdmin = await isNavGjengenAdmin(user); } catch { isAdmin = false; }
  }
  return response.status(200).json({
    authenticated: Boolean(user),
    isAdmin,
    user: user ? { id: user.id, displayName: user.displayName } : null,
  });
};
