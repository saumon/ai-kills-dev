const cursorGun = document.getElementById('cursor-gun');
const crosshair = document.getElementById('crosshair');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const finalScoreEl = document.getElementById('final-score');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const world = document.getElementById('world');

let score = 0;
let time = 60;
let gameInterval;
let spawnInterval;
let isPlaying = false;

// Custom Cursor & Gun Logic
document.addEventListener('mousemove', (e) => {
    // Crosshair follows exact mouse position
    crosshair.style.left = e.clientX + 'px';
    crosshair.style.top = e.clientY + 'px';

    // Gun follows mouse X with a delay/dampening (Doom sway)
    // Map mouse X (0 to innerWidth) to a slight rotation or translation
    // Let's just translate it slightly relative to center for parallax
    const centerX = window.innerWidth / 2;
    const offsetX = (e.clientX - centerX) / 10; // Pan 10% of movement

    // We update the transform in CSS basically via style
    // Current CSS has transform: translateX(-50%)
    cursorGun.style.setProperty('--gun-offset-x', offsetX + 'px');
});

function triggerShootEffect() {
    cursorGun.classList.add('shooting');
    crosshair.classList.add('shooting');
    setTimeout(() => {
        cursorGun.classList.remove('shooting');
        crosshair.classList.remove('shooting');
    }, 100);
}

document.addEventListener('mousedown', () => {
    triggerShootEffect();
});

// Spawn Points (Percentage based for responsiveness - rough estimates for "desks")
// These should ideally match where desks are in the background image
const spawnPoints = [
    { left: 15, bottom: 20 },
    { left: 35, bottom: 25 },
    { left: 55, bottom: 20 },
    { left: 75, bottom: 25 },
    { left: 25, bottom: 40 }, // Back row
    { left: 65, bottom: 45 }, // Back row
    { left: 85, bottom: 35 }  // Side
];

function createSpawnPoints() {
    world.innerHTML = '';
    spawnPoints.forEach((pos, index) => {
        const point = document.createElement('div');
        point.classList.add('dev-spawn-point');
        point.style.left = pos.left + '%';
        point.style.bottom = pos.bottom + '%';

        const sprite = document.createElement('div');
        sprite.classList.add('dev-sprite');
        sprite.dataset.index = index;

        // Click handler for killing dev
        sprite.addEventListener('mousedown', (e) => {
            if (!isPlaying) return;
            e.stopPropagation(); // Prevent hitting background
            triggerShootEffect(); // Fire the gun!
            if (sprite.classList.contains('visible') && !sprite.classList.contains('dead')) {
                killDev(sprite);
            }
        });

        point.appendChild(sprite);
        world.appendChild(point);
    });
}

function killDev(sprite) {
    score += 10;
    scoreEl.innerText = score;
    sprite.classList.add('dead');

    // Hide after death animation
    setTimeout(() => {
        sprite.classList.remove('visible');
        sprite.classList.remove('dead');
    }, 500);
}

function spawnDev() {
    const sprites = document.querySelectorAll('.dev-sprite');
    // Pick specific valid candidates (not already visible)
    const available = Array.from(sprites).filter(s => !s.classList.contains('visible'));

    if (available.length > 0) {
        const randomDev = available[Math.floor(Math.random() * available.length)];
        randomDev.classList.add('visible');

        // Auto hide if not shot after random time (1-2s)
        const stayTime = Math.random() * 1000 + 800;
        setTimeout(() => {
            if (randomDev.classList.contains('visible') && !randomDev.classList.contains('dead')) {
                randomDev.classList.remove('visible');
            }
        }, stayTime);
    }
}

function startGame() {
    score = 0;
    time = 60;
    scoreEl.innerText = '0';
    timerEl.innerText = '60';
    isPlaying = true;

    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');

    createSpawnPoints(); // Reset world

    // Main Timer
    gameInterval = setInterval(() => {
        time--;
        timerEl.innerText = time;
        if (time <= 0) {
            endGame();
        }
    }, 1000);

    // Spawning Loop - gets faster?
    // Start simple: loop every 600ms
    spawnInterval = setInterval(spawnDev, 700);
}

function endGame() {
    isPlaying = false;
    clearInterval(gameInterval);
    clearInterval(spawnInterval);
    finalScoreEl.innerText = score;
    gameOverScreen.classList.add('active');
}

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

// Initialize world setup (hidden)
createSpawnPoints();
