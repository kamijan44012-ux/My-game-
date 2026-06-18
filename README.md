# ⭐ Star Duel — Space Shooter

A neon **two-ship space shooter duel** built for Android phones (and any modern
browser). Best-effort graphics, fully synthesised sound — and **zero asset
downloads**, so it loads instantly and works offline.

> 🎮 **Live demo:** once GitHub Pages finishes building, the game is at
> `https://kamijan44012-ux.github.io/my-game-/`

## ✨ Features

- **Player vs Computer** — a smart AI opponent that weaves, dodges your shots and fires back.
- **2 Players on one device** — two pilots duel on the same screen.
- **Online Duel (coming soon)** — real-time multiplayer between two real pilots,
  ready to switch on as soon as **Firebase** keys are added (see below).
- Neon glow graphics, parallax starfield, particle explosions, screen shake.
- Power-ups: 🛡️ shield, 🔱 triple-shot, ❤️ heal.
- Full **touch controls** (virtual joystick + fire button) and **keyboard** support.
- Synthesised music + SFX via the Web Audio API. Toggle sound any time.
- Installable as a PWA (Add to Home Screen) for a full-screen app feel.

## 🕹️ Controls

| | Move | Fire |
|---|---|---|
| **Touch** | Left joystick | FIRE button |
| **Player 1 (keyboard)** | `A`/`D` or arrows (+`W`/`S`) | `Space` |
| **Player 2 (keyboard)** | `J`/`L` (+`I`/`K`) | `Enter` |

## 🚀 Running locally

It's a static site — just serve the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## 🔥 Adding Firebase (online multiplayer) — later

Online play is architected but intentionally left as a stub. When you provide
your Firebase config, we will:

1. Add `js/net.js` using Firebase **Realtime Database** (or Firestore) for
   matchmaking + state sync between the two pilots.
2. Drop your config into a `firebaseConfig` object.
3. Flip the **Online Duel** menu button from "soon" to live matchmaking.

No game-logic rewrite is needed — the ship/opponent model already separates the
local player from the remote/AI opponent.

## 📱 Turning this into a real Android APK — later

The web game can be wrapped into a native Android app with
[Capacitor](https://capacitorjs.com/) or published straight from the URL as a
**TWA** (Trusted Web Activity) via Bubblewrap, giving a Play-Store-ready `.apk`.

---

Built as a starting point — graphics, modes and Firebase online play can grow from here.
