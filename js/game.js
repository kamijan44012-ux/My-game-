/* ============================================================
   Star Duel — Space Shooter
   A neon two-ship duel. Player 1 flies the bottom half,
   the opponent (AI or a 2nd local player) flies the top half.
   Pure Canvas 2D, no assets, mobile + desktop.
   Online multiplayer hooks are stubbed for Firebase (see net.js todo).
   ============================================================ */
(function () {
  "use strict";

  const A = window.GameAudio;
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  // ---------- Global view state ----------
  const View = { w: 0, h: 0, dpr: 1, shake: 0 };

  function resize() {
    View.dpr = Math.min(window.devicePixelRatio || 1, 2);
    View.w = window.innerWidth;
    View.h = window.innerHeight;
    canvas.width = Math.floor(View.w * View.dpr);
    canvas.height = Math.floor(View.h * View.dpr);
    canvas.style.width = View.w + "px";
    canvas.style.height = View.h + "px";
    ctx.setTransform(View.dpr, 0, 0, View.dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  // ---------- Utility ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };

  // ---------- Starfield (parallax) ----------
  const stars = [];
  function buildStars() {
    stars.length = 0;
    const n = Math.floor((View.w * View.h) / 6000);
    for (let i = 0; i < n; i++) {
      const layer = Math.floor(rand(0, 3));
      stars.push({
        x: rand(0, View.w), y: rand(0, View.h),
        r: layer === 2 ? rand(1.2, 2.2) : rand(0.4, 1.2),
        speed: (layer + 1) * 12,
        hue: Math.random() < 0.15 ? rand(180, 320) : 0,
      });
    }
  }
  buildStars();
  window.addEventListener("resize", buildStars);

  // ---------- Entities ----------
  const bullets = [];
  const particles = [];
  const powerups = [];

  function spawnParticles(x, y, color, count, spread, life) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(spread * 0.2, spread);
      particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: life || rand(0.3, 0.8), age: 0,
        size: rand(1.5, 4), color,
      });
    }
  }

  function Ship(opts) {
    this.x = opts.x; this.y = opts.y;
    this.vx = 0; this.vy = 0;
    this.color = opts.color;
    this.isTop = opts.isTop;          // facing direction
    this.maxHealth = 100; this.health = 100;
    this.maxShield = 100; this.shield = 0;
    this.score = 0;
    this.r = 22;
    this.cool = 0;                    // shoot cooldown
    this.fireRate = 0.28;
    this.triple = 0;                  // triple-shot timer
    this.invuln = 0;
    this.thrust = 0;                  // for engine flame anim
    this.dead = false;
    this.name = opts.name;
  }

  Ship.prototype.bounds = function () {
    // vertical play limits per pilot (top half vs bottom half + a little overlap)
    if (this.isTop) return { minY: 50, maxY: View.h * 0.46 };
    return { minY: View.h * 0.54, maxY: View.h - 50 };
  };

  Ship.prototype.shoot = function (player) {
    if (this.cool > 0 || this.dead) return;
    this.cool = this.triple > 0 ? this.fireRate * 0.6 : this.fireRate;
    const dir = this.isTop ? 1 : -1;
    const make = (ang) => bullets.push({
      x: this.x, y: this.y + dir * this.r,
      vx: Math.sin(ang) * 520, vy: dir * 620,
      r: 5, owner: this, color: this.color,
    });
    make(0);
    if (this.triple > 0) { make(-0.25); make(0.25); }
    A.laser(!this.isTop);
  };

  Ship.prototype.hurt = function (dmg) {
    if (this.invuln > 0 || this.dead) return;
    if (this.shield > 0) {
      this.shield -= dmg;
      A.shieldHit();
      if (this.shield < 0) { this.health += this.shield; this.shield = 0; }
    } else {
      this.health -= dmg;
      A.hit();
    }
    spawnParticles(this.x, this.y, this.color, 8, 160, 0.4);
    View.shake = Math.min(14, View.shake + 6);
    if (this.health <= 0) { this.health = 0; this.die(); }
  };

  Ship.prototype.die = function () {
    if (this.dead) return;
    this.dead = true;
    spawnParticles(this.x, this.y, this.color, 60, 360, 1.1);
    spawnParticles(this.x, this.y, "#ffffff", 30, 280, 0.8);
    A.explosion();
    View.shake = 22;
  };

  Ship.prototype.update = function (dt) {
    if (this.dead) return;
    const b = this.bounds();
    this.x = clamp(this.x + this.vx * dt, this.r, View.w - this.r);
    this.y = clamp(this.y + this.vy * dt, b.minY, b.maxY);
    this.cool -= dt;
    if (this.triple > 0) this.triple -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    this.thrust = Math.hypot(this.vx, this.vy) / 320;

    // engine trail
    if (Math.random() < 0.6) {
      const dir = this.isTop ? -1 : 1;
      particles.push({
        x: this.x + rand(-5, 5), y: this.y + dir * this.r,
        vx: rand(-20, 20), vy: dir * rand(-120, -40),
        life: rand(0.2, 0.5), age: 0, size: rand(1.5, 3.5),
        color: this.isTop ? "#ff8df6" : "#7fdcff",
      });
    }
  };

  Ship.prototype.draw = function () {
    if (this.dead) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.isTop) ctx.rotate(Math.PI);
    const flicker = this.invuln > 0 && Math.floor(this.invuln * 20) % 2 === 0;
    ctx.globalAlpha = flicker ? 0.4 : 1;

    // engine flame
    const flame = 8 + this.thrust * 18 + Math.random() * 6;
    const grad = ctx.createLinearGradient(0, this.r, 0, this.r + flame);
    grad.addColorStop(0, this.isTop ? "#ff8df6" : "#9be9ff");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-7, this.r); ctx.lineTo(0, this.r + flame); ctx.lineTo(7, this.r);
    ctx.closePath(); ctx.fill();

    // hull glow
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 18;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(0, -this.r);              // nose
    ctx.lineTo(this.r * 0.9, this.r * 0.7);
    ctx.lineTo(this.r * 0.35, this.r * 0.4);
    ctx.lineTo(-this.r * 0.35, this.r * 0.4);
    ctx.lineTo(-this.r * 0.9, this.r * 0.7);
    ctx.closePath();
    ctx.fill();

    // cockpit
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.ellipse(0, -this.r * 0.15, 5, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // shield ring
    if (this.shield > 0) {
      ctx.strokeStyle = "rgba(56,255,156," + (0.4 + 0.3 * Math.sin(Date.now() / 120)) + ")";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "#38ff9c"; ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(0, 0, this.r + 9, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  };

  // ---------- Power-ups ----------
  const PU_TYPES = ["shield", "triple", "heal"];
  function spawnPowerup() {
    const type = PU_TYPES[Math.floor(rand(0, PU_TYPES.length))];
    powerups.push({
      x: rand(40, View.w - 40), y: View.h / 2,
      vy: rand(-30, 30), r: 14, type, age: 0,
      color: type === "shield" ? "#38ff9c" : type === "triple" ? "#ffd23d" : "#ff6bd0",
    });
  }

  function applyPowerup(ship, pu) {
    if (pu.type === "shield") ship.shield = ship.maxShield;
    else if (pu.type === "triple") ship.triple = 8;
    else if (pu.type === "heal") ship.health = clamp(ship.health + 35, 0, ship.maxHealth);
    A.powerup();
    spawnParticles(pu.x, pu.y, pu.color, 20, 200, 0.6);
  }

  // ---------- Input ----------
  const keys = {};
  window.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
    if ([" ", "arrowleft", "arrowright", "arrowup", "arrowdown"].includes(e.key.toLowerCase())) e.preventDefault();
  });
  window.addEventListener("keyup", (e) => { keys[e.key.toLowerCase()] = false; });

  // Touch joystick
  const joy = { active: false, id: null, baseX: 0, baseY: 0, dx: 0, dy: 0 };
  const joyEl = document.getElementById("joystick");
  const knob = joyEl.querySelector(".joystick-knob");
  const fireBtn = document.getElementById("fireBtn");
  let touchFire = false;

  function joyStart(e) {
    const t = e.changedTouches ? e.changedTouches[0] : e;
    const rect = joyEl.getBoundingClientRect();
    joy.active = true;
    joy.id = t.identifier != null ? t.identifier : "mouse";
    joy.baseX = rect.left + rect.width / 2;
    joy.baseY = rect.top + rect.height / 2;
    joyMove(e);
  }
  function joyMove(e) {
    if (!joy.active) return;
    let t = e;
    if (e.changedTouches) {
      t = null;
      for (const ct of e.changedTouches) if (ct.identifier === joy.id) t = ct;
      if (!t) return;
    }
    const dx = t.clientX - joy.baseX;
    const dy = t.clientY - joy.baseY;
    const max = 46;
    const d = Math.hypot(dx, dy) || 1;
    const cl = Math.min(d, max);
    joy.dx = (dx / d) * (cl / max);
    joy.dy = (dy / d) * (cl / max);
    knob.style.transform = `translate(calc(-50% + ${(dx / d) * cl}px), calc(-50% + ${(dy / d) * cl}px))`;
  }
  function joyEnd() {
    joy.active = false; joy.dx = 0; joy.dy = 0;
    knob.style.transform = "translate(-50%, -50%)";
  }
  joyEl.addEventListener("touchstart", (e) => { e.preventDefault(); joyStart(e); }, { passive: false });
  joyEl.addEventListener("touchmove", (e) => { e.preventDefault(); joyMove(e); }, { passive: false });
  joyEl.addEventListener("touchend", (e) => { e.preventDefault(); joyEnd(); }, { passive: false });
  joyEl.addEventListener("mousedown", joyStart);
  window.addEventListener("mousemove", (e) => { if (joy.active && joy.id === "mouse") joyMove(e); });
  window.addEventListener("mouseup", () => { if (joy.id === "mouse") joyEnd(); });

  fireBtn.addEventListener("touchstart", (e) => { e.preventDefault(); touchFire = true; }, { passive: false });
  fireBtn.addEventListener("touchend", (e) => { e.preventDefault(); touchFire = false; }, { passive: false });
  fireBtn.addEventListener("mousedown", () => { touchFire = true; });
  window.addEventListener("mouseup", () => { touchFire = false; });

  // ---------- Game state ----------
  const Game = {
    state: "menu",     // menu | playing | paused | over
    mode: "ai",        // ai | local | online
    p1: null, p2: null,
    puTimer: 0,
    last: 0,
    raf: null,
  };

  function newRound() {
    bullets.length = 0; particles.length = 0; powerups.length = 0;
    View.shake = 0;
    Game.p1 = new Ship({ x: View.w / 2, y: View.h - 120, color: "#2ef2ff", isTop: false, name: "YOU" });
    Game.p2 = new Ship({ x: View.w / 2, y: 120, color: "#ff3df0", isTop: true, name: Game.mode === "local" ? "P2" : "ENEMY" });
    Game.p1.invuln = 1.5; Game.p2.invuln = 1.5;
    Game.puTimer = 6;
  }

  // ---------- AI opponent ----------
  function aiControl(ai, target, dt) {
    if (ai.dead || target.dead) return;
    // Track target horizontally, dodge incoming bullets, fire when lined up.
    let desiredX = target.x;
    // dodge nearest threatening bullet
    let threat = null, best = 1e9;
    for (const b of bullets) {
      if (b.owner === ai) continue;
      if ((ai.isTop && b.vy > 0) || (!ai.isTop && b.vy < 0)) {
        const d = Math.abs(b.x - ai.x) + Math.abs(b.y - ai.y) * 0.3;
        if (d < best && Math.abs(b.x - ai.x) < 60) { best = d; threat = b; }
      }
    }
    if (threat) desiredX = ai.x + (ai.x < threat.x ? -120 : 120);
    desiredX += Math.sin(Date.now() / 700) * 40; // weaving

    const diff = desiredX - ai.x;
    ai.vx = clamp(diff * 4, -300, 300);
    // vertical bobbing inside its zone
    const b = ai.bounds();
    const midY = (b.minY + b.maxY) / 2;
    ai.vy = clamp((midY + Math.sin(Date.now() / 1100) * 60 - ai.y) * 3, -200, 200);

    // shoot if roughly aligned
    if (Math.abs(target.x - ai.x) < 46 && Math.random() < 0.9) ai.shoot();
  }

  // ---------- Update ----------
  function update(dt) {
    // ---- Player 1 input ----
    const p1 = Game.p1, p2 = Game.p2;
    const sp = 340;
    let ax = 0, ay = 0;
    if (keys["a"] || keys["arrowleft"]) ax -= 1;
    if (keys["d"] || keys["arrowright"]) ax += 1;
    if (keys["w"] || keys["arrowup"]) ay -= 1;
    if (keys["s"] || keys["arrowdown"]) ay += 1;
    ax += joy.dx; ay += joy.dy;
    p1.vx = clamp(ax, -1, 1) * sp;
    p1.vy = clamp(ay, -1, 1) * sp;
    if (keys[" "] || touchFire) p1.shoot(true);

    // ---- Player 2 ----
    if (Game.mode === "local") {
      let bx = 0, by = 0;
      if (keys["j"]) bx -= 1;
      if (keys["l"]) bx += 1;
      if (keys["i"]) by -= 1;
      if (keys["k"]) by += 1;
      p2.vx = clamp(bx, -1, 1) * sp;
      p2.vy = clamp(by, -1, 1) * sp;
      if (keys["enter"]) p2.shoot(false);
    } else {
      aiControl(p2, p1, dt);
    }

    p1.update(dt); p2.update(dt);

    // ---- Bullets ----
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y < -20 || b.y > View.h + 20 || b.x < -20 || b.x > View.w + 20) { bullets.splice(i, 1); continue; }
      const tgt = b.owner === p1 ? p2 : p1;
      if (!tgt.dead && dist2(b.x, b.y, tgt.x, tgt.y) < (tgt.r + b.r) * (tgt.r + b.r)) {
        tgt.hurt(10);
        b.owner.score += tgt.dead ? 5 : 0;
        spawnParticles(b.x, b.y, b.color, 6, 140, 0.3);
        bullets.splice(i, 1);
      }
    }

    // ---- Power-ups ----
    Game.puTimer -= dt;
    if (Game.puTimer <= 0 && powerups.length < 2) { spawnPowerup(); Game.puTimer = rand(7, 12); }
    for (let i = powerups.length - 1; i >= 0; i--) {
      const pu = powerups[i];
      pu.age += dt; pu.y += pu.vy * dt;
      if (pu.y < 60 || pu.y > View.h - 60) pu.vy *= -1;
      for (const s of [p1, p2]) {
        if (!s.dead && dist2(pu.x, pu.y, s.x, s.y) < (pu.r + s.r) * (pu.r + s.r)) {
          applyPowerup(s, pu); powerups.splice(i, 1); break;
        }
      }
    }

    // ---- Particles ----
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.96; p.vy *= 0.96;
      if (p.age >= p.life) particles.splice(i, 1);
    }

    // ---- Stars ----
    for (const s of stars) {
      s.y += s.speed * dt;
      if (s.y > View.h) { s.y = 0; s.x = rand(0, View.w); }
    }

    if (View.shake > 0) View.shake = Math.max(0, View.shake - dt * 40);

    // ---- Win / lose ----
    if (p1.dead || p2.dead) endRound();
    updateHUD();
  }

  let endTimer = null;
  function endRound() {
    if (Game.state !== "playing") return;
    Game.state = "over";
    const p1dead = Game.p1.dead;
    clearTimeout(endTimer);
    endTimer = setTimeout(() => {
      const win = !p1dead;
      document.getElementById("resultText").textContent =
        Game.mode === "local" ? (p1dead ? "PLAYER 2 WINS" : "PLAYER 1 WINS") : (win ? "VICTORY" : "DEFEATED");
      document.getElementById("resultSub").textContent =
        win ? "Stellar flying, pilot! 🚀" : "Your ship was destroyed. Try again!";
      show("gameover");
      A.stopMusic();
      win ? A.win() : A.lose();
    }, 900);
  }

  // ---------- Render ----------
  function render() {
    ctx.clearRect(0, 0, View.w, View.h);
    ctx.save();
    if (View.shake > 0) ctx.translate(rand(-View.shake, View.shake), rand(-View.shake, View.shake));

    // stars
    for (const s of stars) {
      ctx.globalAlpha = 0.5 + (s.r / 2.2) * 0.5;
      ctx.fillStyle = s.hue ? `hsl(${s.hue},90%,75%)` : "#cfe9ff";
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    // center divider line
    ctx.strokeStyle = "rgba(123,92,255,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, View.h / 2); ctx.lineTo(View.w, View.h / 2); ctx.stroke();

    // power-ups
    for (const pu of powerups) {
      ctx.save();
      ctx.translate(pu.x, pu.y);
      ctx.rotate(pu.age * 2);
      ctx.shadowColor = pu.color; ctx.shadowBlur = 18;
      ctx.fillStyle = pu.color;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx[i ? "lineTo" : "moveTo"](Math.cos(a) * pu.r, Math.sin(a) * pu.r);
      }
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // bullets
    for (const b of bullets) {
      ctx.shadowColor = b.color; ctx.shadowBlur = 12;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.ellipse(b.x, b.y, b.r * 0.7, b.r * 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // particles
    for (const p of particles) {
      ctx.globalAlpha = clamp(1 - p.age / p.life, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    if (Game.p1) Game.p1.draw();
    if (Game.p2) Game.p2.draw();

    ctx.restore();
  }

  // ---------- HUD ----------
  function pct(v, m) { return clamp((v / m) * 100, 0, 100) + "%"; }
  function updateHUD() {
    const p1 = Game.p1, p2 = Game.p2;
    if (!p1) return;
    document.getElementById("p1health").style.width = pct(p1.health, p1.maxHealth);
    document.getElementById("p2health").style.width = pct(p2.health, p2.maxHealth);
    document.getElementById("p1shield").style.width = pct(p1.shield, p1.maxShield);
    document.getElementById("p2shield").style.width = pct(p2.shield, p2.maxShield);
  }

  // ---------- Loop ----------
  function frame(t) {
    Game.raf = requestAnimationFrame(frame);
    const dt = Math.min(0.033, (t - Game.last) / 1000 || 0);
    Game.last = t;
    if (Game.state === "playing") update(dt);
    render();
  }

  // ---------- UI navigation ----------
  const overlays = ["menu", "howto", "pauseMenu", "gameover", "onlineInfo"];
  function show(id) {
    overlays.forEach((o) => document.getElementById(o).classList.toggle("hidden", o !== id));
    const inGame = id === null;
    document.getElementById("hud").classList.toggle("hidden", !inGame);
    document.getElementById("touchControls").classList.toggle("hidden", !inGame);
  }

  function startGame(mode) {
    Game.mode = mode;
    document.getElementById("p1name").textContent = mode === "local" ? "P1" : "YOU";
    document.getElementById("p2name").textContent = mode === "local" ? "P2" : "ENEMY";
    newRound();
    Game.state = "playing";
    show(null);
    A.unlock(); A.startMusic();
  }

  // Buttons
  document.querySelectorAll("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      A.unlock(); A.click();
      const mode = btn.getAttribute("data-mode");
      if (mode === "online") { show("onlineInfo"); return; }
      startGame(mode);
    });
  });
  document.getElementById("howtoBtn").addEventListener("click", () => { A.click(); show("howto"); });
  document.getElementById("howtoBack").addEventListener("click", () => { A.click(); show("menu"); });
  document.getElementById("onlineBack").addEventListener("click", () => { A.click(); show("menu"); });
  document.getElementById("pauseBtn").addEventListener("click", () => {
    if (Game.state !== "playing") return;
    Game.state = "paused"; A.click(); show("pauseMenu");
  });
  document.getElementById("resumeBtn").addEventListener("click", () => {
    A.click(); Game.state = "playing"; show(null);
  });
  document.getElementById("quitBtn").addEventListener("click", () => {
    A.click(); Game.state = "menu"; A.stopMusic(); show("menu");
  });
  document.getElementById("rematchBtn").addEventListener("click", () => { A.click(); startGame(Game.mode); });
  document.getElementById("menuBtn").addEventListener("click", () => { A.click(); Game.state = "menu"; show("menu"); });

  const soundBtn = document.getElementById("soundToggle");
  let soundOn = true;
  soundBtn.addEventListener("click", () => {
    soundOn = !soundOn;
    A.unlock(); A.setEnabled(soundOn);
    soundBtn.textContent = soundOn ? "🔊 Sound: ON" : "🔇 Sound: OFF";
  });

  // Hide the "tap to start" hint after first interaction
  const hint = document.getElementById("loadHint");
  window.addEventListener("pointerdown", () => { A.unlock(); hint.classList.add("hidden"); }, { once: true });

  // Kick off render loop
  Game.last = performance.now();
  Game.raf = requestAnimationFrame(frame);
})();
