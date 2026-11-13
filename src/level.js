// Office level: a looping rail through a neon open space wrapped around a datacenter core.
import * as THREE from 'three';

export const NEON = {
    cyan: 0x00f0ff,
    magenta: 0xff2bd6,
    purple: 0x8a5cff,
    green: 0x39ff88,
    amber: 0xffb020,
    red: 0xff3344,
};

const HALF_X = 16, HALF_Z = 10, RADIUS = 5;
const UP = new THREE.Vector3(0, 1, 0);

/** Small deterministic PRNG so the office looks the same on every load. */
export function mulberry32(seed) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** HDR colour (values > 1 are picked up by the bloom pass). */
export function hdr(hex, k = 2) {
    return new THREE.Color(hex).multiplyScalar(k);
}

function buildCurve() {
    const pts = [];
    const cx = HALF_X - RADIUS, cz = HALF_Z - RADIUS;
    const corners = [[cx, cz], [cx, -cz], [-cx, -cz], [-cx, cz]];
    const starts = [[-cx, HALF_Z], [HALF_X, cz], [cx, -HALF_Z], [-HALF_X, -cz]];
    const ends = [[cx, HALF_Z], [HALF_X, -cz], [-cx, -HALF_Z], [-HALF_X, cz]];
    for (let side = 0; side < 4; side++) {
        const [sx, sz] = starts[side], [ex, ez] = ends[side];
        const len = Math.hypot(ex - sx, ez - sz);
        const n = Math.round(len / 2);
        for (let i = 0; i < n; i++) {
            const k = i / n;
            pts.push(new THREE.Vector3(sx + (ex - sx) * k, 0, sz + (ez - sz) * k));
        }
        const a0 = Math.PI / 2 - side * (Math.PI / 2);
        for (let i = 0; i < 6; i++) {
            const a = a0 - (i / 6) * (Math.PI / 2);
            pts.push(new THREE.Vector3(corners[side][0] + Math.cos(a) * RADIUS, 0, corners[side][1] + Math.sin(a) * RADIUS));
        }
    }
    const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
    curve.arcLengthDivisions = 600;
    return curve;
}

/** Collects box/plane instances so the whole office renders in a handful of draw calls. */
class Batch {
    constructor(geometry, material) {
        this.geometry = geometry;
        this.material = material;
        this.matrices = [];
        this.colors = [];
    }
    add(matrix, color) {
        this.matrices.push(matrix.clone());
        this.colors.push(color);
    }
    build() {
        const mesh = new THREE.InstancedMesh(this.geometry, this.material, this.matrices.length);
        this.matrices.forEach((m, i) => {
            mesh.setMatrixAt(i, m);
            mesh.setColorAt(i, this.colors[i]);
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor.needsUpdate = true;
        mesh.computeBoundingSphere();
        return mesh;
    }
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/** Matrix of a part placed in the local space of `base`. */
function part(base, x, y, z, sx, sy, sz, ry = 0) {
    _q.setFromAxisAngle(UP, ry);
    _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
    return _m.premultiply(base);
}

/** Frame at `pos` whose local +Z points along `zdir` (horizontal). */
function frame(pos, zdir) {
    const x = new THREE.Vector3().crossVectors(UP, zdir).normalize();
    return new THREE.Matrix4().makeBasis(x, UP, zdir).setPosition(pos);
}

function canvasTexture(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

function floorTexture() {
    const tex = canvasTexture(512, 512, (g, w, h) => {
        g.fillStyle = '#0b0a16';
        g.fillRect(0, 0, w, h);
        g.strokeStyle = 'rgba(130, 90, 255, 0.55)';
        g.lineWidth = 2;
        for (let i = 0; i <= 4; i++) {
            const p = (i * w) / 4;
            g.beginPath(); g.moveTo(p, 0); g.lineTo(p, h); g.stroke();
            g.beginPath(); g.moveTo(0, p); g.lineTo(w, p); g.stroke();
        }
        g.strokeStyle = 'rgba(0, 240, 255, 0.18)';
        g.lineWidth = 1;
        for (let i = 0; i < 8; i++) {
            const p = (i * w) / 8 + w / 16;
            g.beginPath(); g.moveTo(p, 0); g.lineTo(p, h); g.stroke();
            g.beginPath(); g.moveTo(0, p); g.lineTo(w, p); g.stroke();
        }
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(13, 10);
    tex.anisotropy = 8;
    return tex;
}

function codeTexture(rand) {
    return canvasTexture(128, 96, (g, w, h) => {
        g.fillStyle = '#05070d';
        g.fillRect(0, 0, w, h);
        for (let y = 8; y < h - 6; y += 7) {
            let x = 6 + Math.floor(rand() * 3) * 8;
            while (x < w - 12) {
                const len = 6 + rand() * 26;
                g.fillStyle = `rgba(255,255,255,${0.35 + rand() * 0.65})`;
                g.fillRect(x, y, Math.min(len, w - 8 - x), 3);
                x += len + 5;
                if (rand() < 0.3) break;
            }
        }
    });
}

function ledTexture(rand) {
    const tex = canvasTexture(512, 256, (g, w, h) => {
        g.fillStyle = '#04040a';
        g.fillRect(0, 0, w, h);
        const palette = ['#39ff88', '#00f0ff', '#ffb020', '#ff2bd6'];
        for (let col = 0; col < 16; col++) {
            const x0 = col * 32;
            g.fillStyle = '#0c0d18';
            g.fillRect(x0 + 2, 6, 28, h - 12);
            for (let row = 0; row < 26; row++) {
                for (let k = 0; k < 5; k++) {
                    if (rand() < 0.45) continue;
                    g.fillStyle = palette[rand() < 0.7 ? 0 : Math.floor(rand() * 4)];
                    g.globalAlpha = 0.35 + rand() * 0.65;
                    g.fillRect(x0 + 5 + k * 5, 12 + row * 9, 3, 3);
                }
            }
            g.globalAlpha = 1;
        }
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.set(3, 1);
    return tex;
}

function makeSign(text, color) {
    const tex = canvasTexture(1024, 192, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        g.font = 'bold 120px "Share Tech Mono", monospace';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        const css = '#' + new THREE.Color(color).getHexString();
        g.shadowColor = css;
        g.shadowBlur = 28;
        g.fillStyle = css;
        g.fillText(text, w / 2, h / 2, w - 60);
        g.shadowBlur = 0;
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.fillText(text, w / 2, h / 2, w - 60);
    });
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: hdr(0xffffff, 1.7) });
    return new THREE.Mesh(new THREE.PlaneGeometry(7, 1.3), mat);
}

function ribbon(curve, offset, width, color) {
    const N = 400;
    const pos = new Float32Array((N + 1) * 6);
    const idx = [];
    const p = new THREE.Vector3(), t = new THREE.Vector3(), r = new THREE.Vector3();
    for (let i = 0; i <= N; i++) {
        const u = (i % N) / N;
        curve.getPointAt(u, p);
        curve.getTangentAt(u, t);
        r.set(-t.z, 0, t.x);
        pos.set([p.x + r.x * (offset - width / 2), 0.03, p.z + r.z * (offset - width / 2)], i * 6);
        pos.set([p.x + r.x * (offset + width / 2), 0.03, p.z + r.z * (offset + width / 2)], i * 6 + 3);
        if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setIndex(idx);
    return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: hdr(color, 1.5), side: THREE.DoubleSide }));
}

export function buildLevel() {
    const rand = mulberry32(1337);
    const group = new THREE.Group();
    const curve = buildCurve();
    const length = curve.getLength();
    const colliders = [];
    const slots = [];

    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const lit = new Batch(boxGeo, new THREE.MeshLambertMaterial());
    const glow = new Batch(boxGeo, new THREE.MeshBasicMaterial());
    const screenGeo = new THREE.PlaneGeometry(1, 1);
    const screens = new Batch(screenGeo, new THREE.MeshBasicMaterial({ map: codeTexture(rand) }));

    const C = (hex) => new THREE.Color(hex);
    const zoneColors = [NEON.cyan, NEON.magenta, NEON.purple, NEON.green];
    const zoneColor = (u) => zoneColors[Math.floor(((u + 0.06) % 1) * 4)];
    const screenTints = [NEON.cyan, NEON.green, NEON.amber, NEON.magenta, 0xffffff];

    // --- Shell: walls + ceiling, floor, datacenter core -------------------
    const shell = new THREE.Mesh(
        new THREE.BoxGeometry(52, 4.3, 40),
        new THREE.MeshLambertMaterial({ color: 0x1b1830, side: THREE.BackSide }),
    );
    shell.position.y = 2.1;
    group.add(shell);
    colliders.push(shell);

    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(52, 40),
        new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.8, metalness: 0.1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    group.add(floor);
    colliders.push(floor);

    const coreW = (HALF_X - 5.3) * 2, coreD = (HALF_Z - 5.3) * 2;
    const core = new THREE.Mesh(
        new THREE.BoxGeometry(coreW, 4.2, coreD),
        new THREE.MeshBasicMaterial({ map: ledTexture(rand), color: hdr(0xffffff, 1.8) }),
    );
    core.position.y = 2.1;
    group.add(core);
    colliders.push(core);

    group.add(ribbon(curve, 1.9, 0.07, NEON.cyan));
    group.add(ribbon(curve, -1.9, 0.07, NEON.magenta));

    // --- Furniture along the rail ---------------------------------------
    const p = new THREE.Vector3(), t = new THREE.Vector3(), t2 = new THREE.Vector3();
    const right = new THREE.Vector3();
    const stations = Math.floor(length / 2.4);
    const rows = { o1: [], o2: [], in: [] };

    const addDesk = (pos, zdir, u, row) => {
        const base = frame(pos, zdir);
        const accent = hdr(zoneColor(u), 1.6);
        lit.add(part(base, 0, 0.75, 0, 1.7, 0.06, 0.8), C(0x4a5070));
        lit.add(part(base, 0, 0.38, -0.38, 1.7, 0.72, 0.04), C(0x2a2e44));
        lit.add(part(base, -0.83, 0.38, 0, 0.04, 0.72, 0.8), C(0x2a2e44));
        lit.add(part(base, 0.83, 0.38, 0, 0.04, 0.72, 0.8), C(0x2a2e44));
        glow.add(part(base, 0, 0.7, -0.405, 1.7, 0.03, 0.02), accent);
        for (const x of [-0.42, 0.42]) {
            if (rand() < 0.15) continue;
            lit.add(part(base, x, 1.07, 0.05, 0.66, 0.42, 0.04), C(0x151826));
            lit.add(part(base, x, 0.86, 0.09, 0.06, 0.18, 0.06), C(0x151826));
            const tint = hdr(screenTints[Math.floor(rand() * screenTints.length)], 1.25);
            screens.add(part(base, x, 1.07, 0.028, 0.6, 0.36, 1, Math.PI), tint);
        }
        const up = pos.clone().addScaledVector(zdir, 0.78);
        const slot = { kind: 'desk', row, u, show: up, hide: up.clone().setY(-1.25), busy: false, next: null };
        slots.push(slot);
        return slot;
    };

    const addPlant = (pos, zdir) => {
        const base = frame(pos, zdir);
        lit.add(part(base, 0, 0.25, 0, 0.45, 0.5, 0.45), C(0x3a3550));
        for (let i = 0; i < 3; i++) {
            const s = 0.8 - i * 0.2;
            lit.add(part(base, 0, 0.75 + i * 0.4, 0, s, 0.4, s, i * 0.6), C(0x1f9d55));
        }
    };

    const addRack = (pos, zdir, tangent, u) => {
        const base = frame(pos, zdir);
        lit.add(part(base, 0, 1.05, 0, 0.95, 2.1, 0.7), C(0x2c3150));
        const leds = [NEON.green, NEON.green, NEON.cyan, NEON.amber];
        for (let i = 0; i < 9; i++) {
            const w = 0.2 + rand() * 0.55;
            glow.add(part(base, (rand() - 0.5) * (0.8 - w), 0.25 + i * 0.2, -0.355, w, 0.05, 0.02), hdr(leds[Math.floor(rand() * leds.length)], 1.7));
        }
        const edge = hdr(zoneColor(u), 1.4);
        glow.add(part(base, -0.475, 1.05, -0.35, 0.025, 2.1, 0.025), edge);
        glow.add(part(base, 0.475, 1.05, -0.35, 0.025, 2.1, 0.025), edge);
        const show = pos.clone().addScaledVector(tangent, 1.2).addScaledVector(zdir, 0.15);
        const hide = pos.clone().addScaledVector(zdir, 0.8);
        slots.push({ kind: 'rack', row: 'in', u, show, hide, busy: false, next: null });
    };

    for (let i = 0; i < stations; i++) {
        const u = i / stations;
        curve.getPointAt(u, p);
        curve.getTangentAt(u, t);
        curve.getTangentAt((u + 2.4 / length) % 1, t2);
        right.set(-t.z, 0, t.x);
        const straight = t.dot(t2) > 0.995;

        for (const [row, dist] of [['o1', 3.5], ['o2', 6.3]]) {
            const pos = p.clone().addScaledVector(right, dist);
            if (rand() < 0.12) {
                addPlant(pos, right.clone());
                rows[row].push(null);
            } else {
                rows[row].push(addDesk(pos, right.clone(), u, row));
            }
        }
        if (straight) {
            addRack(p.clone().addScaledVector(right, -3.1), right.clone().negate(), t.clone(), u);
        }
        if (i % 2 === 0) {
            // Ceiling neon tube across the rail.
            const tubeBase = frame(p.clone().setY(3.75), t.clone());
            glow.add(part(tubeBase, 0, 0, 0, 2.6, 0.06, 0.06), hdr(i % 4 === 0 ? NEON.cyan : NEON.magenta, 2.2));
            lit.add(part(tubeBase, 0, 0.08, 0, 2.8, 0.06, 0.16), C(0x2a2e44));
        }
    }
    for (const row of [rows.o1, rows.o2]) {
        row.forEach((slot, i) => {
            if (slot) slot.next = row[(i + 1) % row.length];
        });
    }

    const litMesh = lit.build();
    group.add(litMesh, glow.build(), screens.build());
    colliders.push(litMesh);

    // --- Wall signs --------------------------------------------------------
    const signs = [
        ['SHIP IT', NEON.cyan, -15, 18.9, Math.PI],
        ['WORKS ON MY MACHINE', NEON.amber, 0, 18.9, Math.PI],
        ['LGTM', NEON.green, 15, 18.9, Math.PI],
        ['git push --force', NEON.magenta, 24.9, -6, -Math.PI / 2],
        ['NO TESTS NO BUGS', NEON.cyan, 24.9, 6, -Math.PI / 2],
        ['404 DEV NOT FOUND', NEON.purple, 15, -18.9, 0],
        ['MOVE FAST', NEON.red, 0, -18.9, 0],
        ['TODO: FIX LATER', NEON.green, -15, -18.9, 0],
        ['HUMANS.TXT', NEON.amber, -24.9, 6, Math.PI / 2],
        ['rm -rf /team', NEON.magenta, -24.9, -6, Math.PI / 2],
    ];
    for (const [text, color, x, z, ry] of signs) {
        const sign = makeSign(text, color);
        sign.position.set(x, 2.7, z);
        sign.rotation.y = ry;
        group.add(sign);
    }

    // --- Lights ------------------------------------------------------------
    group.add(new THREE.HemisphereLight(0x8fa0ff, 0x2a1040, 1.6));
    const lamps = [
        [NEON.cyan, 0, 14], [NEON.magenta, 20.5, 0], [NEON.purple, 0, -14], [NEON.green, -20.5, 0],
    ];
    for (const [color, x, z] of lamps) {
        const lamp = new THREE.PointLight(color, 120, 40, 1.6);
        lamp.position.set(x, 3.3, z);
        group.add(lamp);
    }

    return { group, curve, length, slots, colliders };
}
