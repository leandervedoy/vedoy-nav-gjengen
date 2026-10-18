# Vedoy App Algorithm — utviklingsspesifikasjon
Status: første kodeutkast i denne grenen, **ikke produksjonsaktivert**.

## Produkt
- Alle kan lese godkjente offentlige foruminnlegg.
- Brukeren må være logget inn via Vedøy ID for å like, kommentere, lagre, reagere og dele internt.
- Brukeren kan velge anonymt visningsnavn. Interne bruker-ID-er skal aldri være synlige i offentlig API-respons.
- Deling via offentlig lenke skal bare virke for godkjente innlegg. Delte lenker må ikke inneholde private brukerdata.
- Hver tråd kan ha tema, tagger og nøstede svar. Kommentarer trenger egen `is_anonymous`-representasjon og serverkontroll.
- Varselsenteret har fanene **Alle**, **Svar**, **Reaksjoner** og **Viktige**; brukeren kan skru av varsler per type og få stilleperiode.
- For deg: rangerer godkjente innlegg basert på frivillig valgte interesser, likes, kommentarer, lagring, deling, visninger og begrenset lesetid.

## Algoritmen
Kildekode: `lib/vedoy-app-algorithm.js`. Ingen eksterne avhengigheter.
* Lesetid skal kun registreres når appen er synlig og innlegget faktisk er i fokus. Maks 45 sekunder per hendelse.
* Samme innlegg gir høyst 20 tellede hendelser per dag i interesserangeringen. Gamle signaler tones ned.
* «Ikke interessert» er en **hard eksklusjon** for innlegg-ID-en, ikke bare et lite negativt vekttall.
* Menyen åpnes ved langt trykk (>500 ms) eller treprikk-knapp; tilgjengelig også med tastatur og skjermleser.
* Meny: «Ikke interessert», «Skjul tagg», «Følg tagg», «Lagre», «Del», «Rapporter».
* Brukeren kan se «Hvorfor ser jeg dette?», resette anbefalinger, slette historikk og slå av personlig tilpasning.
* Ved avslått profilering: kronologisk feed uten interaksjonssporing.
* Unngå å utlede helse, trygdesituasjon, økonomiske problemer eller andre sensitive forhold fra lesemønster. Siden temaene i denne appen kan røpe sensitive forhold, krever enhver oppmerksomhetsbasert personalisering en særskilt personvernvurdering og egnet gyldig behandlingsgrunnlag før aktivering. Start med eksplisitt valgte tagger.

## Sikkerhet
**Viktig:** Eksisterende `api/posts.js` henter bruker-ID i enkelte API-responser. Før anonym publisering lanseres må offentlige response-felter og joins gjennomgås for lekkasje av bruker-ID og brukernavn.
Serveren skal bruke Vedøy OAuth-sessionen til å identifisere brukeren; ikke stol på `user_id` fra klienten.
RLS på alle nye tabeller. Streng isolasjon fra private NAV-dokumenter og Signal-chat. Ingen blanding mellom private helse-/økonomidata og feedrangering.

## Implementeringsrekkefølge
1. Database: consent/interest/follow, events, feedback, notifications og server-side tilgangskontroll.
2. Anonym publisering og kommentarer: sikker offentlig respons uten forfatter-ID.
3. Logget inn-handlinger: reaksjoner, lagre, del, følg.
4. For deg UI + langt trykk/treprikk «Ikke interessert».
5. Varselsenter, moderering, blokkering og anti-spam.
6. Personvern-/sikkerhetstester, ytelsestester og lanseringskontroll.
