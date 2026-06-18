/* ============================================================
   Star Duel — Coin Market page logic
   Renders the live price chart and wires up buy/sell, wallet
   display, sign-in and the admin treasury panel.
   ============================================================ */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const canvas = $("chart");
  const ctx = canvas.getContext("2d");
  let dpr = 1, viewN = 30;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.parentElement.getBoundingClientRect();
    canvas.width = Math.floor(r.width * dpr);
    canvas.height = Math.floor(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }
  window.addEventListener("resize", resize);

  // ---------- Chart ----------
  function draw() {
    const w = canvas.width / dpr, h = canvas.height / dpr;
    ctx.clearRect(0, 0, w, h);

    const hist = Market.history;
    const data = hist.slice(Math.max(0, hist.length - viewN));
    if (data.length < 2) return;

    let min = Math.min(...data), max = Math.max(...data);
    const pad = (max - min) * 0.15 || 1;
    min -= pad; max += pad;
    const up = data[data.length - 1] >= data[0];
    const line = up ? "#38ff9c" : "#ff5a6e";

    const xAt = (i) => (i / (data.length - 1)) * (w - 12) + 6;
    const yAt = (v) => h - 14 - ((v - min) / (max - min)) * (h - 28);

    // grid
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let g = 0; g <= 4; g++) {
      const y = 8 + (g / 4) * (h - 22);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // area fill
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, up ? "rgba(56,255,156,0.28)" : "rgba(255,90,110,0.28)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.beginPath();
    ctx.moveTo(xAt(0), yAt(data[0]));
    for (let i = 1; i < data.length; i++) ctx.lineTo(xAt(i), yAt(data[i]));
    ctx.lineTo(xAt(data.length - 1), h); ctx.lineTo(xAt(0), h); ctx.closePath();
    ctx.fillStyle = grad; ctx.fill();

    // line
    ctx.beginPath();
    ctx.moveTo(xAt(0), yAt(data[0]));
    for (let i = 1; i < data.length; i++) ctx.lineTo(xAt(i), yAt(data[i]));
    ctx.strokeStyle = line; ctx.lineWidth = 2.5;
    ctx.shadowColor = line; ctx.shadowBlur = 10; ctx.stroke();
    ctx.shadowBlur = 0;

    // last dot
    const lx = xAt(data.length - 1), ly = yAt(data[data.length - 1]);
    ctx.fillStyle = line;
    ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI * 2); ctx.fill();
  }

  // ---------- Wallet / price display ----------
  function fmt(n) { return n.toLocaleString(undefined, { maximumFractionDigits: 0 }); }
  function money(n) { return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  function refresh() {
    const u = Wallet.user;
    const price = Market.price;
    $("wCoins").textContent = fmt(u.coins);
    $("wCash").textContent = money(u.cash);
    $("wPortfolio").textContent = money(u.cash + u.coins * price);

    $("priceNow").textContent = money(price);
    const pct = Market.changePct(viewN);
    const el = $("priceChange");
    el.textContent = (pct >= 0 ? "+" : "") + pct.toFixed(2) + "%";
    el.className = "price-change " + (pct >= 0 ? "up" : "down");

    updateCost();
    // admin panel
    const admin = u.isAdmin;
    $("adminPanel").classList.toggle("hidden", !admin);
    if (admin) $("treasuryVal").textContent = fmt(Wallet.treasury);
    $("rewardLbl").textContent = Wallet.WIN_REWARD;

    $("authChip").textContent = u.signedIn ? (u.isAdmin ? "🛡️ " + u.name : "👤 " + u.name) : "Sign in";
  }

  function getQty() { return Math.max(0, Math.floor(+$("qty").value || 0)); }
  function updateCost() {
    const cost = getQty() * Market.price;
    $("costLine").textContent = "Value: " + money(cost);
  }

  function toast(msg, ok) {
    const t = $("toast");
    t.textContent = msg;
    t.className = "toast show " + (ok ? "ok" : "err");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.className = "toast"; }, 1800);
  }

  // ---------- Controls ----------
  $("qty").addEventListener("input", updateCost);
  document.querySelectorAll(".qty-btn").forEach((b) =>
    b.addEventListener("click", () => {
      $("qty").value = Math.max(1, getQty() + (+b.dataset.q));
      updateCost();
    }));
  document.querySelectorAll(".preset").forEach((b) =>
    b.addEventListener("click", () => {
      const pct = +b.dataset.pct;
      // preset based on how many coins the user could buy with cash
      const affordable = Math.floor(Wallet.user.cash / Market.price);
      $("qty").value = Math.max(1, Math.floor(affordable * pct));
      updateCost();
    }));

  $("buyBtn").addEventListener("click", () => {
    const r = Wallet.buyCoins(getQty(), Market.price);
    if (r.ok) toast("Bought " + getQty() + " coins", true);
    else toast(r.reason === "no_cash" ? "Not enough cash" : "Invalid amount", false);
    refresh();
  });
  $("sellBtn").addEventListener("click", () => {
    const r = Wallet.sellCoins(getQty(), Market.price);
    if (r.ok) toast("Sold " + getQty() + " coins", true);
    else toast(r.reason === "no_coins" ? "Not enough coins" : "Invalid amount", false);
    refresh();
  });

  document.querySelectorAll(".range-btn").forEach((b) =>
    b.addEventListener("click", () => {
      document.querySelectorAll(".range-btn").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      viewN = +b.dataset.n;
      draw(); refresh();
    }));

  // ---------- Auth ----------
  $("authChip").addEventListener("click", () => {
    if (Wallet.user.signedIn) { Auth.signOut(); refresh(); }
    else $("authOverlay").classList.remove("hidden");
  });
  $("authClose").addEventListener("click", () => $("authOverlay").classList.add("hidden"));
  $("googleBtn").addEventListener("click", () => {
    Auth.signInLocal($("nameInput").value || "Pilot", false);
    $("authOverlay").classList.add("hidden"); refresh();
  });
  $("adminBtn").addEventListener("click", () => {
    Auth.signInLocal($("nameInput").value || "Admin", true);
    $("authOverlay").classList.add("hidden"); refresh();
  });

  // ---------- Live ticking ----------
  Market.onTick(() => { draw(); refresh(); });
  setInterval(() => Market.tick(), 2000);

  Wallet.onChange(refresh);
  resize();
  refresh();
})();
