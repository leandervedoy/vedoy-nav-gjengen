const accessMessage = document.querySelector("#accessMessage");
const form = document.querySelector("#vediForm");
const category = document.querySelector("#vediCategory");
const status = document.querySelector("#adminStatus");
const button = document.querySelector("#vediPublish");

async function loadAdmin() {
  try {
    const response = await fetch("/api/admin-vedi", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Tilgangskontrollen mislyktes.");
    category.innerHTML += data.categories.map((name) => `<option value="${name}">${name}</option>`).join("");
    accessMessage.textContent = `Innlogget med administratortilgang. Avsender: ${data.actor.display_name} (${data.actor.badge}).`;
    form.hidden = false;
  } catch (error) {
    accessMessage.textContent = error.message;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!category.value) { status.textContent = "Velg en kanal."; return; }
  button.disabled = true;
  status.textContent = "Publiserer …";
  try {
    const response = await fetch("/api/admin-vedi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: category.value }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Publisering mislyktes.");
    status.textContent = `Publisert i ${category.value}: «${data.post.title}»`;
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

loadAdmin();
