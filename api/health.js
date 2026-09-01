// Vercel Function: avslører aldri nøkkelverdier, bare om konfigurasjonen finnes.
module.exports = (request, response) => {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  response.status(200).json({ configured: Boolean(url && publicKey) });
};
