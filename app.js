// NAV-gjengen er foreløpig en frontend-demo. I en produksjonsversjon byttes
// dataene og funksjonene under med kall til en backend, for eksempel Supabase.
const categories = ["Alle", "AAP", "Uføretrygd", "Sykepenger", "Dagpenger", "Sosialhjelp", "Tilleggsstønader", "Bostøtte"];
let activeCategory = "Alle", sortMode = "newest";
let posts = [
  {id:1,category:"AAP",title:"Hva bør jeg ha klart til neste møte med NAV?",content:"Jeg skal til nytt oppfølgingsmøte og vil gjerne møte godt forberedt. Hva har dere opplevd at det er nyttig å ta med av dokumentasjon eller spørsmål?",author:"Anonym bruker",createdAt:"I dag",upvotes:18,comments:["Skriv ned det du vil spørre om på forhånd. Det hjalp meg mye.","Ta gjerne med en person du stoler på hvis det føles trygt."]},
  {id:2,category:"Bostøtte",title:"Endring i inntekt – når bør jeg melde fra?",content:"Inntekten min kan endre seg litt neste måned. Noen som har erfaring med hva som er lurt å oppdatere og hvor?",author:"Haugalending",createdAt:"I går",upvotes:9,comments:["Jeg ville sjekket informasjonen direkte hos Husbanken før du gjør endringer."]},
  {id:3,category:"Sykepenger",title:"Tips til å holde oversikt over frister",content:"Jeg samler brev, datoer og spørsmål i ett notat. Det gjør at jeg føler mer ro før samtaler og søknader.",author:"Erfaringsdeler",createdAt:"2 dager siden",upvotes:27,comments:[]},
  {id:4,category:"Uføretrygd",title:"Erfaring med ventetid etter søknad",content:"Jeg vet at saker er ulike, men ønsker å høre hvordan andre holdt oversikt mens de ventet på svar.",author:"TryggtAnonym",createdAt:"4 dager siden",upvotes:14,comments:[]}
];
const $ = (selector) => document.querySelector(selector);
// Settes kun av en server-kontrollert Vedøy Login-callback. En statisk demo kan
// derfor ikke utgi seg for å være innlogget.
const isAuthenticated = false;
const samplePosts = posts;

function escapeHtml(value) { const node = document.createElement("div"); node.textContent = value; return node.innerHTML; }
function renderCategories() {
  const list = $("#categoryList"); list.innerHTML = "";
  categories.forEach((category) => { const count = category === "Alle" ? posts.length : posts.filter(p => p.category === category).length; const li = document.createElement("li"); li.innerHTML = `<button class="category-button ${activeCategory === category ? "active" : ""}" type="button"><span>${category}</span><span class="category-count">${count}</span></button>`; li.querySelector("button").addEventListener("click", () => { activeCategory = category; render(); }); list.append(li); });
  const select = $("#postCategory"); select.innerHTML = '<option value="">Velg tema</option>' + categories.slice(1).map(c => `<option>${c}</option>`).join("");
}
function render() {
  renderCategories(); const feed = $("#feed"); const visible = posts.filter(p => activeCategory === "Alle" || p.category === activeCategory).sort((a,b) => sortMode === "popular" ? b.upvotes - a.upvotes : b.id - a.id); feed.innerHTML = "";
  $("#feedDescription").textContent = activeCategory === "Alle" ? "De nyeste erfaringene fra fellesskapet." : `Innlegg om ${activeCategory}.`;
  $("#emptyState").hidden = visible.length !== 0;
  visible.forEach((post, index) => { const card = $("#postTemplate").content.cloneNode(true); const article = card.querySelector("article"); article.classList.add("post-enter"); article.style.animationDelay = `${Math.min(index * 45, 180)}ms`; article.dataset.id = post.id; article.querySelector(".tag").textContent = post.category; article.querySelector("time").textContent = `${post.author} · ${post.createdAt}`; article.querySelector("h3").textContent = post.title; article.querySelector(".post-content").textContent = post.content; const requireLogin = () => { if (!isAuthenticated) { $("#authDialog").showModal(); return true; } return false; }; const help = article.querySelector(".help-button"); help.querySelector("strong").textContent = post.upvotes; help.addEventListener("click", () => { if (requireLogin()) return; if (!help.classList.contains("is-helpful")) { post.upvotes++; help.querySelector("strong").textContent = post.upvotes; help.classList.add("is-helpful"); } }); const commentButton = article.querySelector(".comment-button"); commentButton.querySelector("strong").textContent = post.comments.length; const comments = article.querySelector(".comments"); commentButton.addEventListener("click", () => { if (requireLogin()) return; comments.hidden = !comments.hidden; }); const commentList = article.querySelector(".comment-list"); const paintComments = () => { commentList.innerHTML = post.comments.map(c => `<div class="comment"><strong>Anonym bruker</strong><br>${escapeHtml(c)}</div>`).join(""); commentButton.querySelector("strong").textContent = post.comments.length; }; paintComments(); article.querySelector(".comment-form").addEventListener("submit", e => { e.preventDefault(); if (requireLogin()) return; const input = e.currentTarget.querySelector("input"); post.comments.push(input.value.trim()); input.value = ""; paintComments(); }); feed.append(card); });
}
async function moderateText(title, content) {
  const response = await fetch("/api/moderate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, content }) });
  if (!response.ok) throw new Error("Modereringstjenesten er midlertidig utilgjengelig.");
  return response.json();
}

$("#postForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isAuthenticated) { $("#authDialog").showModal(); return; }
  const title = $("#postTitle").value.trim(), content = $("#postContent").value.trim(), category = $("#postCategory").value;
  if (!category) { $("#moderationStatus").textContent = "Velg et tema før du publiserer."; return; }
  const button = $("#publishButton"); button.disabled = true; button.textContent = "Vedi sjekker …"; $("#moderationStatus").textContent = "Teksten sikkerhetssjekkes før publisering.";
  try {
    const result = await moderateText(title, content);
    if (result.decision !== "allow") { $("#moderationStatus").textContent = result.reason; return; }
    posts.unshift({id:Date.now(),category,title,content,author:$("#postAnonymously").checked ? "Anonym bruker" : "Deg",createdAt:"Akkurat nå",upvotes:0,comments:[]});
    event.currentTarget.reset(); $("#postAnonymously").checked = true; $("#moderationStatus").textContent = result.vediUsed ? "Godkjent av sikkerhetsfilteret og Vedi KI." : "Godkjent av sikkerhetsfilteret."; activeCategory = "Alle"; sortMode = "newest"; $("#sortMenu").value = "newest"; render();
  } catch (error) { $("#moderationStatus").textContent = error.message; }
  finally { button.disabled = false; button.textContent = "Sjekk og publiser"; }
});
$("#sortMenu").addEventListener("change", e => { sortMode = e.target.value; render(); });
[$("#loginButton"), $("#signupButton")].forEach(button => button.addEventListener("click", () => $("#authDialog").showModal()));
$("#closeAuth").addEventListener("click", () => $("#authDialog").close());
$("#authForm").addEventListener("submit", (event) => { event.preventDefault(); const loginUrl = window.VEDOY_LOGIN_URL; if (!loginUrl) { $("#authStatus").textContent = "Vedøy Login må konfigureres på serveren før innlogging kan aktiveres."; return; } const returnUrl = `${window.location.origin}${window.location.pathname}`; window.location.assign(`${loginUrl}?next=${encodeURIComponent(returnUrl)}&consent_version=2026-09-01`); });
async function loadPosts() {
  try {
    const response = await fetch("/api/posts");
    if (!response.ok) throw new Error("Fallback til demo.");
    const data = await response.json();
    if (!Array.isArray(data.posts)) throw new Error("Ugyldig respons.");
    posts = data.posts.map((post) => ({
      id: post.id, category: post.category, title: post.title, content: post.content,
      author: post.profiles?.username || "Anonym bruker", createdAt: new Date(post.created_at).toLocaleDateString("no-NO"),
      upvotes: 0, comments: [],
    }));
  } catch { posts = samplePosts; }
  render();
}
loadPosts();
