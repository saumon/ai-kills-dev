// AI Kills Devs — 3D rail shooter. Game loop, input, scoring and HUD.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildLevel, NEON } from './level.js';
import { Dev, Bug, DEV_TYPES } from './devs.js';
import { Particles, Tracers, Blaster } from './fx.js';
import { Sfx } from './audio.js';

const GAME_TIME = 60;
const BASE_SPEED = 3.1;
const BEST_KEY = 'aikd.best';
const QUIPS = ['git blame', 'rm -rf dev', 'DEPRECATED', 'REFACTORED', 'kill -9', 'MERGED', 'segfault',
    'OPTIMIZED AWAY', '404', 'garbage collected', 'git revert', 'LGTM'];
const RANKS = [
    [0, 'AUTOCOMPLETE PLUGIN'], [250, 'JUNIOR COPILOT'], [600, 'SENIOR LLM'],
    [1100, 'AUTONOMOUS AGENT'], [1800, 'AGI ACHIEVED'],
];

const $ = (id) => document.getElementById(id);
const ui = {
    score: $('score'), timer: $('timer'), timerBar: $('timer-bar'), sprint: $('sprint'),
    combo: $('combo'), comboMult: $('combo-mult'), comboPips: $('combo-pips'),
    crosshair: $('crosshair'), floats: $('float-layer'), banner: $('banner'), hurt: $('hurt'),
    hud: $('hud'), start: $('start-screen'), pause: $('pause-screen'), over: $('over-screen'),
    best: $('best-score'), mute: $('mute-btn'),
};

function readBest() {
    try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
}
function writeBest(v) {
    try { localStorage.setItem(BEST_KEY, String(v)); } catch { /* storage unavailable */ }
}

// --- Renderer ---------------------------------------------------------------
const canvas = $('scene');
let renderer;
try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (err) {
    $('no-webgl').hidden = false;
    throw err;
}
const coarse = matchMedia('(pointer: coarse)').matches;
renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0618);
scene.fog = new THREE.FogExp2(0x0a0618, 0.028);
const camera = new THREE.PerspectiveCamera(68, 1, 0.05, 90);
scene.add(camera);
camera.add(new THREE.PointLight(0xc8d8ff, 10, 20, 1.3));

await Promise.race([
    document.fonts.load('bold 120px "Share Tech Mono"').catch(() => {}),
    new Promise((r) => setTimeout(r, 1500)),
]);

const level = buildLevel();
scene.add(level.group);
const devs = Array.from({ length: 16 }, () => new Dev());
const bugs = Array.from({ length: 6 }, () => new Bug());
devs.forEach((d) => scene.add(d.root));
bugs.forEach((b) => scene.add(b.root));
const particles = new Particles();
scene.add(particles.mesh);
const tracers = new Tracers(scene);
const blaster = new Blaster(camera);
const sfx = new Sfx();

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.5, 1.0);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 1 ? 84 : 68;
    camera.updateProjectionMatrix();
    blaster.layout();
}
window.addEventListener('resize', resize);
resize();

// --- State ------------------------------------------------------------------
const state = {
    mode: 'menu', // menu | playing | paused | over
    score: 0, time: GAME_TIME, elapsed: 0,
    combo: 0, bestCombo: 0, kills: 0, shots: 0, hits: 0,
    sprint: 1, startDist: 0, spawnIn: 0, shake: 0,
};
let camDist = 0;
let lastShot = 0;
let lastTick = -1;
let mouseLook = !coarse;
const aim = new THREE.Vector2(0, 0); // pointer in NDC
const look = new THREE.Vector2(0, 0); // smoothed camera sway
const CENTER = new THREE.Vector2(0, 0);
const raycaster = new THREE.Raycaster();
raycaster.far = 80;
const camPos = new THREE.Vector3();
const lookAt = new THREE.Vector3();
const forward = new THREE.Vector3();
const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();
const aimWorld = new THREE.Vector3();

const camU = () => (camDist / level.length) % 1;
const ahead = (slot) => ((slot.u - camU() + 1) % 1) * level.length;
const multiplier = () => Math.min(5, 1 + Math.floor(state.combo / 3));

// --- HUD helpers ------------------------------------------------------------
function floatText(text, x, y, cls = '') {
    const el = document.createElement('div');
    el.className = `float ${cls}`;
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    ui.floats.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
}

function floatAt(text, world, cls, dy = 0) {
    tmp2.copy(world).project(camera);
    floatText(text, (tmp2.x * 0.5 + 0.5) * window.innerWidth, (-tmp2.y * 0.5 + 0.5) * window.innerHeight + dy, cls);
}

function banner(title, sub = '') {
    ui.banner.innerHTML = '';
    const h = document.createElement('strong');
    h.textContent = title;
    const s = document.createElement('span');
    s.textContent = sub;
    ui.banner.append(h, s);
    ui.banner.classList.remove('show');
    void ui.banner.offsetWidth; // restart the animation
    ui.banner.classList.add('show');
}

function pulse(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
}

function renderHud() {
    ui.score.textContent = state.score;
    const t = Math.max(0, Math.ceil(state.time));
    ui.timer.textContent = t;
    ui.timerBar.style.transform = `scaleX(${Math.min(1, Math.max(0, state.time / GAME_TIME))})`;
    ui.timer.parentElement.classList.toggle('low', state.time <= 10);
    ui.sprint.textContent = state.sprint;
    const mult = multiplier();
    ui.comboMult.textContent = `x${mult}`;
    ui.combo.classList.toggle('on', state.combo > 0);
    const pips = mult >= 5 ? 3 : state.combo % 3;
    ui.comboPips.dataset.n = pips;
}

function setMode(mode) {
    state.mode = mode;
    ui.start.classList.toggle('active', mode === 'menu');
    ui.pause.classList.toggle('active', mode === 'paused');
    ui.over.classList.toggle('active', mode === 'over');
    ui.hud.classList.toggle('active', mode === 'playing' || mode === 'paused');
    document.body.classList.toggle('playing', mode === 'playing');
}

// --- Game flow --------------------------------------------------------------
function startGame() {
    sfx.init();
    sfx.startMusic();
    devs.forEach((d) => d.active && d.release());
    bugs.forEach((b) => b.release());
    particles.clear();
    Object.assign(state, {
        score: 0, time: GAME_TIME, elapsed: 0, combo: 0, bestCombo: 0, kills: 0, shots: 0, hits: 0,
        sprint: 1, startDist: camDist, spawnIn: 0.8, shake: 0,
    });
    lastTick = -1;
    setMode('playing');
    renderHud();
    banner('SPRINT 1', 'PURGE THE OPEN SPACE');
}

function endGame() {
    setMode('over');
    sfx.stopMusic();
    sfx.over();
    devs.forEach((d) => d.active && d.duck());
    bugs.forEach((b) => b.release());
    const best = Math.max(readBest(), state.score);
    writeBest(best);
    const acc = state.shots ? Math.round((state.hits / state.shots) * 100) : 0;
    $('final-score').textContent = state.score;
    $('final-kills').textContent = state.kills;
    $('final-acc').textContent = `${acc}%`;
    $('final-combo').textContent = state.bestCombo;
    $('final-best').textContent = best;
    $('final-rank').textContent = RANKS.filter(([min]) => state.score >= min).pop()[1];
    ui.best.textContent = best;
}

function togglePause() {
    if (state.mode === 'playing') {
        setMode('paused');
        sfx.stopMusic();
    } else if (state.mode === 'paused') {
        setMode('playing');
        sfx.startMusic();
    }
}

function hurt() {
    state.time -= 5;
    state.combo = 0;
    state.shake = 0.5;
    sfx.hurt();
    pulse(ui.hurt, 'show');
    floatText('-5s  BUG IN PROD', window.innerWidth / 2, window.innerHeight * 0.4, 'bad big');
}

function spawnDev() {
    const dev = devs.find((d) => !d.active);
    if (!dev) return;
    const candidates = level.slots.filter((s) => {
        if (s.busy) return false;
        const a = ahead(s);
        return a > 6 && a < 20;
    });
    if (!candidates.length) return;
    const slot = candidates[Math.floor(Math.random() * candidates.length)];
    const hard = state.sprint - 1;
    const r = Math.random();
    let type = 'normal';
    if (r < 0.08) type = 'gold';
    else if (r < 0.27 && slot.next && !slot.next.busy) type = 'runner';

    let stay = Math.max(1.3, 2.3 - 0.2 * hard) + Math.random() * 0.6;
    if (type === 'gold') stay = 1.3;
    if (type === 'runner') stay = Math.max(1.4, 2 - 0.12 * hard);
    const threats = bugs.filter((b) => b.active).length + devs.filter((d) => d.active && d.thrower).length;
    const thrower = type === 'normal' && state.elapsed > 6 && threats < 2
        && Math.random() < Math.min(0.45, 0.16 + 0.08 * hard);
    if (thrower) {
        stay = Math.max(stay, 1.8);
        sfx.warn();
    }
    dev.spawn(slot, type, { stay, thrower });
}

function killDev(dev, hit) {
    const head = hit.object.userData.head === true;
    const mult = multiplier();
    const points = DEV_TYPES[dev.type].points * (head ? 2 : 1) * mult;
    state.score += points;
    state.combo++;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.kills++;
    state.hits++;

    tmp.copy(dev.pos).setY(dev.pos.y + 1.2);
    particles.burst(tmp, dev.color, 26, { speed: 4.5, size: 0.11, spread: 0.3 });
    particles.burst(tmp.setY(dev.pos.y + 1.65), 0xf2c49b, 8, { speed: 3, size: 0.08, glow: 1 });
    particles.burst(tmp, NEON.green, 10, { speed: 5, size: 0.05, glow: 2.5, life: 0.6 });

    floatAt(`+${points}`, hit.point, dev.type === 'gold' ? 'gold big' : head ? 'big' : '');
    if (head) {
        floatAt('HEADSHOT', hit.point, 'head', -34);
        sfx.headshot();
    } else if (dev.type !== 'normal') {
        floatAt(DEV_TYPES[dev.type].label, hit.point, 'quip', -30);
    } else if (Math.random() < 0.4) {
        floatAt(QUIPS[Math.floor(Math.random() * QUIPS.length)], hit.point, 'quip', -30);
    }
    if (dev.type === 'gold') {
        state.time = Math.min(99, state.time + 3);
        floatText('+3s', window.innerWidth / 2, 96, 'gold big');
        sfx.gold();
    } else {
        sfx.kill(state.combo);
    }
    if (multiplier() > mult) pulse(ui.combo, 'bump');
    pulse(ui.crosshair, 'hit');
    dev.release();
}

function shoot() {
    if (state.mode !== 'playing') return;
    const now = performance.now();
    if (now - lastShot < 110) return;
    lastShot = now;
    state.shots++;
    sfx.shoot();
    blaster.kick();
    pulse(ui.crosshair, 'fire');

    raycaster.setFromCamera(aim, camera);
    const targets = [...level.colliders];
    for (const d of devs) if (d.active) targets.push(d.root);
    for (const b of bugs) if (b.active) targets.push(b.root);
    const hit = raycaster.intersectObjects(targets, true)[0];
    const point = hit ? hit.point : raycaster.ray.at(40, tmp2).clone();

    let owner = null;
    for (let o = hit?.object; o && !owner; o = o.parent) owner = o.userData.dev || o.userData.bug || null;

    if (owner instanceof Dev) {
        killDev(owner, hit);
    } else if (owner instanceof Bug) {
        state.hits++;
        state.score += 5 * multiplier();
        particles.burst(owner.root.position, NEON.red, 14, { speed: 4, size: 0.07, glow: 2.4, up: 1 });
        floatAt('BUG FIXED', hit.point, 'quip');
        sfx.bugDown();
        pulse(ui.crosshair, 'hit');
        owner.release();
    } else {
        state.combo = 0;
        if (hit) particles.burst(hit.point, NEON.cyan, 6, { speed: 2, size: 0.04, life: 0.35, spread: 0.02, up: 1, glow: 2.5 });
    }
    tracers.fire(blaster.muzzleWorld(tmp), point);
    renderHud();
}

// --- Frame ------------------------------------------------------------------
function update(dt, time) {
    const playing = state.mode === 'playing';
    if (playing) {
        state.elapsed += dt;
        state.time -= dt;
        const sec = Math.ceil(state.time);
        if (sec <= 5 && sec !== lastTick && sec > 0) {
            lastTick = sec;
            sfx.tick();
        }
        const sprint = 1 + Math.floor((camDist - state.startDist) / level.length);
        if (sprint > state.sprint) {
            state.sprint = sprint;
            sfx.sprint();
            banner(`SPRINT ${sprint}`, 'VELOCITY INCREASED');
        }
    }

    // Camera rides the rail and sways toward the pointer.
    const speed = playing ? BASE_SPEED * (1 + 0.14 * (state.sprint - 1)) : 1.3;
    camDist += speed * dt;
    const u = camU();
    level.curve.getPointAt(u, camPos);
    level.curve.getPointAt((u + 6 / level.length) % 1, lookAt);
    camPos.y = 1.62 + Math.sin(time * 6.5) * (playing ? 0.022 : 0.008);
    lookAt.y = 1.45;
    camera.position.copy(camPos);
    if (state.shake > 0) {
        state.shake = Math.max(0, state.shake - dt);
        const s = state.shake * 0.25;
        camera.position.x += (Math.random() - 0.5) * s;
        camera.position.y += (Math.random() - 0.5) * s;
    }
    camera.lookAt(lookAt);
    const k = 1 - Math.exp(-dt * 6);
    look.x += ((mouseLook && playing ? aim.x : 0) - look.x) * k;
    look.y += ((mouseLook && playing ? aim.y : 0) - look.y) * k;
    camera.rotateY(-look.x * 0.3);
    camera.rotateX(look.y * 0.14);
    camera.updateMatrixWorld();
    camera.getWorldDirection(forward);

    if (playing) {
        state.spawnIn -= dt;
        if (state.spawnIn <= 0) {
            spawnDev();
            state.spawnIn = Math.max(0.36, 0.78 - 0.09 * (state.sprint - 1)) * (0.7 + Math.random() * 0.6);
        }
    }

    for (const dev of devs) {
        if (!dev.active) continue;
        const a = ahead(dev.slot);
        if (a < 2 || a > level.length * 0.5) dev.duck();
        if (dev.update(dt, camPos) === 'throw' && playing) {
            tmp.copy(dev.pos).sub(camPos).normalize();
            const bug = bugs.find((b) => !b.active);
            if (bug && tmp.dot(forward) > 0.3) {
                bug.launch(dev.heldBug.getWorldPosition(tmp), Math.max(1.3, 2 - 0.12 * (state.sprint - 1)));
            }
        }
    }
    tmp.copy(camPos).addScaledVector(forward, 0.7);
    tmp.y -= 0.12;
    for (const bug of bugs) {
        if (bug.active && bug.update(dt, tmp)) {
            bug.release();
            if (playing) hurt();
        }
    }

    raycaster.setFromCamera(playing ? aim : CENTER, camera);
    raycaster.ray.at(14, aimWorld);
    blaster.update(dt, aimWorld);
    particles.update(dt);
    tracers.update(dt);

    if (playing) {
        renderHud();
        if (state.time <= 0) endGame();
    }
}

const clock = new THREE.Clock();
function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (state.mode !== 'paused') update(dt, clock.elapsedTime);
    composer.render();
}

// --- Input ------------------------------------------------------------------
function setAim(e) {
    aim.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    ui.crosshair.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
}
window.addEventListener('pointermove', setAim);
canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    mouseLook = e.pointerType === 'mouse';
    setAim(e);
    shoot();
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
    else if (e.code === 'KeyM') toggleMute();
    else if (e.code === 'Space' && state.mode === 'playing') {
        e.preventDefault();
        shoot();
    }
});
document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.mode === 'playing') togglePause();
});

function toggleMute() {
    sfx.setMuted(!sfx.muted);
    ui.mute.textContent = sfx.muted ? 'SOUND OFF' : 'SOUND ON';
    ui.mute.setAttribute('aria-pressed', String(sfx.muted));
}
ui.mute.addEventListener('click', toggleMute);
$('pause-btn').addEventListener('click', togglePause);
$('resume-btn').addEventListener('click', togglePause);
$('quit-btn').addEventListener('click', endGame);
$('start-btn').addEventListener('click', startGame);
$('restart-btn').addEventListener('click', startGame);

ui.best.textContent = readBest();
setMode('menu');
document.body.classList.add('ready');
frame();

if (location.hash === '#debug') window.__aikd = { state, devs, bugs, level, camera, blaster, shoot, aim, setAim };
