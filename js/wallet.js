/* ============================================================
   Star Duel — Wallet, Treasury & Auth (shared module)
   Used by both the game (index.html) and the trading page
   (trade.html). Right now everything is persisted in
   localStorage. When Firebase is added, only the SAVE/LOAD
   and AUTH sections need to point at Firebase — the rest of
   the game/market code stays the same.

   ── Economy model ────────────────────────────────────────
   • treasury  : a SEPARATE admin-owned reward pool (starts at
                 2,000,000 coins). Match-win rewards are paid
                 OUT OF this pool, NOT the admin's own coins.
   • user.coins: the in-game currency a player owns.
   • user.cash : virtual money used to buy/sell coins on the
                 market (like USD vs BTC).
   ============================================================ */
(function () {
  "use strict";

  const STORE_KEY = "starduel_state_v2";
  const WIN_REWARD = 10;            // coins awarded to a match winner
  const TREASURY_START = 2000000;   // 20 lakh coins in the admin pool

  const DEFAULTS = {
    user: {
      uid: null,
      name: "Guest Pilot",
      email: null,
      photo: null,
      signedIn: false,
      isAdmin: false,
      coins: 0,
      cash: 1000,            // starting virtual cash for trading
    },
    treasury: TREASURY_START,
    stats: { wins: 0, losses: 0 },
  };

  // ---- tiny pub/sub so any screen can react to wallet changes ----
  const listeners = [];
  function emit() { for (const fn of listeners) fn(state); }

  // ---- load / save (swap this section for Firebase later) ----
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULTS));
      const parsed = JSON.parse(raw);
      // merge so new fields appear for old saves
      return Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), parsed, {
        user: Object.assign({}, DEFAULTS.user, parsed.user),
        stats: Object.assign({}, DEFAULTS.stats, parsed.stats),
      });
    } catch (e) {
      return JSON.parse(JSON.stringify(DEFAULTS));
    }
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
    emit();
    // TODO(Firebase): also write user.coins / user.cash / treasury to the
    // database so balances sync across devices in real time.
  }

  let state = load();

  // keep multiple open tabs/pages in sync
  window.addEventListener("storage", function (e) {
    if (e.key === STORE_KEY) { state = load(); emit(); }
  });

  // ---- Wallet API ----
  const Wallet = {
    WIN_REWARD,

    get state() { return state; },
    get user() { return state.user; },
    get treasury() { return state.treasury; },

    onChange(fn) { listeners.push(fn); fn(state); },

    /** Pay the win reward to the current user, OUT OF the admin treasury. */
    awardWin() {
      const amount = WIN_REWARD;
      if (state.treasury < amount) return { ok: false, reason: "treasury_empty" };
      state.treasury -= amount;      // comes from the admin pool, not admin's own coins
      state.user.coins += amount;
      state.stats.wins += 1;
      save();
      return { ok: true, amount, balance: state.user.coins };
    },

    recordLoss() { state.stats.losses += 1; save(); },

    /** Buy `qty` coins at `price` each, paying with virtual cash. */
    buyCoins(qty, price) {
      const cost = qty * price;
      if (qty <= 0) return { ok: false, reason: "bad_qty" };
      if (state.user.cash < cost) return { ok: false, reason: "no_cash" };
      state.user.cash -= cost;
      state.user.coins += qty;
      save();
      return { ok: true };
    },

    /** Sell `qty` coins at `price` each, receiving virtual cash. */
    sellCoins(qty, price) {
      if (qty <= 0) return { ok: false, reason: "bad_qty" };
      if (state.user.coins < qty) return { ok: false, reason: "no_coins" };
      state.user.coins -= qty;
      state.user.cash += qty * price;
      save();
      return { ok: true };
    },

    /** Admin-only: top the treasury up or set balances. */
    adminSetTreasury(value) {
      if (!state.user.isAdmin) return { ok: false, reason: "not_admin" };
      state.treasury = Math.max(0, Math.floor(value));
      save();
      return { ok: true };
    },
  };

  // ---- Auth (Google sign-in stub, Firebase-ready) ----
  const Auth = {
    /**
     * For now this creates a local guest/admin profile. When Firebase Auth
     * is wired up, replace the body with signInWithPopup(googleProvider) and
     * map the result onto state.user (uid, name, email, photo).
     */
    signInLocal(name, asAdmin) {
      state.user.signedIn = true;
      state.user.name = name || "Pilot";
      state.user.uid = "local-" + Math.random().toString(36).slice(2, 9);
      state.user.isAdmin = !!asAdmin;
      // The admin's personal coins are separate; the treasury is the pool.
      save();
      return state.user;
    },

    signOut() {
      const fresh = JSON.parse(JSON.stringify(DEFAULTS.user));
      // keep their coins/cash so progress isn't lost on a local sign-out
      fresh.coins = state.user.coins;
      fresh.cash = state.user.cash;
      state.user = fresh;
      save();
    },

    // TODO(Firebase):
    //   const provider = new GoogleAuthProvider();
    //   signInWithPopup(auth, provider).then(res => { ...map user... save(); });
  };

  window.Wallet = Wallet;
  window.Auth = Auth;
})();
