# AI Kills Devs

**AI Protocol: PURGE**

A neon 3D rail shooter for the browser: you play an AI tasked with "optimizing" the codebase by eliminating developers. The camera rides a rail through a cyberpunk open space wrapped around a datacenter; you only aim and fire. Built with Three.js, no build step, served as a static page.

**🕹️ Play Now**: [https://saumon.github.io/ai-kills-dev/](https://saumon.github.io/ai-kills-dev/)

## 🎮 Gameplay

-   **Objective**: Eliminate as many developers as possible in 60 seconds.
-   **Controls**:
    -   Desktop: move the mouse to aim, click (or `Space`) to fire. `P` / `Esc` pauses, `M` mutes.
    -   Touch: tap where you want to shoot.
-   **Mechanics**:
    -   Developers pop up from behind desks and server racks ahead of you, then duck back.
    -   **Combo**: every 3 kills without a miss raises the score multiplier (up to x5). A missed shot resets it.
    -   **Headshots** score double.
    -   **Runners** (25 pts) sprint between desks. **10x devs** (golden, 50 pts) appear briefly and give +3 seconds.
    -   Some devs throw **bugs** at you: shoot them down, or lose 5 seconds and your combo.
    -   Each lap of the office is a **sprint**: the rail speeds up and devs get quicker.
    -   Your high score is kept in the browser's local storage.

## 🛠️ Tech Stack

-   **Rendering**: [Three.js](https://threejs.org/) r170 (WebGL) with a bloom post-processing pass, vendored in `vendor/three/` — no CDN at runtime.
-   **Code**: Vanilla JavaScript ES modules loaded through an import map. No bundler, no `npm install`.
-   **Art**: Everything is procedural — low-poly geometry, canvas-generated textures and signs. No model or texture files.
-   **Audio**: Sound effects and music synthesised with the Web Audio API.
-   **UI**: HTML/CSS HUD and menus layered over the canvas.

## 🚀 How to Run

ES modules need to be served over HTTP, so opening `index.html` from the file system will not work.

```bash
git clone https://github.com/saumon/ai-kills-dev.git
cd ai-kills-dev
python3 -m http.server 8765
```

Then open <http://localhost:8765>. Any static server works (`npx serve .` for example).

## 🌐 Deployment

The repository root is the site: GitHub Pages serves the branch as-is. `.nojekyll` disables Jekyll processing so that every file (including `vendor/`) is published untouched.

## 📂 Project Structure

-   `index.html`: Page, HUD and menus; declares the import map.
-   `style.css`: HUD, overlays and feedback animations.
-   `src/main.js`: Game loop, input, scoring, spawning and HUD updates.
-   `src/level.js`: The office — rail path, desks, racks, signs and lights.
-   `src/devs.js`: Developer characters and the bugs they throw.
-   `src/fx.js`: Particles, laser tracers and the first-person blaster.
-   `src/audio.js`: Synthesised sound effects and music.
-   `vendor/three/`: Three.js build and the post-processing addons in use (MIT).
-   `assets/`: Favicon, plus the sprites of the original 2D version.

## 📄 License

MIT License.
