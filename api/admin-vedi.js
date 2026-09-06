const { currentUser, isAdmin } = require("./_auth");

const categories = ["AAP", "Uføretrygd", "Sykepenger", "Dagpenger", "Sosialhjelp", "Tilleggsstønader", "Bostøtte"];

// Ferdigskrevne, generelle innlegg hindrer at admin-endepunktet blir en fri
// tekstgenerator. Vedi skal invitere til erfaringsdeling, ikke gi vedtaksråd.
const templates = {
  AAP: [
    ["Hva vil du ha med til neste møte?", "En kort liste med spørsmål, viktige datoer og det du ønsker avklaring på kan gjøre møtet mer oversiktlig. Hva har hjulpet deg? Husk at NAV vurderer hver sak individuelt, og sjekk alltid nav.no for offisiell informasjon."],
    ["Hvordan forbereder du en god oppfølgingssamtale?", "Del gjerne tips til hvordan du samler dokumenter og spørsmål før en samtale. Ikke del helseopplysninger eller saksnummer her. Offisielle krav finner du på nav.no."],
    ["Hva gjør ventetiden litt mer håndterbar?", "Mange opplever ventetid som krevende. Hvilke trygge rutiner bruker du for å holde oversikt over beskjeder og frister?"],
  ],
  "Uføretrygd": [
    ["Hvordan holder du oversikt mens saken behandles?", "Et enkelt notat med datoer, spørsmål og mottatte brev kan gi bedre oversikt. Hva har fungert for deg? Unngå å dele personlige saksopplysninger."],
    ["Hvilke spørsmål var nyttige å skrive ned?", "Erfaringer fra andre kan hjelpe deg å forberede spørsmål, men er ikke juridiske råd. Del gjerne hva som gjorde kontakten med NAV tydeligere for deg."],
    ["Hva hjalp deg gjennom en lang prosess?", "Del gjerne praktiske råd om struktur, støttepersoner og egenomsorg. NAV gjør alltid en individuell vurdering."],
  ],
  Sykepenger: [
    ["Hvilke spørsmål tar du med til oppfølgingssamtalen?", "Det kan være nyttig å skrive ned hva du er usikker på før møtet. Hva ønsker du at arbeidsgiver, lege eller NAV skal avklare?"],
    ["Hvordan holder du orden på oppfølging og frister?", "Del gjerne en enkel metode som har hjulpet deg, uten å legge ut helseopplysninger eller andre sensitive detaljer."],
    ["Hva gjør en vanskelig samtale tryggere?", "Noen forbereder stikkord eller tar med en støtteperson når det er mulig. Hva har gitt deg bedre ro og oversikt?"],
  ],
  Dagpenger: [
    ["Hva hjelper deg å huske meldekort og frister?", "Påminnelser og en fast ukentlig rutine kan gi bedre oversikt. Del gjerne det som fungerer for deg, og kontroller alltid gjeldende regler på nav.no."],
    ["Hvordan organiserer du jobbsøkingen?", "En enkel oversikt over søknader, svar og avtaler kan være nyttig. Hvilken metode har fungert best for deg?"],
    ["Hva skulle du visst da du søkte dagpenger?", "Del erfaringer om selve prosessen, men unngå konkrete person- og saksopplysninger. Reglene kan endres og vurderes individuelt."],
  ],
  Sosialhjelp: [
    ["Hva skulle du ønske du visste før første søknad?", "Del gjerne erfaringer om prosessen og hvordan du forberedte spørsmål. Ikke legg ut økonomiske detaljer, fødselsnummer eller saksnummer."],
    ["Hvordan forbereder du en samtale med NAV-kontoret?", "En liste over det du trenger svar på kan gjøre samtalen enklere. Hva har hjulpet deg til å bli hørt?"],
    ["Hvor finner du støtte når situasjonen haster?", "Del gjerne trygge, offentlige kontaktpunkter og erfaringer. Ved akutt fare må du kontakte nødetatene; forumet erstatter ikke profesjonell hjelp."],
  ],
  "Tilleggsstønader": [
    ["Hvilke utgifter er vanskelige å forstå?", "Del gjerne hvilke begreper eller deler av søknadsprosessen du ønsker forklart av andre. Sjekk nav.no for de offisielle vilkårene."],
    ["Hvordan samler du dokumentasjon på en ryddig måte?", "Noen bruker en enkel mappe eller sjekkliste. Hva fungerer for deg uten at du deler dokumentene eller sensitive opplysninger her?"],
    ["Hva bør man spørre om før man søker?", "Erfaringsdeling kan gi ideer til gode spørsmål, men NAV avgjør hver sak individuelt. Hva ville du spurt om?"],
  ],
  "Bostøtte": [
    ["Hvordan følger du med på inntektsendringer og frister?", "En fast påminnelse kan gjøre det lettere å kontrollere opplysninger. Del gjerne rutinen din, og sjekk alltid Husbanken og nav.no for offisiell informasjon."],
    ["Hva gjorde søknaden om bostøtte mer oversiktlig?", "Del gjerne erfaringer med forberedelse og spørsmål, men ikke publiser inntektsopplysninger, adresse eller dokumenter."],
    ["Hvor sjekker du at opplysningene er oppdaterte?", "Regler og beregninger kan variere. Fortell gjerne hvordan du holder oversikt, og bruk Husbanken som offisiell kilde for bostøtte."],
  ],
};

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

async function getVedi() {
  const result = await supabase("forum_actors?slug=eq.vedi&select=id,display_name,badge,is_ai&limit=1");
  if (!result.ok) throw new Error("Kunne ikke hente Vedi-brukeren.");
  const [vedi] = await result.json();
  if (!vedi) throw new Error("Vedi-brukeren mangler i databasen.");
  return vedi;
}

module.exports = async (request, response) => {
  try {
    const user = currentUser(request);
    if (!user) return response.status(401).json({ error: "Du må logge inn." });
    if (!isAdmin(user)) return response.status(403).json({ error: "Du har ikke administratortilgang." });

    const vedi = await getVedi();
    if (request.method === "GET") {
      return response.status(200).json({ authorized: true, categories, actor: vedi });
    }

    if (request.method === "POST") {
      const category = String(request.body?.category || "");
      if (!categories.includes(category)) return response.status(400).json({ error: "Velg en gyldig kategori." });

      const countResult = await supabase(`posts?actor_id=eq.${encodeURIComponent(vedi.id)}&category=eq.${encodeURIComponent(category)}&select=id`);
      if (!countResult.ok) throw new Error("Kunne ikke finne neste Vedi-innlegg.");
      const existing = await countResult.json();
      const [title, content] = templates[category][existing.length % templates[category].length];

      const created = await supabase("posts", { method: "POST", body: {
        actor_id: vedi.id,
        category,
        title,
        content,
        is_anonymous: false,
        moderation_status: "approved",
        moderation_source: "vedi-admin",
      } });
      if (!created.ok) throw new Error("Vedi-innlegget kunne ikke publiseres.");
      return response.status(201).json({ post: (await created.json())[0] });
    }

    return response.status(405).json({ error: "Metoden støttes ikke." });
  } catch (error) {
    return response.status(502).json({ error: error instanceof Error ? error.message : "Databasefeil." });
  }
};
