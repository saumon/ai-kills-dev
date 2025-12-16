# AI Kills Devs

**AI Protocol: PURGE**

A retro-style First Person Shooter web game where you play as an AI tasked with "optimizing" the codebase by eliminating developers. Inspired by Doom, built with vanilla HTML, CSS, and JavaScript.

**🕹️ Play Now**: [https://saumon.github.io/ai-kills-dev/](https://saumon.github.io/ai-kills-dev/)

## 🎮 Gameplay

-   **Objective**: Eliminate as many developers as possible within the time limit.
-   **Controls**: Mouse to aim, Left Click to shoot.
-   **Mechanics**:
    -   Developers spawn at random locations ( desks).
    -   Shoot them before they disappear to score points.
    -   Avoid missing shots (optional mechanics can be added later).
    -   Enjoy the "juicy" feedback with muzzle flashes, recoil and sound effects (if added).

## 🛠️ Tech Stack

-   **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+).
-   **Styling**: Custom CSS with Neon/Cyberpunk aesthetic, Glitch effects, and responsive layout.
-   **Assets**:
    -   Doom-style pistol and muzzle flash.
    -   Developer sprites.
    -   Background removal and processing scripts included in the repo.

## 🚀 How to Run

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/saumon/ai-kills-dev.git
    cd ai-kills-devs
    ```

2.  **Open in Browser**:
    Simply open `index.html` in your preferred web browser.
    
    Or use a local server (recommended for better asset loading):
    ```bash
    npx serve .
    ```

## 📂 Project Structure

-   `index.html`: Main game entry point.
-   `style.css`: All game styles, animations, and responsive design.
-   `game.js`: Game logic (spawning, shooting, scoring, timers).
-   `assets/`: Images and resources.

## 📄 License

MIT License.
