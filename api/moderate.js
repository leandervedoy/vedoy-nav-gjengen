// Server-side moderering. Grunnfilteret virker uten eksterne tjenester.
// Når VEDI_MODERATION_URL er satt, brukes Vedi som et ekstra vurderingslag.
const normalise = (value) => String(value || "").normalize("NFKC").toLowerCase();

const patterns = {
  personalData: [
    /\b\d{6}\s?\d{5}\b/, // mulig norsk fødselsnummer
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
    /\b(?:personnummer|fødselsnummer|saksnummer)\s*[:#-]?\s*[a-z0-9-]{5,}\b/i,
  ],
  threat: [
    /\b(?:jeg|vi)\s+(?:skal|kommer til å)\s+(?:drepe|skade|ta)\s+(?:deg|dere|ham|henne)\b/i,
    /\bdu\s+(?:burde|fortjener å)\s+(?:dø|bli skadet)\b/i,
  ],
  abuse: [
    /\b(?:din|du er(?: en)?)\s+(?:idiot|taper|ekkel|ubrukelig|dum)\b/i,
    /\bhold kjeft\b/i,
    /\b(?:ingen|alle)\s+(?:som deg|dere)\s+(?:fortjener|burde)\b/i,
  ],
};

function localModeration(text) {
  if (patterns.personalData.some((pattern) => pattern.test(text))) return { decision: "block", reason: "Teksten ser ut til å inneholde personopplysninger. Fjern dem før du publiserer.", source: "safety-filter" };
  if (patterns.threat.some((pattern) => pattern.test(text))) return { decision: "block", reason: "Teksten inneholder formuleringer som kan oppfattes som trusler.", source: "safety-filter" };
  if (patterns.abuse.some((pattern) => pattern.test(text))) return { decision: "review", reason: "Skriv om personangrepet på en roligere og saklig måte.", source: "safety-filter" };
  const links = text.match(/https?:\/\//gi)?.length || 0;
  if (links > 3 || /(.)\1{8,}/u.test(text)) return { decision: "review", reason: "Teksten ligner spam. Forkort eller rydd opp før publisering.", source: "safety-filter" };
  return { decision: "allow", reason: "Ingen tydelige brudd ble funnet.", source: "safety-filter" };
}

async function askVedi(text) {
  const endpoint = process.env.VEDI_MODERATION_URL;
  if (!endpoint) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(process.env.VEDI_API_KEY ? { Authorization: `Bearer ${process.env.VEDI_API_KEY}` } : {}) },
      body: JSON.stringify({ task: "forum_moderation", language: "no", text }),
      signal: controller.signal,
    });
    if (!upstream.ok) return null;
    const result = await upstream.json();
    if (!["allow", "review", "block"].includes(result.decision)) return null;
    return { decision: result.decision, reason: String(result.reason || "Vedi har vurdert teksten."), source: "vedi" };
  } catch { return null; } finally { clearTimeout(timeout); }
}

async function moderateContent(rawTitle, rawContent) {
  const title = normalise(rawTitle).slice(0, 110);
  const content = normalise(rawContent).slice(0, 1200);
  if (!title || !content) return { decision: "block", reason: "Overskrift og innlegg er påkrevd.", source: "safety-filter", vediUsed: false };
  const text = `${title}\n${content}`;
  const local = localModeration(text);
  if (local.decision === "block") return { ...local, vediUsed: false };
  const vedi = await askVedi(text);
  const result = vedi && (vedi.decision === "block" || (vedi.decision === "review" && local.decision === "allow")) ? vedi : local;
  return { ...result, vediUsed: Boolean(vedi) };
}

async function handler(request, response) {
  if (request.method !== "POST") return response.status(405).json({ error: "Metoden støttes ikke." });
  const result = await moderateContent(request.body?.title, request.body?.content);
  if (!request.body?.title || !request.body?.content) return response.status(400).json({ error: result.reason });
  return response.status(200).json(result);
}

module.exports = handler;
module.exports.moderateContent = moderateContent;
