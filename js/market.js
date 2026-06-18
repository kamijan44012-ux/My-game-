/* ============================================================
   Star Duel — Coin Market engine
   Simulates a live, BTC/ETH-style price for the in-game coin:
   a random walk with mild mean-reversion and the occasional
   spike. History is persisted so the chart stays continuous
   between visits.

   When Firebase is added, replace the local tick with a shared
   price written by a server/Cloud Function, and have every
   client just READ it — so all players see the SAME real-time
   chart. The drawing + buy/sell code stays unchanged.
   ============================================================ */
(function () {
  "use strict";

  const MKEY = "starduel_market_v1";
  const MAX_POINTS = 180;       // points kept in history
  const BASE = 12.5;            // starting coin price (in virtual cash)

  function freshHistory() {
    const arr = [];
    let p = BASE;
    for (let i = 0; i < 60; i++) {
      p = step(p);
      arr.push(+p.toFixed(4));
    }
    return arr;
  }

  // one random-walk step with gentle pull back toward BASE
  function step(p) {
    const drift = (BASE - p) * 0.01;                 // mean reversion
    const shock = (Math.random() - 0.5) * p * 0.06;  // normal volatility
    const spike = Math.random() < 0.04 ? (Math.random() - 0.5) * p * 0.25 : 0;
    return Math.max(0.5, p + drift + shock + spike);
  }

  function loadM() {
    try {
      const raw = localStorage.getItem(MKEY);
      if (raw) {
        const m = JSON.parse(raw);
        if (Array.isArray(m.history) && m.history.length) return m;
      }
    } catch (e) {}
    return { history: freshHistory(), updated: Date.now() };
  }

  let market = loadM();

  function saveM() {
    try { localStorage.setItem(MKEY, JSON.stringify(market)); } catch (e) {}
  }

  const listeners = [];

  const Market = {
    get price() { return market.history[market.history.length - 1]; },
    get history() { return market.history; },

    /** % change over the last `n` points (default whole window). */
    changePct(n) {
      const h = market.history;
      const from = h[Math.max(0, h.length - (n || h.length))];
      return ((this.price - from) / from) * 100;
    },

    onTick(fn) { listeners.push(fn); },

    /** Advance the price one step. Called on an interval by the page. */
    tick() {
      const next = +step(this.price).toFixed(4);
      market.history.push(next);
      if (market.history.length > MAX_POINTS) market.history.shift();
      market.updated = Date.now();
      saveM();
      for (const fn of listeners) fn(next);
      // TODO(Firebase): instead of computing `next` locally, read the shared
      // price from the database here so every player sees the same value.
      return next;
    },
  };

  window.Market = Market;
})();
