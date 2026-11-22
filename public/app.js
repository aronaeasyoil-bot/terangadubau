// TERANGA DUBAI — interactions légères (menu mobile, onglets, panier, validation). Le site fonctionne sans JavaScript.
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const lang = document.documentElement.lang === "en" ? "en" : "fr";
  const aed = (f) => (f / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " AED";

  // Menu mobile
  const burger = $("[data-menu]"), menu = $("#menu");
  burger?.addEventListener("click", () => {
    const open = burger.getAttribute("aria-expanded") !== "true";
    burger.setAttribute("aria-expanded", open); menu.classList.toggle("open", open);
  });

  // Onglets du moteur de recherche (accessibles au clavier)
  const tabs = $$("[data-tab]");
  const select = (btn, focus) => {
    tabs.forEach((b) => { const on = b === btn; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; $("#panel-" + b.dataset.tab).hidden = !on; });
    if (focus) btn.focus();
    btn.scrollIntoView({ block: "nearest", inline: "nearest" });
  };
  tabs.forEach((b, i) => {
    b.addEventListener("click", () => select(b));
    b.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") select(tabs[(i + 1) % tabs.length], true);
      if (e.key === "ArrowLeft") select(tabs[(i - 1 + tabs.length) % tabs.length], true);
    });
  });

  // Dates : pas de date passée
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  $$('input[type="date"][data-future]').forEach((i) => (i.min = today));

  // Validation douce avant envoi
  $$("form[data-validate]").forEach((f) => f.addEventListener("submit", (e) => {
    let first = null;
    $$("[required]", f).forEach((el) => {
      const ok = el.type === "checkbox" ? el.checked : el.value.trim() !== "" && el.checkValidity();
      el.classList.toggle("invalid", !ok); if (!ok && !first) first = el;
    });
    if (first) { e.preventDefault(); first.focus(); first.scrollIntoView({ block: "center" }); }
  }));

  $$("form[data-confirm]").forEach((f) => f.addEventListener("submit", (e) => { if (!window.confirm(f.dataset.confirm)) e.preventDefault(); }));
  $$("[data-print]").forEach((b) => b.addEventListener("click", () => window.print()));

  // Panier Teranga Food (un panier par restaurant ; les prix sont recalculés côté serveur)
  $$("[data-restaurant]").forEach((box) => {
    const form = $("[data-cart]", box), key = "td-cart-" + box.dataset.restaurant, fee = Number(box.dataset.fee || 0);
    let cart = [];
    try { cart = JSON.parse(sessionStorage.getItem(key) || "[]"); } catch {}
    const save = () => { try { sessionStorage.setItem(key, JSON.stringify(cart)); } catch {} };
    const draw = () => {
      form.hidden = !cart.length;
      const lines = $("[data-lines]", form); lines.textContent = "";
      let sub = 0;
      cart.forEach((c, idx) => {
        sub += c.p * c.qty;
        const li = document.createElement("li");
        const name = document.createElement("span"); name.textContent = c.n + " — " + aed(c.p * c.qty);
        const q = document.createElement("span"); q.className = "qty";
        const minus = document.createElement("button"); minus.type = "button"; minus.textContent = "−"; minus.setAttribute("aria-label", lang === "en" ? "Remove one" : "Retirer un");
        const n = document.createElement("b"); n.textContent = c.qty;
        const plus = document.createElement("button"); plus.type = "button"; plus.textContent = "+"; plus.setAttribute("aria-label", lang === "en" ? "Add one" : "Ajouter un");
        minus.onclick = () => { c.qty--; if (c.qty <= 0) cart.splice(idx, 1); save(); draw(); };
        plus.onclick = () => { if (c.qty < 50) c.qty++; save(); draw(); };
        q.append(minus, n, plus); li.append(name, q); lines.append(li);
      });
      $("[data-sub]", form).textContent = aed(sub);
      $("[data-total]", form).textContent = aed(sub + fee);
      $("[data-cart-json]", form).value = JSON.stringify(cart.map((c) => ({ id: c.id, qty: c.qty })));
    };
    $$("[data-add]", box).forEach((b) => b.addEventListener("click", () => {
      const item = JSON.parse(b.dataset.add);
      const found = cart.find((c) => c.id === item.id);
      if (found) found.qty = Math.min(50, found.qty + 1); else cart.push({ ...item, qty: 1 });
      save(); draw(); form.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }));
    form.addEventListener("submit", () => { try { sessionStorage.removeItem(key); } catch {} });
    draw();
  });
})();
