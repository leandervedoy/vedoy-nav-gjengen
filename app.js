// Disse postene brukes bare som en lesbar reserve dersom Supabase er utilgjengelig.
const categories = ["Alle", "AAP", "Uføretrygd", "Sykepenger", "Dagpenger", "Sosialhjelp", "Tilleggsstønader", "Bostøtte"];
const editableCategories = categories.slice(1);
let activeCategory = "Alle";
let sortMode = "newest";
let isAuthenticated = false;
let isAdmin = false;
let showHidden = false;
let livePostsLoaded = false;
let currentUser = null;
let posts = [
  { id: 1, category: "AAP", title: "Hva bør jeg ha klart til neste møte med NAV?", content: "Jeg skal til nytt oppfølgingsmøte og vil gjerne møte godt forberedt. Hva har dere opplevd at det er nyttig å ta med av dokumentasjon eller spørsmål?", author: "Anonym bruker", createdAt: "I dag", moderationStatus: "approved", upvotes: 18, comments: ["Skriv ned det du vil spørre om på forhånd. Det hjalp meg mye.", "Ta gjerne med en person du stoler på hvis det føles trygt."] },
  { id: 2, category: "Bostøtte", title: "Endring i inntekt – når bør jeg melde fra?", content: "Inntekten min kan endre seg litt neste måned. Noen som har erfaring med hva som er lurt å oppdatere og hvor?", author: "Haugalending", createdAt: "I går", moderationStatus: "approved", upvotes: 9, comments: ["Jeg ville sjekket informasjonen direkte hos Husbanken før du gjør endringer."] },
  { id: 3, category: "Sykepenger", title: "Tips til å holde oversikt over frister", content: "Jeg samler brev, datoer og spørsmål i ett notat. Det gjør at jeg føler mer ro før samtaler og søknader.", author: "Erfaringsdeler", createdAt: "2 dager siden", moderationStatus: "approved", upvotes: 27, comments: [] },
];
const samplePosts = posts;
const $ = (selector) => document.querySelector(selector);

function escapeHtml(value) {
  const node = document.createElement("div");
  node.textContent = value;
  return node.innerHTML;
}

function postsAllowedByAdminFilter() {
  return posts.filter((post) => !isAdmin || showHidden || post.moderationStatus === "approved");
}

function renderCategories() {
  const countable = postsAllowedByAdminFilter();
  const list = $("#categoryList");
  list.innerHTML = "";
  categories.forEach((category) => {
    const count = category === "Alle" ? countable.length : countable.filter((post) => post.category === category).length;
    const item = document.createElement("li");
    item.innerHTML = `<button class="category-button ${activeCategory === category ? "active" : ""}" type="button"><span>${category}</span><span class="category-count">${count}</span></button>`;
    item.querySelector("button").addEventListener("click", () => { activeCategory = category; render(); });
    list.append(item);
  });
  $("#postCategory").innerHTML = '<option value="">Velg tema</option>' + editableCategories.map((category) => `<option>${category}</option>`).join("");
}

function showAdminMessage(message) {
  $("#adminFeedStatus").textContent = message;
}

async function adminRequest(method, body) {
  const response = await fetch("/api/admin-posts", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Adminhandlingen mislyktes.");
  return data;
}

function postPayload(post, changes = {}) {
  return {
    postId: post.id,
    category: post.category,
    title: post.title,
    content: post.content,
    moderationStatus: post.moderationStatus || "approved",
    ...changes,
  };
}

function openAdminEditor(post) {
  const form = $("#adminPostForm");
  form.dataset.postId = post.id;
  $("#adminPostTitle").value = post.title;
  $("#adminPostContent").value = post.content;
  $("#adminPostCategory").value = post.category;
  $("#adminPostStatus").value = post.moderationStatus || "approved";
  $("#adminEditStatus").textContent = "";
  $("#postAdminDialog").showModal();
}

function attachAdminControls(article, post) {
  if (!isAdmin || !livePostsLoaded) return;
  const actions = article.querySelector(".post-admin-actions");
  actions.hidden = false;
  actions.querySelector(".admin-edit-button").addEventListener("click", () => openAdminEditor(post));

  const toggle = actions.querySelector(".admin-toggle-button");
  const isPublished = post.moderationStatus === "approved";
  toggle.textContent = isPublished ? "Skjul" : "Publiser";
  toggle.addEventListener("click", async () => {
    try {
      await adminRequest("PATCH", postPayload(post, { moderationStatus: isPublished ? "blocked" : "approved" }));
      showAdminMessage(isPublished ? "Innlegget er skjult." : "Innlegget er publisert.");
      await loadPosts();
    } catch (error) { showAdminMessage(error.message); }
  });

  actions.querySelector(".admin-delete-button").addEventListener("click", async () => {
    if (!window.confirm(`Slette «${post.title}» permanent? Kommentarer og stemmer slettes også.`)) return;
    try {
      await adminRequest("DELETE", { postId: post.id });
      showAdminMessage("Innlegget er slettet permanent.");
      await loadPosts();
    } catch (error) { showAdminMessage(error.message); }
  });
}

function render() {
  renderCategories();
  const feed = $("#feed");
  const visible = postsAllowedByAdminFilter()
    .filter((post) => activeCategory === "Alle" || post.category === activeCategory)
    .sort((a, b) => sortMode === "popular" ? b.upvotes - a.upvotes : b.id - a.id);
  feed.innerHTML = "";
  $("#feedDescription").textContent = activeCategory === "Alle" ? "De nyeste erfaringene fra fellesskapet." : `Innlegg om ${activeCategory}.`;
  $("#emptyState").hidden = visible.length !== 0;

  visible.forEach((post, index) => {
    const fragment = $("#postTemplate").content.cloneNode(true);
    const article = fragment.querySelector("article");
    article.classList.add("post-enter");
    article.style.animationDelay = `${Math.min(index * 45, 180)}ms`;
    article.dataset.id = post.id;
    article.querySelector(".tag").textContent = post.category;
    article.querySelector(".post-author").textContent = post.author;
    article.querySelector("time").textContent = post.createdAt;
    article.querySelector("h3").textContent = post.title;
    article.querySelector(".post-content").textContent = post.content;

    const aiBadge = article.querySelector(".author-badge");
    if (post.isAi && post.authorBadge) {
      aiBadge.textContent = post.authorBadge;
      aiBadge.hidden = false;
      article.classList.add("ai-post");
    }
    if (isAdmin && post.moderationStatus !== "approved") {
      const statusBadge = article.querySelector(".moderation-badge");
      statusBadge.textContent = post.moderationStatus === "review" ? "Til vurdering" : "Skjult";
      statusBadge.hidden = false;
      article.classList.add("is-hidden-post");
    }
    attachAdminControls(article, post);

    const requireLogin = () => {
      if (!isAuthenticated) { $("#authDialog").showModal(); return true; }
      return false;
    };
    const help = article.querySelector(".help-button");
    help.querySelector("strong").textContent = post.upvotes;
    help.addEventListener("click", async () => {
      if (requireLogin() || help.classList.contains("is-helpful")) return;
      const response = await fetch("/api/upvotes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: post.id }) });
      if (response.ok) { post.upvotes += 1; help.querySelector("strong").textContent = post.upvotes; help.classList.add("is-helpful"); }
    });

    const commentButton = article.querySelector(".comment-button");
    const comments = article.querySelector(".comments");
    const commentList = article.querySelector(".comment-list");
    const paintComments = () => {
      commentList.innerHTML = post.comments.map((comment) => `<div class="comment"><strong>${escapeHtml(comment.author || "Anonym bruker")}</strong><br>${escapeHtml(comment.content || comment)}</div>`).join("");
      commentButton.querySelector("strong").textContent = post.comments.length;
    };
    paintComments();
    commentButton.addEventListener("click", () => { if (!requireLogin()) comments.hidden = !comments.hidden; });
    article.querySelector(".comment-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      if (requireLogin()) return;
      const input = event.currentTarget.querySelector("input");
      const content = input.value.trim();
      const check = await moderateText("Kommentar", content);
      if (check.decision !== "allow") { window.alert(check.reason); return; }
      const response = await fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: post.id, content }) });
      if (response.ok) { post.comments.push({ content, author: "Anonym bruker" }); input.value = ""; paintComments(); }
    });
    feed.append(fragment);
  });
}

async function moderateText(title, content) {
  const response = await fetch("/api/moderate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, content }) });
  if (!response.ok) throw new Error("Modereringstjenesten er midlertidig utilgjengelig.");
  return response.json();
}

$("#postForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isAuthenticated) { $("#authDialog").showModal(); return; }
  const title = $("#postTitle").value.trim();
  const content = $("#postContent").value.trim();
  const category = $("#postCategory").value;
  if (!category) { $("#moderationStatus").textContent = "Velg et tema før du publiserer."; return; }
  const button = $("#publishButton");
  button.disabled = true;
  button.textContent = "Vedi sjekker …";
  $("#moderationStatus").textContent = "Teksten sikkerhetssjekkes før publisering.";
  try {
    const result = await moderateText(title, content);
    if (result.decision !== "allow") { $("#moderationStatus").textContent = result.reason; return; }
    const created = await fetch("/api/posts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, title, content, isAnonymous: $("#postAnonymously").checked }) });
    if (!created.ok) throw new Error((await created.json()).error || "Innlegget kunne ikke lagres.");
    event.currentTarget.reset();
    $("#postAnonymously").checked = true;
    $("#moderationStatus").textContent = result.vediUsed ? "Godkjent av sikkerhetsfilteret og Vedi KI." : "Godkjent av sikkerhetsfilteret.";
    activeCategory = "Alle";
    sortMode = "newest";
    $("#sortMenu").value = "newest";
    await loadPosts();
  } catch (error) { $("#moderationStatus").textContent = error.message; }
  finally { button.disabled = false; button.textContent = "Sjekk og publiser"; }
});

$("#adminPostCategory").innerHTML = editableCategories.map((category) => `<option>${category}</option>`).join("");
$("#adminPostForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const post = posts.find((item) => String(item.id) === event.currentTarget.dataset.postId);
  if (!post) return;
  const changes = {
    title: $("#adminPostTitle").value.trim(),
    content: $("#adminPostContent").value.trim(),
    category: $("#adminPostCategory").value,
    moderationStatus: $("#adminPostStatus").value,
  };
  const submit = event.currentTarget.querySelector("button[type=submit]");
  submit.disabled = true;
  try {
    if (changes.moderationStatus === "approved") {
      const check = await moderateText(changes.title, changes.content);
      if (check.decision !== "allow") { $("#adminEditStatus").textContent = check.reason; return; }
    }
    await adminRequest("PATCH", postPayload(post, changes));
    $("#postAdminDialog").close();
    showAdminMessage("Endringene er lagret.");
    await loadPosts();
  } catch (error) { $("#adminEditStatus").textContent = error.message; }
  finally { submit.disabled = false; }
});

$("#showHiddenPosts").addEventListener("change", (event) => { showHidden = event.target.checked; render(); });
$("#closeAdminPost").addEventListener("click", () => $("#postAdminDialog").close());
$("#sortMenu").addEventListener("change", (event) => { sortMode = event.target.value; render(); });
$("#loginButton").addEventListener("click", () => { if (!isAuthenticated) $("#authDialog").showModal(); });
$("#closeAuth").addEventListener("click", () => $("#authDialog").close());
$("#authForm").addEventListener("submit", (event) => { event.preventDefault(); window.location.assign(window.VEDOY_OAUTH_URL || "/api/auth-start"); });
$("#signupButton").addEventListener("click", async () => {
  if (!isAuthenticated) { $("#authDialog").showModal(); return; }
  await fetch("/api/logout", { method: "POST" });
  window.location.reload();
});

async function loadSession() {
  try {
    const response = await fetch("/api/session", { cache: "no-store" });
    const data = await response.json();
    isAuthenticated = Boolean(data.authenticated);
    isAdmin = Boolean(data.isAdmin);
    currentUser = data.user || null;
    $("#loginButton").textContent = isAuthenticated ? (currentUser?.displayName || "Min konto") : "Logg inn";
    $("#signupButton").textContent = isAuthenticated ? "Logg ut" : "Opprett konto";
    $("#adminFeedTools").hidden = !isAdmin;
  } catch { isAuthenticated = false; isAdmin = false; currentUser = null; }
}

async function loadPosts() {
  try {
    const response = await fetch("/api/posts", { cache: "no-store" });
    if (!response.ok) throw new Error("Fallback til demo.");
    const data = await response.json();
    if (!Array.isArray(data.posts)) throw new Error("Ugyldig respons.");
    posts = data.posts.map((post) => ({
      id: post.id,
      category: post.category,
      title: post.title,
      content: post.content,
      author: post.author || "Anonym bruker",
      authorBadge: post.authorBadge || null,
      isAi: Boolean(post.isAi),
      moderationStatus: post.moderationStatus || "approved",
      createdAt: new Date(post.created_at).toLocaleDateString("no-NO"),
      upvotes: Number(post.upvotes || 0),
      comments: Array.isArray(post.comments) ? post.comments : [],
    }));
    livePostsLoaded = true;
  } catch {
    posts = samplePosts;
    livePostsLoaded = false;
    if (isAdmin) showAdminMessage("Databaseinnlegg kunne ikke lastes. Adminhandlinger er slått av.");
  }
  render();
}

async function initialise() {
  await loadSession();
  await loadPosts();
}

initialise();
